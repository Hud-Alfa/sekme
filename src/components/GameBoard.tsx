import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';

import { findBall } from '@/game/balls';
import type { Board } from '@/game/board';
import { COLUMNS, ROWS, STUCK } from '@/game/curve';
import type { TurnResult } from '@/game/engine';
import { clampAim, hitAxis, rotate, stepWalls, subSteps } from '@/game/physics';
import { haptic } from '@/lib/haptics';
import { radius, Text, useColors } from '@/ui';

/**
 * The playfield.
 *
 * The rule this component exists to honour: **no physics on the JS thread.**
 * Positions, collisions and reflections all run inside a Reanimated frame
 * callback on the UI thread. React learns nothing until the turn is over, at
 * which point a single `runOnJS` hands the result across. With forty balls in
 * flight, a per-frame round trip to JS is the difference between a game and a
 * slideshow.
 *
 * All ball state lives in ONE shared value holding flat arrays. The obvious
 * alternative — a shared value per ball — would mean calling a hook in a loop,
 * and the arrays are what let the frame callback touch every ball without
 * crossing the bridge.
 *
 * Blocks are ordinary React views: they change once per turn, not once per
 * frame, so animating them here would buy nothing.
 */

const BALL_POOL = 60;
const BALL_RADIUS_RATIO = 0.1;
/** Ball speed, in cells per second. */
const SPEED_IN_CELLS = 2.6;
/** Longest distance a ball may cover in one sub-step, as a share of a cell. */
const MAX_STEP_RATIO = 0.35;
/** Gap between balls as they leave the launcher. */
const STAGGER_RATIO = 1.8;

type Flight = {
  px: number[];
  py: number[];
  vx: number[];
  vy: number[];
  /** 0 waiting, 1 in flight, 2 returned. */
  live: number[];
  /** Balls still to be released, so the stream leaves over several frames. */
  queued: number;
  releaseTimer: number;
};

function emptyFlight(): Flight {
  'worklet';
  return {
    px: new Array<number>(BALL_POOL).fill(0),
    py: new Array<number>(BALL_POOL).fill(0),
    vx: new Array<number>(BALL_POOL).fill(0),
    vy: new Array<number>(BALL_POOL).fill(0),
    live: new Array<number>(BALL_POOL).fill(0),
    queued: 0,
    releaseTimer: 0,
  };
}

type GameBoardProps = {
  board: Board;
  ballCount: number;
  launchX: number;
  ballId: string;
  width: number;
  onTurnComplete: (result: TurnResult) => void;
  locked: boolean;
};

