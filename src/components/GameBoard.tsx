import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeOut,
  runOnJS,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withSequence,
} from 'react-native-reanimated';

import { findBall, type Ball } from '@/game/balls';
import { EMPTY, type Board, type Cell } from '@/game/board';
import { COLUMNS, ROWS, SPEED_IN_CELLS, STUCK } from '@/game/curve';
import type { TurnResult } from '@/game/engine';
import { clampAim, hitAxis, rotate, stepWalls, subSteps } from '@/game/physics';
import { haptic } from '@/lib/haptics';
import { duration, radius, settle, Text, timing, useColors } from '@/ui';

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
 * Blocks ARE ordinary React views, and they only re-render on an actual hit —
 * not once per frame — but they now DO re-render on a hit, not just once per
 * turn: a block that visibly took no damage until the turn ended read as
 * broken, not alive. The bridge back is a single `runOnJS` fired only on
 * frames where something actually changed, same discipline as the haptic
 * below it.
 */

const BALL_POOL = 60;
const BALL_RADIUS_RATIO = 0.1;
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

type CellsSnapshot = { kinds: number[]; hp: number[]; gold: number[] };

export type TurnProgress = { ballsCollected: number; goldCollected: number };

type GameBoardProps = {
  board: Board;
  ballCount: number;
  launchX: number;
  ballId: string;
  width: number;
  onTurnComplete: (result: TurnResult) => void;
  /** Fires on any frame that actually changed something — a hit or a pickup —
      so the screen can show the running total climbing mid-turn instead of
      jumping once at the end. */
  onProgress?: (progress: TurnProgress) => void;
  locked: boolean;
};

