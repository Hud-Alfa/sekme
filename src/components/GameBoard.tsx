import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withSequence,
  withTiming,
  ZoomOut,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Polygon } from 'react-native-svg';

import { LaunchPad, PAD_ROBOT_RATIO } from '@/components/space/LaunchPad';
import { findBall, type Ball } from '@/game/balls';
import { EMPTY, type Board, type BlockShape, type Cell } from '@/game/board';
import {
  AIM_HORIZONTAL_BOOST,
  CLEAR_BOARD_RETURN_SCALE,
  COLUMNS,
  ROWS,
  SPEED_IN_CELLS,
  STUCK,
  TURN_SPEEDUP,
} from '@/game/curve';
import type { TurnResult } from '@/game/engine';
import { clampAim, hitAxisXY, hitTriangle, subSteps, type TriangleCorner } from '@/game/physics';
import { findBoardTheme, themeColorFor, type BoardTheme } from '@/game/themes';
import { playSfx } from '@/lib/audio';
import { formatNumber } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { duration, HIT_SLOP_MIN, radius, settle, space, Text, timing, useColors, useTheme } from '@/ui';

/** A lucky-ball block break pays this much bonus gold, on the spot. Flat
 * rather than turn-scaled — it is a small surprise, not a second income. */
const LUCKY_GOLD_BONUS = 2;
// The anti-stuck jitter angle's sine/cosine, computed once instead of per bounce.
const JITTER_COS = Math.cos(STUCK.jitterRadians);
const JITTER_SIN = Math.sin(STUCK.jitterRadians);
/** Aim ray march step, as a share of a cell — fine enough that the guide
 * stops within a few pixels of the real contact. */
const AIM_STEP_RATIO = 0.05;
/** Gap between aim dots, as a share of a cell. */
const AIM_DOT_SPACING = 0.45;
/** How long a collected pickup's pop plays, in ms. */
const POP_MS = 420;

/** Reserved strip below the play field for the launcher mark and the current
 * ball count, so they never sit on top of a block even when the board is
 * stacked all the way to the floor. */
const LAUNCHER_STRIP = 52;
/** The launcher robot's width as a share of the board's — it scales with the
 * board rather than being a fixed drawing. */
const ROBOT_WIDTH_RATIO = 0.2;
/** How small the robot may shrink on a short phone before the board itself
 * has to narrow — the grid keeps its width, the mascot gives way first. */
export const MIN_ROBOT_WIDTH_RATIO = 0.13;
/** Header row height the frame reserves: the 44 pt buttons plus its padding. */
const HEADER_RESERVE = HIT_SLOP_MIN + space.xl + space.md;

/**
 * The widest board that still fits `frameHeight` with the header, the grid,
 * the launcher strip and a launch pad tall enough for the robot — so a short
 * phone gets a narrower board instead of a robot cut off at the bottom.
 */
export function boardWidthFor(frameHeight: number, maxWidth: number): number {
  const padPerWidth = MIN_ROBOT_WIDTH_RATIO * 1.2 * PAD_ROBOT_RATIO;
  const fit = (frameHeight - HEADER_RESERVE - LAUNCHER_STRIP) / (ROWS / COLUMNS + padPerWidth);
  return Math.max(0, Math.min(maxWidth, fit));
}

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
/**
 * Ceiling on how often a hit/pickup crosses to the JS thread and triggers a
 * board re-render, in seconds. With forty balls out at once nearly every
 * frame changes something, which used to mean up to sixty `setState` calls a
 * second on the WHOLE grid — the JS thread cannot keep up with that, and the
 * result was not a smooth 60fps of small updates but a growing backlog: a
 * block already gone in the physics (`cells.value`, updated every frame
 * regardless) would sit on screen for several frames until React finally
 * caught up, reading as "some blocks don't disappear in time". Capping the
 * RATE of updates — not skipping the final one, `cells.value` and `finish()`
 * never depend on this — means React gets fewer, cheaper renders that it can
 * actually keep up with, so the eventual update lands close to real time
 * instead of queueing.
 */
const REPORT_INTERVAL = 1 / 24;
/**
 * Same idea for the bounce sound, and for the same reason one step earlier:
 * `playSfx` already refuses to retrigger a clip this close together, but the
 * `runOnJS` hop itself is the cost worth avoiding when forty balls are each
 * hitting something several times a second.
 */
