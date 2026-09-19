import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withSequence,
  ZoomOut,
} from 'react-native-reanimated';

import { findBall, type Ball } from '@/game/balls';
import { EMPTY, type Board, type BlockShape, type Cell } from '@/game/board';
import { AIM_HORIZONTAL_BOOST, COLUMNS, ROWS, SPEED_IN_CELLS, STUCK } from '@/game/curve';
import type { TurnResult } from '@/game/engine';
import { clampAim, hitAxis, hitTriangle, reflectOff, rotate, stepWalls, subSteps, type TriangleCorner } from '@/game/physics';
import { findBoardTheme, themeColorFor, type BoardTheme } from '@/game/themes';
import { formatNumber } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { duration, radius, settle, space, Text, timing, useColors, useTheme } from '@/ui';

/** A lucky-ball block break pays this much bonus gold, on the spot. Flat
 * rather than turn-scaled — it is a small surprise, not a second income. */
const LUCKY_GOLD_BONUS = 2;

/** Reserved strip below the play field for the launcher mark and the current
 * ball count, so they never sit on top of a block even when the board is
 * stacked all the way to the floor. */
const LAUNCHER_STRIP = 52;

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
const BALL_RADIUS_RATIO = 0.14;
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
  /** Balls/gold a ball has grabbed mid-flight but not yet brought home —
   * held here per ball and only folded into the visible count once that
   * ball actually lands (see the frame loop). A pickup grabbed early in a
   * long bounce used to bump the counter before the ball itself was back,
   * which read as the count updating for no visible reason. */
  ballCredit: number[];
  goldCredit: number[];
  /** Seconds since this ball last touched a block — resets on every block
   * contact, not on every wall bounce. The force-return escalation reads
   * this instead of the whole turn's elapsed time, so a ball that is still
   * actively clearing blocks is never yanked home early just because the
   * turn overall has run long; only a ball that has gone quiet — bouncing
   * wall-to-wall with nothing to show for it — is genuinely stuck. */
  stuckTimer: number[];
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
    ballCredit: new Array<number>(BALL_POOL).fill(0),
    goldCredit: new Array<number>(BALL_POOL).fill(0),
    stuckTimer: new Array<number>(BALL_POOL).fill(0),
  };
}

// Shape as a number, for the same reason kind is: the frame loop's arrays
// stay flat numbers, never objects or strings, so a worklet never has to
// cross the bridge to read one. 0 square, 1 tl, 2 tr, 3 bl, 4 br — matching
// `game/physics.ts`'s `TriangleCorner` numbering for 1-4.
const SHAPE_CODE: Record<BlockShape, number> = { square: 0, tl: 1, tr: 2, bl: 3, br: 4 };

type CellsSnapshot = { kinds: number[]; hp: number[]; amount: number[]; shapes: number[] };

export type TurnProgress = { ballsCollected: number; goldCollected: number };