export function GameBoard({
  board,
  ballCount,
  launchX,
  ballId,
  width,
  onTurnComplete,
  locked,
}: GameBoardProps) {
  const colors = useColors();
  const ball = findBall(ballId);

  const cell = width / COLUMNS;
  const height = cell * ROWS;
  const ballRadius = cell * BALL_RADIUS_RATIO;
  const speed = cell * SPEED_IN_CELLS;

  /* ---- shared state the worklet owns ---------------------------------- */

  const flight = useSharedValue<Flight>(emptyFlight());
  const flying = useSharedValue(0);
  const elapsed = useSharedValue(0);
  const speedScale = useSharedValue(1);
  const firstLanding = useSharedValue(-1);
  const aim = useSharedValue({ x: 0, y: -1 });
  const aiming = useSharedValue(0);
  const tally = useSharedValue({ scored: 0, balls: 0, gold: 0 });

  // The board as flat arrays: what is in each cell, how much health it has
  // left, and what a gold cell is worth. Rebuilt once per turn.
  const snapshot = useMemo(() => {
    const kinds: number[] = [];
    const hp: number[] = [];
    const gold: number[] = [];

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLUMNS; c++) {
        const item = board[r]?.[c];
        kinds.push(
          item?.kind === 'block' ? 1 : item?.kind === 'ball' ? 2 : item?.kind === 'gold' ? 3 : 0,
        );
        hp.push(item?.kind === 'block' ? item.hp : 0);
        gold.push(item?.kind === 'gold' ? item.amount : 0);
      }
    }
    return { kinds, hp, gold };
  }, [board]);

  const cells = useSharedValue(snapshot);
  cells.value = snapshot;

  const geometry = useSharedValue({ cell, width, height, ballRadius, speed });
  geometry.value = { cell, width, height, ballRadius, speed };

  /* ---- crossing back to JS -------------------------------------------- */

  // The frame loop is only alive while balls are. An always-on callback that
  // returns early still wakes the UI thread sixty times a second, and on a
  // phone that is battery and heat spent on deciding to do nothing.
  const [inFlight, setInFlight] = useState(false);

  const finish = useCallback(
    (scored: number, balls: number, gold: number, landing: number) => {
      onTurnComplete({
        scored,
        ballsCollected: balls,
        goldCollected: gold,
        launchX: landing < 0 ? launchX : landing,
      });
    },
    [onTurnComplete, launchX],
  );

  // One haptic per broken block, never per bounce: forty balls rattling around
  // would turn the phone into a buzzer and drain the battery doing it.
  const onBreak = useCallback(() => haptic.press(), []);

  /* ---- the frame loop -------------------------------------------------- */

  const frame = useFrameCallback((info) => {
    'worklet';
    if (flying.value === 0) return;

    const g = geometry.value;
    const dt = Math.min((info.timeSincePreviousFrame ?? 16) / 1000, 1 / 30);
    elapsed.value += dt;

    // Escalating nudges rather than a hard cut: a genuinely long turn is
    // hurried, not punished. Without this, a ball trapped in a flat corridor
    // never comes home and the game simply stops.
    if (elapsed.value > STUCK.speedUpAfter) speedScale.value = 2;
    const forceReturn = elapsed.value > STUCK.forceReturnAfter;
    const jitter = elapsed.value > STUCK.jitterAfter;

    const current = g.speed * speedScale.value;
    const steps = subSteps(current, dt, g.cell * MAX_STEP_RATIO);
    const stepDt = dt / steps;
    const bounds = { left: 0, right: g.width, top: 0 };

    const f = flight.value;
    const px = [...f.px];
    const py = [...f.py];
    const vx = [...f.vx];
    const vy = [...f.vy];
    const live = [...f.live];
    let queued = f.queued;
    let releaseTimer = f.releaseTimer - dt;

    // Release the queue over time so the shot reads as a stream.
    while (queued > 0 && releaseTimer <= 0) {
      const index = live.indexOf(0);
      if (index === -1) break;
      live[index] = 1;
      px[index] = launchX * g.width;
      py[index] = g.height - g.ballRadius - 1;
      vx[index] = aim.value.x * current;
      vy[index] = aim.value.y * current;
      queued -= 1;
      releaseTimer += (g.ballRadius * STAGGER_RATIO) / current;
    }

    const kinds = [...cells.value.kinds];
    const hp = [...cells.value.hp];
    let scored = tally.value.scored;
    let ballsGot = tally.value.balls;
    let goldGot = tally.value.gold;
    let broke = false;
    let moving = 0;

    for (let i = 0; i < BALL_POOL; i++) {
      if (live[i] !== 1) continue;

      let position = { x: px[i]!, y: py[i]! };
      let velocity = { x: vx[i]!, y: vy[i]! };

      for (let s = 0; s < steps; s++) {
        if (forceReturn) {
          velocity = { x: velocity.x * 0.2, y: Math.abs(velocity.y) + current };
        }

        const walled = stepWalls(position, velocity, g.ballRadius, bounds, stepDt);
        position = walled.position;
        velocity = walled.velocity;

        // Only the cells the ball could possibly be touching.
        const minRow = Math.max(0, Math.floor((position.y - g.ballRadius) / g.cell));
        const maxRow = Math.min(ROWS - 1, Math.floor((position.y + g.ballRadius) / g.cell));
        const minCol = Math.max(0, Math.floor((position.x - g.ballRadius) / g.cell));
        const maxCol = Math.min(COLUMNS - 1, Math.floor((position.x + g.ballRadius) / g.cell));

        for (let r = minRow; r <= maxRow; r++) {
          for (let c = minCol; c <= maxCol; c++) {
            const index = r * COLUMNS + c;
            const kind = kinds[index] ?? 0;
            if (kind === 0) continue;

            const box = { x: c * g.cell, y: r * g.cell, width: g.cell, height: g.cell };
            const axis = hitAxis(position, g.ballRadius, box);
            if (axis === null) continue;

            if (kind === 1) {
              hp[index] = (hp[index] ?? 1) - 1;
              scored += 1;
              if ((hp[index] ?? 0) <= 0) {
                kinds[index] = 0;
                broke = true;
              }
              velocity = {
                x: axis === 'x' ? -velocity.x : velocity.x,
                y: axis === 'y' ? -velocity.y : velocity.y,
              };
              if (jitter) velocity = rotate(velocity, STUCK.jitterRadians);
            } else {
              // Pickups do not deflect: a ball that bounced off a "+1" would
              // punish the player for collecting it.
              kinds[index] = 0;
              if (kind === 2) ballsGot += 1;
              else goldGot += cells.value.gold[index] ?? 0;
            }
          }
        }

        if (position.y + g.ballRadius >= g.height) {
          live[i] = 2;
          if (firstLanding.value < 0) firstLanding.value = position.x / g.width;
          break;
        }
      }

      px[i] = position.x;
      py[i] = position.y;
      vx[i] = velocity.x;
      vy[i] = velocity.y;
      if (live[i] === 1) moving += 1;
    }

    cells.value = { kinds, hp, gold: cells.value.gold };
    flight.value = { px, py, vx, vy, live, queued, releaseTimer };
    tally.value = { scored, balls: ballsGot, gold: goldGot };

    if (broke) runOnJS(onBreak)();

    if (moving === 0 && queued === 0) {
      flying.value = 0;
      runOnJS(setInFlight)(false);
      runOnJS(finish)(scored, ballsGot, goldGot, firstLanding.value);
    }
  }, false);

  useEffect(() => {
    frame.setActive(inFlight);
  }, [frame, inFlight]);

  useEffect(() => {
    // A turn that is mid-flight when the app goes away must not keep a frame
    // loop alive behind a lock screen. It resumes where it left off: `elapsed`
    // only advances on frames that actually ran, so the anti-stuck timers do
    // not fire because someone took a phone call.
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') frame.setActive(false);
      else if (flying.value === 1) frame.setActive(true);
    });
    return () => subscription.remove();
  }, [frame, flying]);

  /* ---- aiming and firing ----------------------------------------------- */

  const aimAt = (x: number, y: number) => {
    'worklet';
    aim.value = clampAim({ x: x - launchX * width, y: y - height });
  };

  const gesture = Gesture.Pan()
    .onBegin((event) => {
      'worklet';
      if (flying.value === 1 || locked) return;
      aiming.value = 1;
      aimAt(event.x, event.y);
    })
    .onUpdate((event) => {
      'worklet';
      if (flying.value === 1 || locked) return;
      aimAt(event.x, event.y);
    })
    .onEnd(() => {
      'worklet';
      if (flying.value === 1 || locked) return;
      aiming.value = 0;

      flight.value = { ...emptyFlight(), queued: Math.min(ballCount, BALL_POOL) };
      tally.value = { scored: 0, balls: 0, gold: 0 };
      elapsed.value = 0;
      speedScale.value = 1;
      firstLanding.value = -1;
      flying.value = 1;
      runOnJS(setInFlight)(true);
    });

  /* ---- rendering ------------------------------------------------------- */

  const aimLine = useAnimatedStyle(() => ({
    opacity: aiming.value,
    transform: [
      { translateX: launchX * width },
      { translateY: height },
      { rotate: `${Math.atan2(aim.value.y, aim.value.x) + Math.PI / 2}rad` },
    ],
  }));

  const dots = useMemo(() => Array.from({ length: BALL_POOL }, (_, i) => i), []);

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ width, height, alignSelf: 'center' }}>
        {board.map((row, r) =>
          row.map((item, c) => {
            if (item.kind === 'empty') return null;
            const key = `${r}-${c}`;

            if (item.kind === 'block') {
              // Colour tracks toughness, but the number is always printed: the
              // shade is a hint, the digit is the fact.
              const intensity = Math.min(1, item.hp / 60);
              return (
                <View
                  key={key}
                  style={{
                    position: 'absolute',
                    left: c * cell + 2,
                    top: r * cell + 2,
                    width: cell - 4,
                    height: cell - 4,
                    borderRadius: radius.sm,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.accent,
                    opacity: 0.35 + intensity * 0.65,
                  }}>
                  <Text variant="label" style={{ color: colors.onAccent }}>
                    {item.hp}
                  </Text>
                </View>
              );
            }

            const isBall = item.kind === 'ball';
            return (
              <View
                key={key}
                style={{
                  position: 'absolute',
                  left: c * cell + cell / 2 - ballRadius * 1.5,
                  top: r * cell + cell / 2 - ballRadius * 1.5,
                  width: ballRadius * 3,
                  height: ballRadius * 3,
                  borderRadius: radius.pill,
                  borderWidth: 2,
                  borderColor: isBall ? colors.text : colors.warning,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Text variant="caption" color={isBall ? 'text' : 'warning'}>
                  {isBall ? '+1' : '₺'}
                </Text>
              </View>
            );
          }),
        )}

        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              width: 2,
              height: height * 0.35,
              marginTop: -height * 0.35,
              backgroundColor: colors.textMuted,
            },
            aimLine,
          ]}
        />

        {dots.map((i) => (
          <Dot key={i} index={i} flight={flight} size={ballRadius * 2} color={ball.color} />
        ))}
      </View>
    </GestureDetector>
  );
}

function Dot({
  index,
  flight,
  size,
  color,
}: {
  index: number;
  flight: { value: Flight };
  size: number;
  color: string;
}) {
  const style = useAnimatedStyle(() => {
    const live = flight.value.live[index] ?? 0;
    return {
      opacity: live === 1 ? 1 : 0,
      transform: [
        { translateX: (flight.value.px[index] ?? 0) - size / 2 },
        { translateY: (flight.value.py[index] ?? 0) - size / 2 },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}