const BOUNCE_SOUND_INTERVAL = 1 / 18;
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
  /** The run's own game-over flag — distinct from `locked`, which is also
   * true mid-turn while a shot resolves. Drives the launcher robot's face. */
  over?: boolean;
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
  over,
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
  const outline = theme.style === 'outline';

  // The launcher robot's mood — a block sitting in the very last row is one
  // missed shot away from ending the run, which is the moment "gidişat"
  // (how the run is going) actually turns bad, not some arbitrary fullness
  // threshold. Game-over itself wins over an in-progress board reading.
  const bottomRowFull = (board[ROWS - 1] ?? []).some((c) => c.kind === 'block');
  const mood: 'happy' | 'worried' | 'sad' = over ? 'sad' : bottomRowFull ? 'worried' : 'happy';

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
  // How far the aimed ball travels before its first contact — a wall or a
  // block, never a pickup (those do not deflect). The dotted guide stops
  // exactly there, BBTAN-style, instead of a fixed-length arrow.
  const aimLen = useSharedValue(0);
  const aiming = useSharedValue(0);
  const tally = useSharedValue({ scored: 0, balls: 0, gold: 0 });
  // Throttles how often a hit/pickup crosses to the JS thread — see the
  // frame loop's own comment at the call site for why.
  const lastReportAt = useSharedValue(-REPORT_INTERVAL);
  const lastBounceSoundAt = useSharedValue(-BOUNCE_SOUND_INTERVAL);
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
  // CRITICAL: `cells.value` is reset on the same board change too, but NOT
  // here alongside it — it used to be assigned unconditionally on every
  // render, which looked harmless (`snapshot` is referentially stable within
  // a turn) but was not: `reportProgress` below triggers a React re-render on
  // every hit, and every one of those re-renders was overwriting cells.value
  // back to this turn's STARTING snapshot, erasing whatever the frame loop
  // had just mutated it to. That is why a destroyed block or a collected
  // pickup could come back mid-turn — the damage was real for one frame, then
  // silently undone by the very next render. Gating it on the board change
  // (below) fixed that; it is a plain `useEffect` rather than sharing this
  // `if` with the two React state updates only because a shared value is not
  // React state — writing one during render is a real (if harmless here)
  // Reanimated strict-mode warning, and nothing here needs it to land in
  // this exact render: the frame loop that reads `cells.value` is inactive
  // between turns, and stays that way until the next fired shot, which is
  // well after this effect has already run.
  const [renderedBoard, setRenderedBoard] = useState(board);
  const [liveCells, setLiveCells] = useState<CellsSnapshot>(snapshot);
  if (board !== renderedBoard) {
    setRenderedBoard(board);
    setLiveCells(snapshot);
  }
  useEffect(() => {
    cells.value = snapshot;
    // The board actually caught up — safe to accept a new shot again.
    turnLocked.value = 0;
  }, [snapshot, cells, turnLocked]);

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
      playSfx('kir');
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

  // A pickup no longer just vanishes the instant a ball touches it: the ring
  // pops outward and fades while its "+N" floats up, so the player sees WHAT
  // they just grabbed. Same short-lived-state pattern as `bursts` above.
  const [pops, setPops] = useState<{ id: number; left: number; top: number; label: string; gold: boolean }[]>([]);
  const popId = useRef(0);
  const onPickups = useCallback(
    (list: number[]) => {
      const next: { id: number; left: number; top: number; label: string; gold: boolean }[] = [];
      for (let k = 0; k + 1 < list.length; k += 2) {
        const index = list[k]!;
        const gold = list[k + 1] === 3;
        const amount = amountRef.current[index] ?? 1;
        next.push({
          id: popId.current++,
          left: (index % COLUMNS) * cell + cell / 2,
          top: Math.floor(index / COLUMNS) * cell + cell / 2,
          label: gold ? `₺${amount}` : `+${amount}`,
          gold,
        });
      }
      const ids = new Set(next.map((pop) => pop.id));
      setPops((prev) => [...prev, ...next]);
      setTimeout(() => setPops((prev) => prev.filter((pop) => !ids.has(pop.id))), POP_MS + 50);
    },
    [cell],
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
    if (elapsed.value > STUCK.speedUpAfter) speedScale.value = STUCK.speedUpScale;
    const jitter = elapsed.value > STUCK.jitterAfter;

    // The turn's own acceleration, on top of the stuck-rescue scale above.
    let ramp = 1;
    for (let stage = 0; stage < TURN_SPEEDUP.length; stage++) {
      if (elapsed.value > TURN_SPEEDUP[stage]!.after) ramp = TURN_SPEEDUP[stage]!.scale;
    }

    // Nothing left to hit: the turn is decided, so stop making everyone watch
    // the balls finish. They come home fast instead of bouncing on an empty
    // board, which is the one case where a long flight has nothing to offer.
    const liveKinds = cells.value.kinds;
    let blocksLeft = false;
    for (let index = 0; index < liveKinds.length; index++) {
      if (liveKinds[index] === 1) {
        blocksLeft = true;
        break;
      }
    }

    const current = g.speed * speedScale.value * ramp * (blocksLeft ? 1 : CLEAR_BOARD_RETURN_SCALE);
    const steps = subSteps(current, dt, g.cell * MAX_STEP_RATIO);
    const stepDt = dt / steps;

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
    let bounced = false;
    let pickedBall = false;
    let pickedGold = false;
    // [index, kind, index, kind, …] of pickups grabbed this frame, for
    // the pop animation on the JS side.
    const picked: number[] = [];
    let moving = 0;

    // Every coordinate below is a plain number, not a {x, y} object: this
    // loop runs for every ball × every sub-step × every nearby cell, and the
    // objects it used to allocate were most of the garbage the UI thread had
    // to collect in the middle of a shot. Only a triangle contact (rare, and
    // at most once per sub-step) still builds objects.
    const R = g.ballRadius;
    const C = g.cell;
    const W = g.width;
    const H = g.height;
    const pickupReach = R + g.magnetRadius * C;

    for (let i = 0; i < BALL_POOL; i++) {
      if (live[i] !== 1) continue;

      stuckTimer[i] = (stuckTimer[i] ?? 0) + dt;
      // An empty arena returns everyone the same way a stuck ball is returned
      // — there is nothing left to hit, so the flight has no outcome left.
      const forceReturn = stuckTimer[i]! > STUCK.forceReturnAfter || !blocksLeft;

      let x = px[i]!;
      let y = py[i]!;
      let bvx = vx[i]!;
      let bvy = vy[i]!;

      for (let s = 0; s < steps; s++) {
        if (forceReturn) {
          bvx *= 0.2;
          bvy = Math.abs(bvy) + current;
        }

        // Walls: stepWalls, inlined.
        x += bvx * stepDt;
        y += bvy * stepDt;
        if (x - R < 0) {
          x = R;
          if (bvx < 0) {
            bvx = -bvx;
            bounced = true;
          }
        } else if (x + R > W) {
          x = W - R;
          if (bvx > 0) {
            bvx = -bvx;
            bounced = true;
          }
        }
        if (y - R < 0) {
          y = R;
          if (bvy < 0) {
            bvy = -bvy;
            bounced = true;
          }
        }

        // Only the cells the ball (or its magnet) could possibly be touching.
        const minRow = Math.max(0, Math.floor((y - pickupReach) / C));
        const maxRow = Math.min(ROWS - 1, Math.floor((y + pickupReach) / C));
        const minCol = Math.max(0, Math.floor((x - pickupReach) / C));
        const maxCol = Math.min(COLUMNS - 1, Math.floor((x + pickupReach) / C));

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

            const bx = c * C;
            const by = r * C;

            if (kind !== 1) {
              // Pickups do not deflect: a ball that bounced off a "+1" would
              // punish the player for collecting it. The amount is HELD on
              // this ball, not credited yet — it only counts once the ball
              // that grabbed it actually comes home (below). A pickup reaches
              // out to the magnet radius; a block's hitbox never grows.
              if (hitAxisXY(x, y, pickupReach, bx, by, C) === 0) continue;
              changed = true;
              kinds[index] = 0;
              picked.push(index, kind);
              const pickupAmount = cells.value.amount[index] ?? 1;
              if (kind === 2) {
                ballCredit[i] += pickupAmount;
                pickedBall = true;
              } else {
                goldCredit[i] += pickupAmount;
                pickedGold = true;
              }
              continue;
            }

            const shape = shapes[index] ?? 0;
            const axis = shape === 0 ? hitAxisXY(x, y, R, bx, by, C) : 0;
            const triangleHit =
              shape === 0
                ? null
                : hitTriangle({ x, y }, R, { x: bx, y: by, width: C, height: C }, shape as TriangleCorner);
            if (axis === 0 && triangleHit === null) continue;

            changed = true;
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
            // A pierce roll lets the ball skip reflecting off THIS block -
            // damage above still applies, only the bounce is skipped.
            const pierced = g.pierceChance > 0 && Math.random() < g.pierceChance;
            if (blockHit || pierced) continue;
            blockHit = true;
            bounced = true;

            if (axis !== 0) {
              // Reflecting velocity alone does not move the ball — one that
              // penetrated past a boundary in this sub-step would stay
              // embedded and re-trigger next sub-step. Push it back out.
              if (axis === 1) {
                bvx = -bvx;
                x = x < bx + C / 2 ? bx - R : bx + C + R;
              } else {
                bvy = -bvy;
                y = y < by + C / 2 ? by - R : by + C + R;
              }
            } else if (triangleHit !== null) {
              const nx = triangleHit.normal.x;
              const ny = triangleHit.normal.y;
              const dot = bvx * nx + bvy * ny;
              bvx -= 2 * dot * nx;
              bvy -= 2 * dot * ny;
              const push = R - triangleHit.distance;
              x += nx * push;
              y += ny * push;
            }
            if (jitter) {
              const rx = bvx * JITTER_COS - bvy * JITTER_SIN;
              bvy = bvx * JITTER_SIN + bvy * JITTER_COS;
              bvx = rx;
            }
          }
        }

        if (y + R >= H) {
          live[i] = 2;
          // Unconditional: the next shot starts from wherever the LAST ball
          // came home, and whichever lands last simply overwrites this.
          lastLanding.value = x / W;

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

      px[i] = x;
      py[i] = y;
      vx[i] = bvx;
      vy[i] = bvy;
      if (live[i] === 1) moving += 1;
    }

    cells.value = { kinds, hp, amount: cells.value.amount, shapes: cells.value.shapes };
    flight.value = { px, py, vx, vy, live, queued, releaseTimer, ballCredit, goldCredit, stuckTimer };
    tally.value = { scored, balls: ballsGot, gold: goldGot };

    if (broke) runOnJS(onBreak)(brokeAt);

    // Sound, on the same discipline as the hit bridge above: a pickup is once
    // an event and crosses immediately; a bounce is constant and crosses at a
    // capped rate. A break makes its own noise through `onBreak`, so a bounce
    // that also broke the block stays silent rather than doubling up.
    if (pickedBall) runOnJS(playSfx)('top');
    if (pickedGold) runOnJS(playSfx)('altin');
    if (bounced && !broke && elapsed.value - lastBounceSoundAt.value >= BOUNCE_SOUND_INTERVAL) {
      lastBounceSoundAt.value = elapsed.value;
      runOnJS(playSfx)('sek');
    }
    // A block actually breaking always reports immediately — that is the one
    // moment "did it disappear yet" is judged on. A plain hp tick (still
    // `changed`, nothing `broke`) waits for the next open slot in the rate
    // cap instead of firing on its own frame.
    if (picked.length > 0) runOnJS(onPickups)(picked);
    // A pickup reports at once too, so it vanishes the same frame its pop
    // animation starts instead of up to one throttle slot later.
    if (changed && (broke || picked.length > 0 || elapsed.value - lastReportAt.value >= REPORT_INTERVAL)) {
      lastReportAt.value = elapsed.value;
      runOnJS(reportProgress)(kinds, hp, ballsGot, goldGot);
    }

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

  // March the ball's own circle along the aim from the exact spot the physics
  // launches it, and stop at the first wall or block it would touch. A fine
  // fixed step (a few percent of a cell) is plenty for a guide and only runs
  // when the finger moves, never per frame.
  const castAim = () => {
    'worklet';
    const g = geometry.value;
    const R = g.ballRadius;
    const C = g.cell;
    const kinds = cells.value.kinds;
    const shapes = cells.value.shapes;
    const dx = aim.value.x;
    const dy = aim.value.y;
    const step = C * AIM_STEP_RATIO;
    const limit = (g.width + g.height) * 2;
    let x = launchX * g.width;
    let y = g.height - R - 1;
    let travelled = 0;
    while (travelled < limit) {
      const nx = x + dx * step;
      const ny = y + dy * step;
      if (nx - R < 0 || nx + R > g.width || ny - R < 0) break;
      let hit = false;
      const minRow = Math.max(0, Math.floor((ny - R) / C));
      const maxRow = Math.min(ROWS - 1, Math.floor((ny + R) / C));
      const minCol = Math.max(0, Math.floor((nx - R) / C));
      const maxCol = Math.min(COLUMNS - 1, Math.floor((nx + R) / C));
      for (let r = minRow; r <= maxRow && !hit; r++) {
        for (let c = minCol; c <= maxCol && !hit; c++) {
          const index = r * COLUMNS + c;
          if (kinds[index] !== 1) continue;
          const shape = shapes[index] ?? 0;
          hit =
            shape === 0
              ? hitAxisXY(nx, ny, R, c * C, r * C, C) !== 0
              : hitTriangle({ x: nx, y: ny }, R, { x: c * C, y: r * C, width: C, height: C }, shape as TriangleCorner) !==
                null;
        }
      }
      if (hit) break;
      x = nx;
      y = ny;
      travelled += step;
    }
    aimLen.value = travelled;
  };

  const aimAt = (x: number, y: number) => {
    'worklet';
    // Boosted before the clamp normalises it — the raw offset is capped by
    // the board's own width, which on a 7-column board never let a finger
    // near the middle reach a wide angle no matter how far it dragged.
    aim.value = clampAim({ x: (x - launchX * width) * AIM_HORIZONTAL_BOOST, y: y - height });
    castAim();
  };

  // Dragging back to within this many pixels of the launch point and
  // releasing there cancels the shot instead of firing it — there was
  // previously no way to back out of an aim once a finger touched down.
  // Scaled with the cell so it feels the same size on a phone and a tablet.
  const cancelRadius = Math.max(28, cell * 0.4);

  const dragDistance = (x: number, y: number) => {
    'worklet';
    const dx = x - launchX * width;
    const dy = y - height;
    return Math.sqrt(dx * dx + dy * dy);
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
      // Dims the line while inside the cancel zone — releasing now reads as
      // "this shot won't fire" before it happens, not a surprise after.
      aiming.value = dragDistance(event.x, event.y) < cancelRadius ? 0.3 : 1;
    })
    .onEnd((event) => {
      'worklet';
      // Hidden before the lock check, not after: a turn that locked while the
      // finger was still down used to leave the guide stuck on screen.
      aiming.value = timing(0, duration.fast);
      if (flying.value === 1 || turnLocked.value === 1 || locked) return;

      if (dragDistance(event.x, event.y) < cancelRadius) return;

      flight.value = { ...emptyFlight(), queued: Math.min(ballCount, BALL_POOL) };
      tally.value = { scored: 0, balls: 0, gold: 0 };
      elapsed.value = 0;
      speedScale.value = 1;
      lastLanding.value = -1;
      lastReportAt.value = -REPORT_INTERVAL;
      flying.value = 1;
      runOnJS(setInFlight)(true);
    })
    // A cancelled gesture (another touch, the screen leaving) never reaches
    // onEnd; this always runs, so the guide can never outlive the finger.
    .onFinalize(() => {
      'worklet';
      aiming.value = timing(0, duration.fast);
    });

  /* ---- rendering ------------------------------------------------------- */

  const collectStyle = useAnimatedStyle(() => ({ transform: [{ scale: collectPulse.value }] }));

  // Visible boundary for the cancel zone above — shown for as long as the
  // aim line is, so the "drag back to cancel" gesture is something a player
  // can see and learn, not a hidden trick they stumble into.
  const cancelRingStyle = useAnimatedStyle(() => ({ opacity: aiming.value > 0 ? 0.35 : 0 }));

  // One view per ball actually owned, not the whole pool: each Dot runs an
  // animated-style mapper every frame of a shot, and an early run with five
  // balls has no reason to pay for sixty.
  const dotCount = Math.min(BALL_POOL, Math.max(1, ballCount));
  const dots = useMemo(() => Array.from({ length: dotCount }, (_, i) => i), [dotCount]);
  const aimDots = useMemo(
    () => Array.from({ length: Math.ceil(Math.hypot(COLUMNS, ROWS) / AIM_DOT_SPACING) }, (_, i) => i),
    [],
  );

  // The 63 faint cell outlines never change during a shot, but they sat
  // inline in this render — every mid-shot hit report rebuilt all of them.
  // Memoised, React skips the whole subtree on those re-renders.
  const gridLines = useMemo(
    () =>
      Array.from({ length: ROWS }, (_, r) =>
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
      ),
    [cell, outline, boardAccent, colors.border],
  );

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

  return (
    <View
      style={{
        width,
        height: framed,
        alignSelf: 'center',
        borderRadius: radius.xl,
        borderWidth: 2,
        borderColor: outline ? `${boardAccent}AA` : colors.border,
        backgroundColor: outline ? `${colors.bg}B3` : `${colors.surfaceAlt}C7`,
        overflow: 'hidden',
        boxShadow: theme.glow ? `0 0 ${Math.round(width * 0.025)}px ${boardAccent}55` : undefined,
      }}>
      {/* Back/restart and the score row live inside the frame now — the
          panel's own top edge, not a separate row above it. */}
      {header ? <View style={{ paddingHorizontal: space.md, paddingTop: space.xl }}>{header}</View> : null}

      {/* Grid right under the header, then the launch pad taking whatever
          height is left: the leftover space on a tall phone becomes the
          robot's ground instead of blank bands above and below the grid. */}
      <View style={{ flex: 1, alignItems: 'center', paddingTop: space.md }}>
      <GestureDetector gesture={gesture}>
        <View style={{ width, height: height + LAUNCHER_STRIP }}>
          {/* A faint outline per cell, occupied or not — an empty row used to
              read as bare black; now the whole 9-row grid reads as one
              structured field regardless of how much of it is filled yet. */}
          {gridLines}

          {/* A horizontal divider between the blocks' territory and the
              ball's - the nine-row grid above it, the launcher strip below,
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
              const hp = liveCells.hp[index] ?? 1;
              return (
                <BlockCell
                  key={key}
                  hp={hp}
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
                <Text
                  variant="caption"
                  color={isBall ? 'text' : 'warning'}
                  numeric
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={{ width: ballRadius * 3 - space.xs, textAlign: 'center' }}>
                  {isBall ? `+${original.amount ?? 1}` : `₺${original.amount ?? 1}`}
                </Text>
              </View>
            );
          }),
        )}

        {/* A triangle's hp number, drawn as its own pass instead of inside
            BlockCell next to the triangle shape - see the long comment in
            BlockCell for why that combination made the text invisible. */}
        {board.map((row, r) =>
          row.map((original, c) => {
            const index = r * COLUMNS + c;
            if ((liveCells.kinds[index] ?? 0) !== 1) return null;
            const shape = original.kind === 'block' ? (original.shape ?? 'square') : 'square';
            if (shape === 'square') return null;

            const centroid = triangleCentroid(shape, cell);
            // Same colour and fade rule a square's own number follows: on an
            // outline theme the digit takes the block's colour, because
            // `onAccent` over a hollow cell is the board's background.
            const blockColor = themeColorFor(theme, index, colors.accent);
            const hp = liveCells.hp[index] ?? 1;
            const maxHp = original.kind === 'block' ? original.maxHp : 1;
            return (
              <Text
                key={`num-${r}-${c}`}
                variant="label"
                numeric
                style={{
                  position: 'absolute',
                  left: c * cell + centroid.x - 9,
                  top: r * cell + centroid.y - 9,
                  width: 18,
                  textAlign: 'center',
                  color: outline ? blockColor : colors.onAccent,
                  opacity: 0.4 + Math.min(1, hp / Math.max(1, maxHp)) * 0.6,
                }}>
                {hp}
              </Text>
            );
          }),
        )}

        {/* Always visible, not just while dragging: where the next shot
            starts from - which is also exactly where the last ball came
            home, since a turn's end sets launchX to that spot. Lives in the
            reserved strip below the field, not on top of it, so it can
            never land on a block even when the stack reaches the floor. A
            small pill (the equipped ball's own colour + the count) sits
            above a collector ring that pulses the instant a ball actually
            lands with something to show for it - "how many, from where,
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

        {/* The cancel zone itself — a dashed ring around the launch point.
            Dragging back inside it and letting go cancels the shot; the
            aim line dims to confirm once you're actually inside it. */}
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: launchX * width - cancelRadius,
              top: height - cancelRadius,
              width: cancelRadius * 2,
              height: cancelRadius * 2,
              borderRadius: cancelRadius,
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: boardAccent,
            },
            cancelRingStyle,
          ]}
        />

        {/* The aim guide: dots from the launch point to the first thing the
            ball would touch, then a ghost of the ball sitting at that
            contact. Stops short on purpose — it shows the first bounce,
            not the whole route. */}
        {aimDots.map((i) => (
          <AimDot
            key={i}
            index={i}
            spacing={cell * AIM_DOT_SPACING}
            size={Math.max(3, ballRadius * 0.9)}
            originX={launchX * width}
            originY={height - ballRadius - 1}
            aim={aim}
            aimLen={aimLen}
            aiming={aiming}
            color={boardAccent}
          />
        ))}
        <AimGhost
          size={ballRadius * 2}
          originX={launchX * width}
          originY={height - ballRadius - 1}
          aim={aim}
          aimLen={aimLen}
          aiming={aiming}
          color={boardAccent}
        />

          {dots.map((i) => (
            <Dot key={i} index={i} flight={flight} size={ballRadius * 2} ball={ball} scheme={scheme} glow={theme.glow} />
          ))}

          {bursts.map((b) => (
            <Burst key={b.id} left={b.left} top={b.top} color={b.color} />
          ))}

          {pops.map((pop) => (
            <PickupPop
              key={pop.id}
              left={pop.left}
              top={pop.top}
              size={ballRadius * 3}
              label={pop.label}
              color={pop.gold ? colors.warning : colors.text}
            />
          ))}
        </View>
      </GestureDetector>

      <LaunchPad
        width={width}
        launchX={launchX}
        robotSize={width * ROBOT_WIDTH_RATIO}
        minRobotSize={width * MIN_ROBOT_WIDTH_RATIO}
        accent={boardAccent}
        ballColor={ball.color}
        mood={mood}
        trims={theme.palette}
      />
      </View>
    </View>
  );
}