export function GameBoard({
  board,
  ballCount,
  launchX,
  ballId,
  width,
  onTurnComplete,
  onProgress,
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

  // A React-visible mirror of the same data, updated only on frames that
  // actually changed a cell (see `reportProgress` below) — this is what the
  // block views below render from, so a hit shows up as it happens instead
  // of only once the whole turn resolves.
  //
  // Reset synchronously during render rather than in an effect: a new `board`
  // prop means every index means something different (the row shift), so a
  // one-render lag here would pair a stale liveCells index against a fresh
  // board index and briefly show the wrong hp on the wrong cell.
  const [renderedBoard, setRenderedBoard] = useState(board);
  const [liveCells, setLiveCells] = useState<CellsSnapshot>(snapshot);
  if (board !== renderedBoard) {
    setRenderedBoard(board);
    setLiveCells(snapshot);
  }

  const geometry = useSharedValue({ cell, width, height, ballRadius, speed });
  geometry.value = { cell, width, height, ballRadius, speed };

  /* ---- crossing back to JS -------------------------------------------- */

  // The frame loop is only alive while balls are. An always-on callback that
  // returns early still wakes the UI thread sixty times a second, and on a
  // phone that is battery and heat spent on deciding to do nothing.
  const [inFlight, setInFlight] = useState(false);

  // Mid-turn hit/pickup reporting: fired only on frames where a ball actually
  // touched something, never on every frame — the block views need to be
  // told a hit happened, but the JS thread does not need 60 messages a second
  // to tell them.
  // Per-cell gold amounts are fixed at spawn and never change mid-turn, so
  // they are read from a ref rather than closed over directly — a plain
  // closure here would freeze on whatever `snapshot` was current the one
  // time this callback was created.
  const goldRef = useRef(snapshot.gold);
  goldRef.current = snapshot.gold;

  const reportProgress = useCallback(
    (kinds: number[], hp: number[], ballsGot: number, goldGot: number) => {
      setLiveCells({ kinds, hp, gold: goldRef.current });
      onProgress?.({ ballsCollected: ballsGot, goldCollected: goldGot });
    },
    [onProgress],
  );

  const finish = useCallback(
    (scored: number, balls: number, gold: number, landing: number) => {
      // The frame loop tracks damage and pickups all turn in cells.value, but
      // that lived only on the UI thread. Read it back one last time here and
      // fold it into a real Board — otherwise every hit this turn is thrown
      // away the moment the next row descends.
      const { kinds, hp } = cells.value;
      const finalBoard: Board = [];
      for (let r = 0; r < ROWS; r++) {
        const row: Cell[] = [];
        for (let c = 0; c < COLUMNS; c++) {
          const index = r * COLUMNS + c;
          const kind = kinds[index] ?? 0;
          const original = board[r]?.[c];
          if (kind === 1) {
            const maxHp = original?.kind === 'block' ? original.maxHp : (hp[index] ?? 1);
            row.push({ kind: 'block', hp: hp[index] ?? 1, maxHp });
          } else if (kind === 0) {
            row.push(EMPTY);
          } else {
            // Untouched pickup: carry the original cell forward unchanged.
            row.push(original ?? EMPTY);
          }
        }
        finalBoard.push(row);
      }

      onTurnComplete({
        scored,
        ballsCollected: balls,
        goldCollected: gold,
        launchX: landing < 0 ? launchX : landing,
        board: finalBoard,
      });
    },
    [onTurnComplete, launchX, board, cells],
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
    let changed = false;
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

            changed = true;

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
    if (changed) runOnJS(reportProgress)(kinds, hp, ballsGot, goldGot);

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
      aiming.value = timing(1, duration.fast);
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
      aiming.value = timing(0, duration.fast);

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
          row.map((original, c) => {
            const index = r * COLUMNS + c;
            const liveKind = liveCells.kinds[index] ?? 0;
            if (liveKind === 0) return null;

            const key = `${r}-${c}`;
            const left = c * cell;
            const top = r * cell;

            if (liveKind === 1) {
              const maxHp = original.kind === 'block' ? original.maxHp : 1;
              return (
                <BlockCell
                  key={key}
                  hp={liveCells.hp[index] ?? 1}
                  maxHp={maxHp}
                  left={left}
                  top={top}
                  size={cell}
                  accent={colors.accent}
                  onAccent={colors.onAccent}
                />
              );
            }

            // An untouched pickup — original still describes it exactly.
            if (original.kind !== 'ball' && original.kind !== 'gold') return null;
            const isBall = original.kind === 'ball';
            return (
              <View
                key={key}
                style={{
                  position: 'absolute',
                  left: left + cell / 2 - ballRadius * 1.5,
                  top: top + cell / 2 - ballRadius * 1.5,
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

        <Animated.View pointerEvents="none" style={[{ position: 'absolute' }, aimLine]}>
          {/* A plain bar only showed heading, not destination — the arrowhead
              is what actually answers "where is this going". */}
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: -9,
              width: 18,
              height: 18,
              borderRadius: radius.pill,
              borderWidth: 2,
              borderColor: colors.accent,
              opacity: 0.5,
            }}
          />
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: -2,
              width: 4,
              height: height * 0.32,
              borderRadius: radius.pill,
              backgroundColor: colors.accent,
            }}
          />
          <View
            style={{
              position: 'absolute',
              bottom: height * 0.32 - 4,
              left: -9,
              width: 0,
              height: 0,
              borderLeftWidth: 9,
              borderRightWidth: 9,
              borderBottomWidth: 13,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderBottomColor: colors.accent,
            }}
          />
        </Animated.View>

        {dots.map((i) => (
          <Dot key={i} index={i} flight={flight} size={ballRadius * 2} ball={ball} />
        ))}
      </View>
    </GestureDetector>
  );
}

/**
 * A block. Hit feedback (a quick punch) and break feedback (fade and shrink
 * away) both live here now instead of only showing up once a turn away —
 * `exiting` fires the moment React stops rendering this cell, which is
 * exactly the frame `liveCells` reports it broken.
 */
function BlockCell({
  hp,
  maxHp,
  left,
  top,
  size,
  accent,
  onAccent,
}: {
  hp: number;
  maxHp: number;
  left: number;
  top: number;
  size: number;
  accent: string;
  onAccent: string;
}) {
  const punch = useSharedValue(1);
  const previousHp = useRef(hp);

  useEffect(() => {
    if (hp < previousHp.current) {
      // A quick punch out and a spring back in — a hit should feel like an
      // impact, not a fade.
      punch.value = withSequence(timing(1.14, duration.fast / 2), settle(1));
    }
    previousHp.current = hp;
  }, [hp, punch]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: punch.value }] }));

  // Colour tracks toughness, but the number is always printed: the shade is
  // a hint, the digit is the fact.
  const intensity = Math.min(1, hp / Math.max(1, maxHp));

  // Split in two: the outer view owns `exiting` and nothing else, the inner
  // one owns the punch scale and the intensity opacity — Reanimated warns
  // (correctly) that a layout animation and a custom opacity fight over the
  // same view otherwise.
  return (
    <Animated.View
      exiting={FadeOut.duration(duration.fast)}
      style={{ position: 'absolute', left, top, width: size, height: size }}>
      <Animated.View
        style={[
          {
            flex: 1,
            borderRadius: radius.sm,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: accent,
            opacity: 0.4 + intensity * 0.6,
          },
          style,
        ]}>
        <Text variant="label" style={{ color: onAccent }}>
          {hp}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

function Dot({
  index,
  flight,
  size,
  ball,
}: {
  index: number;
  flight: { value: Flight };
  size: number;
  ball: Ball;
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

  // Higher rarity, more glow — the trail field was always in the catalogue,
  // it just never reached a view. A plain filled circle read the same for
  // every ball regardless of what a capsule actually paid for.
  const glowSize = size * (1.6 + Math.min(ball.trail, 12) / 10);

  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute' }, style]}>
      {ball.trail > 0 ? (
        <View
          style={{
            position: 'absolute',
            left: size / 2 - glowSize / 2,
            top: size / 2 - glowSize / 2,
            width: glowSize,
            height: glowSize,
            borderRadius: glowSize / 2,
            backgroundColor: ball.color,
            opacity: 0.22,
          }}
        />
      ) : null}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: ball.color,
          borderWidth: Math.max(1, size * 0.12),
          borderColor: '#FFFFFF66',
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: size * 0.22,
          top: size * 0.18,
          width: size * 0.32,
          height: size * 0.32,
          borderRadius: size * 0.16,
          backgroundColor: '#FFFFFF80',
        }}
      />
    </Animated.View>
  );
}