type GameBoardProps = {
  board: Board;
  ballCount: number;
  launchX: number;
  ballId: string;
  /** Which board skin is active — see `game/themes.ts`. Defaults to the free one. */
  boardThemeId?: string;
  width: number;
  /** Real available height for the board's own frame, measured by the caller
   * via onLayout. The grid itself stays width-bound (unchanged), but the
   * frame around it fills this height instead of stopping short — see the
   * comment above the frame View below. */
  frameHeight?: number;
  /** Rendered at the top of the frame, inside the border — back/restart
   * buttons and the score row, so the panel's own top edge holds something
   * instead of being empty border and background. */
  header?: ReactNode;
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
  boardThemeId,
  width,
  frameHeight,
  header,
  onTurnComplete,
  onProgress,
  locked,
}: GameBoardProps) {
  const colors = useColors();
  const { scheme } = useTheme();
  const ball = findBall(ballId);
  const power = ball.power ?? {};
  const theme = findBoardTheme(boardThemeId ?? '');
  // The board's own accent — the app's fixed accent for the free theme, the
  // theme's own neon hue for every purchased one. Scoped to this component:
  // headers, buttons and everything outside the play field stay the series'
  // one fixed accent, per `tasarim-sistemi`.
  const boardAccent = theme.accent ?? colors.accent;

  const cell = width / COLUMNS;
  const height = cell * ROWS;
  const ballRadius = cell * BALL_RADIUS_RATIO;
  const speed = cell * SPEED_IN_CELLS * (power.speedMult ?? 1);

  /* ---- shared state the worklet owns ---------------------------------- */

  const flight = useSharedValue<Flight>(emptyFlight());
  const flying = useSharedValue(0);
  // `locked` (the JS prop) lags a turn's true end by at least one React
  // render — it only becomes true once `onTurnComplete` → `setResolving`
  // → re-render has happened, and the gesture's closure only sees that on
  // its NEXT recreation. A shot fired into that gap fires for real, against
  // a board that has not caught up yet, and can double-collect whatever it
  // touches. This is set the instant a turn ends (same frame as
  // `flying.value = 0`, no JS round trip) and only cleared once this
  // component has actually re-rendered with the resolved board.
  const turnLocked = useSharedValue(0);
  const elapsed = useSharedValue(0);
  const speedScale = useSharedValue(1);
  const lastLanding = useSharedValue(-1);
  const aim = useSharedValue({ x: 0, y: -1 });
  const aiming = useSharedValue(0);
  const tally = useSharedValue({ scored: 0, balls: 0, gold: 0 });
  // A quick pulse on the collector ring exactly when a ball lands WITH
  // something to show for it — a small "it's home, and it counted" beat to
  // go with the count only climbing on landing now, not mid-flight.
  const collectPulse = useSharedValue(1);

  // The board as flat arrays: what is in each cell, how much health it has
  // left, and — for a pickup cell, ball or gold — how much it is worth.
  // Rebuilt once per turn.
  const snapshot = useMemo(() => {
    const kinds: number[] = [];
    const hp: number[] = [];
    const amount: number[] = [];
    const shapes: number[] = [];

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLUMNS; c++) {
        const item = board[r]?.[c];
        kinds.push(
          item?.kind === 'block' ? 1 : item?.kind === 'ball' ? 2 : item?.kind === 'gold' ? 3 : 0,
        );
        hp.push(item?.kind === 'block' ? item.hp : 0);
        amount.push(item?.kind === 'ball' || item?.kind === 'gold' ? item.amount : 0);
        shapes.push(item?.kind === 'block' ? SHAPE_CODE[item.shape ?? 'square'] : 0);
      }
    }
    return { kinds, hp, amount, shapes };
  }, [board]);

  const cells = useSharedValue(snapshot);

  // A React-visible mirror of the same data, updated only on frames that
  // actually changed a cell (see `reportProgress` below) — this is what the
  // block views below render from, so a hit shows up as it happens instead
  // of only once the whole turn resolves.
  //
  // Reset synchronously during render rather than in an effect: a new `board`
  // prop means every index means something different (the row shift), so a
  // one-render lag here would pair a stale liveCells index against a fresh
  // board index and briefly show the wrong hp on the wrong cell.
  //
  // CRITICAL: `cells.value` is reset here too, and ONLY here — guarded on the
  // board actually changing. It used to be assigned unconditionally on every
  // render, which looked harmless (`snapshot` is referentially stable within
  // a turn) but was not: `reportProgress` below triggers a React re-render on
  // every hit, and every one of those re-renders was overwriting cells.value
  // back to this turn's STARTING snapshot, erasing whatever the frame loop
  // had just mutated it to. That is why a destroyed block or a collected
  // pickup could come back mid-turn — the damage was real for one frame, then
  // silently undone by the very next render.
  const [renderedBoard, setRenderedBoard] = useState(board);
  const [liveCells, setLiveCells] = useState<CellsSnapshot>(snapshot);
  if (board !== renderedBoard) {
    setRenderedBoard(board);
    setLiveCells(snapshot);
    cells.value = snapshot;
    // The board actually caught up — safe to accept a new shot again.
    turnLocked.value = 0;
  }

  // Ball powers ride along in the same shared value as the geometry, not a
  // separate one — the frame loop already reads `g.*` once per frame, and
  // these are exactly as static per-turn as `cell`/`speed` are.
  const damagePerHit = power.damage ?? 1;
  const pierceChance = power.pierceChance ?? 0;
  const magnetRadius = power.magnetRadius ?? 0;
  const luckyGoldChance = power.luckyGoldChance ?? 0;

  const geometry = useSharedValue({
    cell,
    width,
    height,
    ballRadius,
    speed,
    damagePerHit,
    pierceChance,
    magnetRadius,
    luckyGoldChance,
  });
  useEffect(() => {
    geometry.value = {
      cell,
      width,
      height,
      ballRadius,
      speed,
      damagePerHit,
      pierceChance,
      magnetRadius,
      luckyGoldChance,
    };
  }, [cell, width, height, ballRadius, speed, damagePerHit, pierceChance, magnetRadius, luckyGoldChance, geometry]);

  /* ---- crossing back to JS -------------------------------------------- */

  // The frame loop is only alive while balls are. An always-on callback that
  // returns early still wakes the UI thread sixty times a second, and on a
  // phone that is battery and heat spent on deciding to do nothing.
  const [inFlight, setInFlight] = useState(false);

  // Short-lived particle bursts, one per block break (see `onBreak` below).
  const [bursts, setBursts] = useState<{ id: number; left: number; top: number; color: string }[]>([]);

  // Mid-turn hit/pickup reporting: fired only on frames where a ball actually
  // touched something, never on every frame — the block views need to be
  // told a hit happened, but the JS thread does not need 60 messages a second
  // to tell them.
  // Per-cell pickup amounts are fixed at spawn and never change mid-turn, so
  // they are read from a ref rather than closed over directly — a plain
  // closure here would freeze on whatever `snapshot` was current the one
  // time this callback was created.
  const amountRef = useRef(snapshot.amount);
  amountRef.current = snapshot.amount;
  const shapesRef = useRef(snapshot.shapes);
  shapesRef.current = snapshot.shapes;

  const reportProgress = useCallback(
    (kinds: number[], hp: number[], ballsGot: number, goldGot: number) => {
      setLiveCells({ kinds, hp, amount: amountRef.current, shapes: shapesRef.current });
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
            // Shape is fixed at spawn and never changes mid-turn, same as
            // maxHp above — carried from the original cell, not tracked in
            // the frame loop's own flat arrays.
            const shape = original?.kind === 'block' ? (original.shape ?? 'square') : 'square';
            row.push({ kind: 'block', hp: hp[index] ?? 1, maxHp, shape });
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
  // would turn the phone into a buzzer and drain the battery doing it. A
  // break also spawns a short particle burst at that cell — the one referans
  // effect this component was missing outright, not just a palette swap.
  // Only the LAST block broken in a given frame gets a burst; several blocks
  // rarely break on the exact same frame, and when they do, one burst reads
  // as "something broke here" well enough.
  const burstId = useRef(0);
  const onBreak = useCallback(
    (index: number) => {
      haptic.press();
      if (index < 0) return;
      const r = Math.floor(index / COLUMNS);
      const c = index % COLUMNS;
      const id = burstId.current++;
      const burstColor = themeColorFor(theme, index, colors.accent);
      setBursts((prev) => [
        ...prev,
        { id, left: c * cell + cell / 2, top: r * cell + cell / 2, color: burstColor },
      ]);
      setTimeout(() => setBursts((prev) => prev.filter((b) => b.id !== id)), 500);
    },
    [cell, theme, colors.accent],
  );

  /* ---- the frame loop -------------------------------------------------- */

  const frame = useFrameCallback((info) => {
    'worklet';
    if (flying.value === 0) return;

    const g = geometry.value;
    const dt = Math.min((info.timeSincePreviousFrame ?? 16) / 1000, 1 / 30);
    elapsed.value += dt;

    // Escalating nudges rather than a hard cut: a genuinely long turn is
    // hurried, not punished. Without this, a ball trapped in a flat corridor
    // never comes home and the game simply stops. Jitter and the speed-up are
    // still turn-wide (a gentle nudge to everyone costs little) — only the
    // force-return below is judged per ball, since it is the disruptive one.
    if (elapsed.value > STUCK.speedUpAfter) speedScale.value = 2;
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
    const ballCredit = [...f.ballCredit];
    const goldCredit = [...f.goldCredit];
    const stuckTimer = [...f.stuckTimer];
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
    // Never mutated — a block's shape is fixed at spawn — so this is read
    // directly rather than copied like kinds/hp are.
    const shapes = cells.value.shapes;
    let scored = tally.value.scored;
    let ballsGot = tally.value.balls;
    let goldGot = tally.value.gold;
    let broke = false;
    let brokeAt = -1;
    let changed = false;
    let moving = 0;

    for (let i = 0; i < BALL_POOL; i++) {
      if (live[i] !== 1) continue;

      stuckTimer[i] = (stuckTimer[i] ?? 0) + dt;
      const forceReturn = stuckTimer[i]! > STUCK.forceReturnAfter;

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

        // A ball can overlap several blocks at once at a corner, now that
        // blocks tile edge-to-edge with no gap between them. Reflecting once
        // per overlapping block in the same sub-step let opposite reflections
        // cancel out — net near-zero velocity, ball stuck oscillating in the
        // seam. Only the first block found gets to redirect the ball; every
        // block touched this sub-step still takes damage.
        let blockHit = false;

        for (let r = minRow; r <= maxRow; r++) {
          for (let c = minCol; c <= maxCol; c++) {
            const index = r * COLUMNS + c;
            const kind = kinds[index] ?? 0;
            if (kind === 0) continue;

            const box = { x: c * g.cell, y: r * g.cell, width: g.cell, height: g.cell };
            // A pickup reaches out to the ball's magnet radius, not just its
            // physical radius — a block's hitbox never grows, only a
            // pickup's, so magnet balls never gain reach through a wall.
            const reach = kind === 1 ? g.ballRadius : g.ballRadius + g.magnetRadius * g.cell;
            const shape = kind === 1 ? (shapes[index] ?? 0) : 0;

            // A triangle's two legs sit flush on the cell's own edges — from
            // outside the cell those behave exactly like a square block's
            // faces, so only the diagonal hypotenuse needs its own check.
            // `axis` drives the existing square path; `triangleHit` drives
            // the new one; exactly one of them is ever set.
            const axis = shape === 0 ? hitAxis(position, reach, box) : null;
            const triangleHit = shape === 0 ? null : hitTriangle(position, reach, box, shape as TriangleCorner);
            if (axis === null && triangleHit === null) continue;

            changed = true;

            if (kind === 1) {
              // Contact, not just a break — a ball still chewing through a
              // tough block should never be force-returned mid-fight.
              stuckTimer[i] = 0;
              hp[index] = (hp[index] ?? 1) - g.damagePerHit;
              scored += 1;
              if ((hp[index] ?? 0) <= 0) {
                kinds[index] = 0;
                broke = true;
                brokeAt = index;
                if (g.luckyGoldChance > 0 && Math.random() < g.luckyGoldChance) {
                  goldCredit[i] += LUCKY_GOLD_BONUS;
                }
              }
              // A pierce roll lets the ball skip reflecting off THIS block —
              // it keeps going, possibly straight into whatever is behind it.
              // Damage above still applies either way; only the bounce is
              // skipped. Rolled once per block per sub-step, not once per
              // ball per frame, so a pierce ball still bounces normally off
              // every OTHER block it meets.
              const pierced = g.pierceChance > 0 && Math.random() < g.pierceChance;
              if (!blockHit && !pierced) {
                blockHit = true;

                if (axis !== null) {
                  velocity = {
                    x: axis === 'x' ? -velocity.x : velocity.x,
                    y: axis === 'y' ? -velocity.y : velocity.y,
                  };
                  if (jitter) velocity = rotate(velocity, STUCK.jitterRadians);

                  // Reflecting velocity alone does not move the ball — with
                  // blocks now touching edge-to-edge, a ball that penetrated
                  // past a boundary in one sub-step would stay embedded and
                  // keep re-triggering the same collision next sub-step,
                  // reflecting back and forth in place instead of leaving.
                  // Push it back to just outside the box it hit.
                  if (axis === 'x') {
                    position = {
                      x:
                        position.x < box.x + box.width / 2
                          ? box.x - g.ballRadius
                          : box.x + box.width + g.ballRadius,
                      y: position.y,
                    };
                  } else {
                    position = {
                      x: position.x,
                      y:
                        position.y < box.y + box.height / 2
                          ? box.y - g.ballRadius
                          : box.y + box.height + g.ballRadius,
                    };
                  }
                } else if (triangleHit !== null) {
                  velocity = reflectOff(velocity, triangleHit.normal);
                  if (jitter) velocity = rotate(velocity, STUCK.jitterRadians);
                  // Same reasoning as the square push-out above, along the
                  // diagonal's own normal instead of an axis.
                  const push = g.ballRadius - triangleHit.distance;
                  position = {
                    x: position.x + triangleHit.normal.x * push,
                    y: position.y + triangleHit.normal.y * push,
                  };
                }
              }
            } else {
              // Pickups do not deflect: a ball that bounced off a "+1" would
              // punish the player for collecting it. The amount is HELD on
              // this ball, not credited yet — it only counts once the ball
              // that grabbed it actually comes home (below), so the visible
              // total climbs as balls land, not the instant one touches a
              // pickup mid-air.
              kinds[index] = 0;
              const pickupAmount = cells.value.amount[index] ?? 1;
              if (kind === 2) ballCredit[i] += pickupAmount;
              else goldCredit[i] += pickupAmount;
            }
          }
        }

        if (position.y + g.ballRadius >= g.height) {
          live[i] = 2;
          // Unconditional, not "only if unset": the next shot should start
          // from wherever the LAST ball came home, not the first — the ball
          // loop runs in index order each frame, not landing order, so
          // whichever one lands last (this frame or a later one) simply
          // overwrites it, and whatever value is left when the turn ends is
          // correct by construction.
          lastLanding.value = position.x / g.width;

          // This ball is home — anything it grabbed on the way finally
          // counts, and only now.
          if (ballCredit[i] > 0 || goldCredit[i] > 0) {
            ballsGot += ballCredit[i];
            goldGot += goldCredit[i];
            ballCredit[i] = 0;
            goldCredit[i] = 0;
            changed = true;
            collectPulse.value = withSequence(timing(1.4, duration.fast / 2), settle(1));
          }
          break;
        }
      }

      px[i] = position.x;
      py[i] = position.y;
      vx[i] = velocity.x;
      vy[i] = velocity.y;
      if (live[i] === 1) moving += 1;
    }

    cells.value = { kinds, hp, amount: cells.value.amount, shapes: cells.value.shapes };
    flight.value = { px, py, vx, vy, live, queued, releaseTimer, ballCredit, goldCredit, stuckTimer };
    tally.value = { scored, balls: ballsGot, gold: goldGot };

    if (broke) runOnJS(onBreak)(brokeAt);
    if (changed) runOnJS(reportProgress)(kinds, hp, ballsGot, goldGot);

    if (moving === 0 && queued === 0) {
      flying.value = 0;
      turnLocked.value = 1;
      runOnJS(setInFlight)(false);
      runOnJS(finish)(scored, ballsGot, goldGot, lastLanding.value);
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
    // Boosted before the clamp normalises it — the raw offset is capped by
    // the board's own width, which on a 7-column board never let a finger
    // near the middle reach a wide angle no matter how far it dragged.
    aim.value = clampAim({ x: (x - launchX * width) * AIM_HORIZONTAL_BOOST, y: y - height });
  };

  const gesture = Gesture.Pan()
    .onBegin((event) => {
      'worklet';
      if (flying.value === 1 || turnLocked.value === 1 || locked) return;
      aiming.value = timing(1, duration.fast);
      aimAt(event.x, event.y);
    })
    .onUpdate((event) => {
      'worklet';
      if (flying.value === 1 || turnLocked.value === 1 || locked) return;
      aimAt(event.x, event.y);
    })
    .onEnd(() => {
      'worklet';
      if (flying.value === 1 || turnLocked.value === 1 || locked) return;
      aiming.value = timing(0, duration.fast);

      flight.value = { ...emptyFlight(), queued: Math.min(ballCount, BALL_POOL) };
      tally.value = { scored: 0, balls: 0, gold: 0 };
      elapsed.value = 0;
      speedScale.value = 1;
      lastLanding.value = -1;
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

  const collectStyle = useAnimatedStyle(() => ({ transform: [{ scale: collectPulse.value }] }));

  const dots = useMemo(() => Array.from({ length: BALL_POOL }, (_, i) => i), []);

  // Where the launcher mark and ball count sit, clamped so the group never
  // spills past the board's own edges — a shot fired from the far left or
  // right column used to push the label straight off-screen.
  const markerWidth = 64;
  const markerX = Math.min(Math.max(launchX * width - markerWidth / 2, 0), width - markerWidth);

  // The grid is column-width-bound — on a 7-wide board there is always slack
  // left over on a tall phone. Rather than leave that slack as bare
  // background, the FRAME around the grid fills the caller's whole measured
  // height (bordered, on-theme, glowing for a neon theme) and the grid sits
  // centred inside it — the frame's own border/tint is what fills the space,
  // not the grid stretching to a size its physics were never tuned for.
  const framed = Math.max(frameHeight ?? 0, height + LAUNCHER_STRIP);
  const outline = theme.style === 'outline';

  return (
    <View
      style={{
        width,
        height: framed,
        alignSelf: 'center',
        borderRadius: radius.xl,
        borderWidth: 2,
        borderColor: outline ? `${boardAccent}AA` : colors.border,
        backgroundColor: outline ? `${boardAccent}0F` : colors.surfaceAlt,
        overflow: 'hidden',
        boxShadow: theme.glow ? `0 0 ${Math.round(width * 0.025)}px ${boardAccent}55` : undefined,
      }}>
      {/* Back/restart and the score row live inside the frame now — the
          panel's own top edge, not a separate row above it. */}
      {header ? <View style={{ paddingHorizontal: space.md, paddingTop: space.sm }}>{header}</View> : null}

      {/* Top-anchored, not centred — blocks start right under the header,
          using the space that used to sit empty above the grid. Whatever
          slack is left over (the grid is column-width-bound, so there
          usually is some) collects below the launcher instead, inside the
          frame's own themed background rather than as a gap above the
          blocks. */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-start' }}>
      <GestureDetector gesture={gesture}>
        <View style={{ width, height: height + LAUNCHER_STRIP }}>
          {/* A faint outline per cell, occupied or not — an empty row used to
              read as bare black; now the whole 9-row grid reads as one
              structured field regardless of how much of it is filled yet. */}
          {Array.from({ length: ROWS }, (_, r) =>
            Array.from({ length: COLUMNS }, (_, c) => (
              <View
                key={`grid-${r}-${c}`}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: c * cell,
                  top: r * cell,
                  width: cell,
                  height: cell,
                  borderWidth: 1,
                  borderRadius: radius.sm,
                  borderColor: outline ? `${boardAccent}22` : `${colors.border}80`,
                }}
              />
            )),
          )}

          {/* A horizontal divider between the blocks' territory and the
              ball's — the nine-row grid above it, the launcher strip below,
              so the two zones read as two zones instead of one tall field
              that happens to have a marker near the bottom. Themed like
              everything else in the frame. */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              top: height - 1,
              width,
              height: 2,
              backgroundColor: boardAccent,
              opacity: outline ? 0.5 : 0.35,
            }}
          />

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
              const shape = original.kind === 'block' ? (original.shape ?? 'square') : 'square';
              return (
                <BlockCell
                  key={key}
                  hp={liveCells.hp[index] ?? 1}
                  maxHp={maxHp}
                  shape={shape}
                  left={left}
                  top={top}
                  size={cell}
                  color={themeColorFor(theme, index, colors.accent)}
                  onAccent={colors.onAccent}
                  style={theme.style}
                  glow={theme.glow}
                />
              );
            }

            // An untouched pickup — original still describes it exactly.
            if (original.kind !== 'ball' && original.kind !== 'gold') return null;
            const isBall = original.kind === 'ball';
            // The amount used to be a hardcoded "+1"/"₺" — now that pickups
            // scale with turn (see curve.ts), showing the real number is
            // what makes a late-run pickup actually read as worth more.
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
                <Text variant="caption" color={isBall ? 'text' : 'warning'} numeric numberOfLines={1}>
                  {isBall ? `+${original.amount ?? 1}` : `₺${original.amount ?? 1}`}
                </Text>
              </View>
            );
          }),
        )}

        {/* Always visible, not just while dragging: where the next shot
            starts from — which is also exactly where the last ball came
            home, since a turn's end sets launchX to that spot. Lives in the
            reserved strip below the field, not on top of it, so it can
            never land on a block even when the stack reaches the floor. A
            small pill (the equipped ball's own colour + the count) sits
            above a collector ring that pulses the instant a ball actually
            lands with something to show for it — "how many, from where,
            and just now" instead of a bare number. */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: height + 4,
            left: markerX,
            width: markerWidth,
            alignItems: 'center',
          }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: space.xs,
              paddingVertical: 2,
              borderRadius: radius.pill,
              borderWidth: 1.5,
              borderColor: outline ? `${boardAccent}99` : colors.border,
              backgroundColor: outline ? `${boardAccent}14` : colors.surface,
            }}>
            <View
              style={{
                width: 9,
                height: 9,
                borderRadius: radius.pill,
                backgroundColor: ball.color,
                borderWidth: 1,
                borderColor: scheme === 'light' ? 'rgba(11,11,15,0.3)' : 'rgba(255,255,255,0.6)',
              }}
            />
            <Text variant="caption" numeric numberOfLines={1} style={{ color: boardAccent, fontWeight: '700' }}>
              ×{formatNumber(ballCount)}
            </Text>
          </View>
          <Animated.View
            style={[
              {
                marginTop: 4,
                width: 16,
                height: 16,
                borderRadius: radius.pill,
                borderWidth: 2,
                borderColor: boardAccent,
                backgroundColor: outline ? `${boardAccent}0F` : colors.surfaceAlt,
                alignItems: 'center',
                justifyContent: 'center',
              },
              collectStyle,
            ]}>
            <View style={{ width: 6, height: 6, borderRadius: radius.pill, backgroundColor: boardAccent }} />
          </Animated.View>
        </View>

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
              borderColor: boardAccent,
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
              backgroundColor: boardAccent,
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
              borderBottomColor: boardAccent,
            }}
          />
        </Animated.View>

          {dots.map((i) => (
            <Dot key={i} index={i} flight={flight} size={ballRadius * 2} ball={ball} scheme={scheme} glow={theme.glow} />
          ))}

          {bursts.map((b) => (
            <Burst key={b.id} left={b.left} top={b.top} color={b.color} />
          ))}
        </View>
      </GestureDetector>
      </View>
    </View>
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
  shape,
  left,
  top,
  size,
  color,
  onAccent,
  style: blockStyle,
  glow,
}: {
  hp: number;
  maxHp: number;
  shape: BlockShape;
  left: number;
  top: number;
  size: number;
  /** Resolved per-cell colour — the theme's accent, or one hue of its palette. */
  color: string;
  onAccent: string;
  style: BoardTheme['style'];
  glow: boolean;
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

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: punch.value }] }));

  // Colour tracks toughness, but the number is always printed: the shade is
  // a hint, the digit is the fact.
  const intensity = Math.min(1, hp / Math.max(1, maxHp));
  const outline = blockStyle === 'outline';

  // Split in two: the outer view owns `exiting` and nothing else, the inner
  // one owns the punch scale and the intensity opacity — Reanimated warns
  // (correctly) that a layout animation and a custom opacity fight over the
  // same view otherwise. ZoomOut rather than a plain fade — a block reaching
  // zero should visibly collapse, not just fade out in place.
  return (
    <Animated.View
      exiting={ZoomOut.duration(duration.base)}
      style={{ position: 'absolute', left, top, width: size, height: size }}>
      {shape === 'square' ? (
        <Animated.View
          style={[
            {
              flex: 1,
              borderRadius: radius.sm,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0.4 + intensity * 0.6,
            },
            outline
              ? {
                  backgroundColor: 'transparent',
                  borderWidth: 2,
                  borderColor: color,
                  boxShadow: glow ? `0 0 ${Math.round(size * 0.22)}px ${color}` : undefined,
                }
              : { backgroundColor: color },
            animatedStyle,
          ]}>
          <Text variant="label" style={{ color: outline ? color : onAccent }}>
            {hp}
          </Text>
        </Animated.View>
      ) : (
        // A triangle is always drawn filled (the border trick that makes it
        // a triangle at all has no clean "outline only" version) — even on a
        // neon theme, just at the same faded-with-damage opacity as squares.
        <Animated.View style={[{ width: size, height: size }, animatedStyle, { opacity: 0.4 + intensity * 0.6 }]}>
          <View pointerEvents="none" style={triangleBorderStyle(shape, size, color)} />
          <Text
            variant="label"
            numeric
            style={{
              position: 'absolute',
              left: triangleCentroid(shape, size).x - 9,
              top: triangleCentroid(shape, size).y - 9,
              width: 18,
              textAlign: 'center',
              color: outline ? color : onAccent,
            }}>
            {hp}
          </Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

/**
 * The classic zero-size-box border trick: two adjacent border widths at
 * `size`, one coloured and the rest transparent, forms a right triangle. The
 * anchor point (where the 0×0 box itself sits) has to be the cell's OWN
 * corner opposite the coloured legs — verified by hand for all four shapes
 * against `game/physics.ts`'s `hitTriangle`, so the picture matches the
 * collision exactly. See the derivation in this session's notes if this
 * ever needs to change; it is easy to get a mirrored or rotated shape here
 * without the numbers actually being wrong anywhere else.
 */
function triangleBorderStyle(shape: 'tl' | 'tr' | 'bl' | 'br', size: number, color: string) {
  const base = {
    position: 'absolute' as const,
    width: 0,
    height: 0,
    borderStyle: 'solid' as const,
  };

  if (shape === 'tr' || shape === 'bl') {
    return {
      ...base,
      left: 0,
      top: 0,
      borderTopWidth: 0,
      borderLeftWidth: 0,
      borderRightWidth: size,
      borderBottomWidth: size,
      borderTopColor: 'transparent',
      borderLeftColor: 'transparent',
      borderRightColor: shape === 'tr' ? color : 'transparent',
      borderBottomColor: shape === 'bl' ? color : 'transparent',
    };
  }

  return {
    ...base,
    left: size,
    top: 0,
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderLeftWidth: size,
    borderBottomWidth: size,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    borderLeftColor: shape === 'tl' ? color : 'transparent',
    borderBottomColor: shape === 'br' ? color : 'transparent',
  };
}

/** Where the hp number sits — the centroid of whichever half of the cell is
 * actually solid, not the cell's own centre. */
function triangleCentroid(shape: 'tl' | 'tr' | 'bl' | 'br', size: number): { x: number; y: number } {
  const third = size / 3;
  switch (shape) {
    case 'tl':
      return { x: third, y: third };
    case 'tr':
      return { x: third * 2, y: third };
    case 'bl':
      return { x: third, y: third * 2 };
    case 'br':
      return { x: third * 2, y: third * 2 };
  }
}

function Dot({
  index,
  flight,
  size,
  ball,
  scheme,
  glow,
}: {
  index: number;
  flight: { value: Flight };
  size: number;
  ball: Ball;
  scheme: 'light' | 'dark';
  /** The board theme's own glow, on top of the rarity glow every ball gets. */
  glow: boolean;
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
  // every ball regardless of what a capsule actually paid for. A neon board
  // theme pushes it further still, to match the blocks' own glow.
  const glowSize = size * (1.7 + Math.min(ball.trail, 12) / 8) * (glow ? 1.15 : 1);

  // The rim used to be a fixed near-white, which all but vanished on the
  // light theme's near-white background — the exact "klasik top" contrast
  // complaint this fixes. Flipping it dark in light mode keeps every ball,
  // not only klasik, readable regardless of theme.
  const rimColor = scheme === 'light' ? 'rgba(11,11,15,0.55)' : 'rgba(255,255,255,0.85)';
  const highlightColor = scheme === 'light' ? 'rgba(11,11,15,0.35)' : 'rgba(255,255,255,0.7)';

  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute' }, style]}>
      {/* Every ball gets a soft glow, not only the ones with a trail — a
          flat-colored dot the size of a fingertip disappears against a
          board full of similarly-toned blocks without one. Rarity just
          makes it bigger. */}
      <View
        style={{
          position: 'absolute',
          left: size / 2 - glowSize / 2,
          top: size / 2 - glowSize / 2,
          width: glowSize,
          height: glowSize,
          borderRadius: glowSize / 2,
          backgroundColor: ball.color,
          opacity: (ball.trail > 0 ? 0.28 : 0.16) * (glow ? 1.3 : 1),
        }}
      />
      {/* A dark ring first, so the ball reads against light blocks and a
          light background alike, then the fill, then a rim on top — three
          tones instead of one flat circle. The ring stays translucent black
          on both schemes (it is a shadow, not a highlight); the rim flips. */}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#00000040',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <View
          style={{
            width: size * 0.86,
            height: size * 0.86,
            borderRadius: (size * 0.86) / 2,
            backgroundColor: ball.color,
            borderWidth: Math.max(1.5, size * 0.12),
            borderColor: rimColor,
          }}
        />
      </View>
      <View
        style={{
          position: 'absolute',
          left: size * 0.24,
          top: size * 0.2,
          width: size * 0.3,
          height: size * 0.3,
          borderRadius: size * 0.15,
          backgroundColor: highlightColor,
        }}
      />
    </Animated.View>
  );
}

/**
 * A short burst of shards flung outward from a broken block, then faded —
 * the referans reference's explosion effect, scaled down to a handful of
 * plain squares instead of a bespoke particle system. Self-contained: it
 * animates once on mount and the parent removes it from state after the
 * same duration, so nothing here needs an `onComplete` round trip.
 */
function Burst({ left, top, color }: { left: number; top: number; color: string }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = timing(1, duration.base);
  }, [progress]);

  const shards = useMemo(() => Array.from({ length: 6 }, (_, i) => (i / 6) * Math.PI * 2), []);

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left, top }}>
      {shards.map((angle, i) => (
        <Shard key={i} angle={angle} progress={progress} color={color} />
      ))}
    </View>
  );
}

function Shard({
  angle,
  progress,
  color,
}: {
  angle: number;
  progress: { value: number };
  color: string;
}) {
  const style = useAnimatedStyle(() => {
    const distance = progress.value * 22;
    return {
      opacity: 1 - progress.value,
      transform: [
        { translateX: Math.cos(angle) * distance - 3 },
        { translateY: Math.sin(angle) * distance - 3 },
        { rotate: `${angle + progress.value * 2}rad` },
        { scale: 1 - progress.value * 0.5 },
      ],
    };
  });

  return (
    <Animated.View
      style={[{ position: 'absolute', width: 6, height: 6, borderRadius: 1.5, backgroundColor: color }, style]}
    />
  );
}