/** Outline weight shared by both block shapes, so a triangle carries the
 * same visual line as the square standing next to it. */
const STROKE = 2;

/**
 * A block. Hit feedback (a quick punch) and break feedback (fade and shrink
 * away) both live here now instead of only showing up once a turn away —
 * `exiting` fires the moment React stops rendering this cell, which is
 * exactly the frame `liveCells` reports it broken.
 */
// Memoised: a mid-shot hit report re-renders the board, but only the
// cells whose hp actually changed need to redraw — the rest compare equal.
const BlockCell = memo(BlockCellImpl);

function BlockCellImpl({
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
        // Hollow on a neon theme, the same way a square block is — outline
        // only, with the same glow — instead of always solid fill regardless
        // of theme. SVG draws the exact three vertices `hitTriangle` treats
        // as the solid half of the cell (`trianglePoints`), so there is no
        // separate "does the drawn shape match the collision shape" question
        // the old CSS border-trick kept getting wrong.
        //
        // The hp NUMBER is deliberately not drawn in here. It used to be an
        // absolutely-positioned Text right next to the border-trick View
        // this replaced — and on this renderer, that combination made the
        // text never paint at all, at any colour, at any zIndex/elevation
        // (confirmed live: a bright lime background + huge red digits still
        // didn't show with that triangle View present as a sibling; removing
        // the sibling made the exact same Text appear instantly). Untested
        // whether an SVG sibling has the same problem, so the number stays
        // split out via `TriangleNumber` at the grid level rather than
        // re-risking a bug that took a while to pin down the first time.
        <Animated.View
          style={[
            { width: size, height: size },
            animatedStyle,
            { opacity: 0.4 + intensity * 0.6 },
          ]}>
          <Svg width={size} height={size} pointerEvents="none">
            {/* The halo a square gets from `boxShadow`, which a transparent
                View with an SVG child does not paint: a wider, translucent
                stroke under the crisp one. */}
            {outline && glow ? (
              <Polygon
                points={trianglePoints(shape, size, STROKE * 1.5)}
                fill="transparent"
                stroke={color}
                strokeOpacity={0.35}
                strokeWidth={STROKE * 3}
                strokeLinejoin="round"
              />
            ) : null}
            <Polygon
              points={trianglePoints(shape, size, outline ? STROKE / 2 : 0)}
              fill={outline ? 'transparent' : color}
              stroke={outline ? color : 'none'}
              strokeWidth={outline ? STROKE : 0}
              strokeLinejoin="round"
            />
          </Svg>
        </Animated.View>
      )}
    </Animated.View>
  );
}

/**
 * The three corners of whichever half of the cell `hitTriangle` (in
 * `game/physics.ts`) treats as solid, as an SVG `points` string — drawing
 * the collision shape directly rather than approximating it with a CSS
 * border trick removes the entire class of "does the drawn shape match the
 * physics shape" bug a previous version of this kept getting wrong (a
 * mirrored diagonal on two of the four shapes, then a shape rendered
 * entirely outside its own cell on the other two).
 *
 * `inset` pulls the outline in by half its own stroke width. An SVG stroke
 * straddles the path, so the two legs — which sit exactly on the cell's
 * edges — were having their outer half clipped by the viewport, leaving a
 * triangle that read as a bare diagonal next to fully drawn squares. The
 * collision shape (`hitTriangle`) still uses the true corners; this is a
 * sub-pixel drawing offset, not a different triangle.
 */
function trianglePoints(shape: 'tl' | 'tr' | 'bl' | 'br', size: number, inset = 0): string {
  const lo = inset;
  const hi = size - inset;
  const corners: Record<'tl' | 'tr' | 'bl' | 'br', [number, number][]> = {
    tl: [
      [lo, lo],
      [hi, lo],
      [lo, hi],
    ],
    tr: [
      [lo, lo],
      [hi, lo],
      [hi, hi],
    ],
    bl: [
      [lo, lo],
      [lo, hi],
      [hi, hi],
    ],
    br: [
      [hi, lo],
      [lo, hi],
      [hi, hi],
    ],
  };
  return corners[shape].map(([x, y]) => `${x},${y}`).join(' ');
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
  // it just never reached a view. Toned down from the first version of this,
  // which gave every ball the same fairly large, fairly bright halo: fine
  // for one ball, but forty of them overlapping read as visual noise rather
  // than forty distinct balls. Common balls (no trail) now barely glow at
  // all; the halo is where rarity actually shows.
  const glowSize = size * (1.3 + Math.min(ball.trail, 12) / 10) * (glow ? 1.1 : 1);
  const glowOpacity = (ball.trail > 0 ? 0.22 : 0.08) * (glow ? 1.2 : 1);

  // The rim used to be a fixed near-white, which all but vanished on the
  // light theme's near-white background — the exact "klasik top" contrast
  // complaint this fixes. Flipping it dark in light mode keeps every ball,
  // not only klasik, readable regardless of theme.
  const rimColor = scheme === 'light' ? 'rgba(11,11,15,0.55)' : 'rgba(255,255,255,0.85)';

  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute' }, style]}>
      {/* Every ball still gets a soft glow, just a much quieter one than
          before - a flat-colored dot the size of a fingertip disappears
          against a board full of similarly-toned blocks without one, but
          the glow only needs to be a hint, not a second circle. */}
      <View
        style={{
          position: 'absolute',
          left: size / 2 - glowSize / 2,
          top: size / 2 - glowSize / 2,
          width: glowSize,
          height: glowSize,
          borderRadius: glowSize / 2,
          backgroundColor: ball.color,
          opacity: glowOpacity,
        }}
      />
      {/* One ringed circle instead of three stacked views (a dark backing
          ring, a fill, and a specular highlight) - the border alone still
          reads against both light and dark surfaces, since `rimColor`
          already flips per scheme, and cutting the other two views is most
          of what actually reduces the clutter when many balls overlap. */}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: ball.color,
          borderWidth: Math.max(1.5, size * 0.12),
          borderColor: rimColor,
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

type AimProps = {
  originX: number;
  originY: number;
  aim: SharedValue<{ x: number; y: number }>;
  aimLen: SharedValue<number>;
  aiming: SharedValue<number>;
  color: string;
};

/** One dot of the aim guide, shown only while it is short of the first contact. */
function AimDot({ index, spacing, size, originX, originY, aim, aimLen, aiming, color }: AimProps & {
  index: number;
  spacing: number;
  size: number;
}) {
  const style = useAnimatedStyle(() => {
    const d = spacing * (index + 1);
    const visible = d < aimLen.value - size;
    return {
      // Fades a little toward the far end so the near dots lead the eye.
      opacity: visible ? aiming.value * (1 - (0.45 * d) / Math.max(aimLen.value, 1)) : 0,
      transform: [
        { translateX: originX + aim.value.x * d - size / 2 },
        { translateY: originY + aim.value.y * d - size / 2 },
      ],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', left: 0, top: 0, width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        style,
      ]}
    />
  );
}

/** A hollow ball where the aimed shot first touches something. */
function AimGhost({ size, originX, originY, aim, aimLen, aiming, color }: AimProps & { size: number }) {
  const style = useAnimatedStyle(() => ({
    opacity: aiming.value * 0.9,
    transform: [
      { translateX: originX + aim.value.x * aimLen.value - size / 2 },
      { translateY: originY + aim.value.y * aimLen.value - size / 2 },
    ],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: 0,
          top: 0,
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: color,
        },
        style,
      ]}
    />
  );
}

/**
 * A collected pickup going away: its ring swells and fades while the amount
 * floats upward. Mounts at the pickup's own cell centre, plays once, and the
 * parent drops it after `POP_MS`.
 */
function PickupPop({ left, top, size, label, color }: { left: number; top: number; size: number; label: string; color: string }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: POP_MS, easing: Easing.out(Easing.cubic) });
  }, [t]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 1 - t.value,
    transform: [{ scale: 1 + t.value * 0.9 }],
  }));
  const labelStyle = useAnimatedStyle(() => ({
    opacity: t.value < 0.5 ? 1 : 2 - t.value * 2,
    transform: [{ translateY: -t.value * size * 1.4 }, { scale: 1 + t.value * 0.3 }],
  }));

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: left - size / 2, top: top - size / 2, width: size, height: size }}>
      <Animated.View
        style={[
          { position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: color },
          ringStyle,
        ]}
      />
      <Animated.View style={[{ position: 'absolute', width: size * 2, left: -size / 2, top: 0, alignItems: 'center' }, labelStyle]}>
        <Text variant="label" numeric numberOfLines={1} style={{ color }}>
          {label}
        </Text>
      </Animated.View>
    </View>
  );
}
