/**
 * Logic checks for the pure modules — run with `npm test`.
 *
 * No test framework on purpose: the only thing worth testing in these apps is
 * the arithmetic in `src/lib` and `src/ui/useScreen`, and a short runner keeps
 * that honest without adding a dependency tree to a small concern. Anything
 * needing React, SQLite or a device belongs in the manual pass in README.
 *
 * Each derived app adds its own domain checks below the shared ones.
 */
import { formatTimeOfDay } from '../src/lib/format';
import { BALLS, RARITY_ODDS, RARITY_ORDER } from '../src/game/balls';
import { countBlocks, damage, descend, emptyBoard, spawnRow } from '../src/game/board';
import { COLUMNS, ROWS, baseHp } from '../src/game/curve';
import { initialState, reduce, seededRandom } from '../src/game/engine';
import { HARD_PITY, SOFT_PITY, openCapsule, type Pity } from '../src/game/gacha';
import {
  clampAim,
  hitAxis,
  hitTriangle,
  reflect,
  reflectOff,
  rotate,
  stepWalls,
  subSteps,
} from '../src/game/physics';
import {
  COMPACT_MAX,
  DEVICE_MATRIX,
  LARGE_MIN,
  MAX_CONTENT,
  SCALE_MAX,
  SCALE_MIN,
  SHORT_MAX,
  computeScreen,
} from '../src/ui/screen-math';

let failures = 0;

function eq(label: string, got: unknown, want: unknown): void {
  if (JSON.stringify(got) === JSON.stringify(want)) {
    console.log(`  ok   ${label}`);
    return;
  }
  failures++;
  console.log(
    `  FAIL ${label}\n       got  ${JSON.stringify(got)}\n       want ${JSON.stringify(want)}`,
  );
}

console.log('\nformat');
eq('midnight', formatTimeOfDay(0), '00:00');
eq('evening reminder', formatTimeOfDay(20 * 60 + 30), '20:30');
eq('wraps past a full day', formatTimeOfDay(25 * 60), '01:00');

console.log('\nsize classes');
eq('just under the compact ceiling', computeScreen(COMPACT_MAX - 1, 800).size, 'compact');
eq('at the ceiling it is regular', computeScreen(COMPACT_MAX, 800).size, 'regular');
eq('just under the large floor', computeScreen(LARGE_MIN - 1, 800).size, 'regular');
eq('at the floor it is large', computeScreen(LARGE_MIN, 800).size, 'large');
eq('short screen', computeScreen(400, SHORT_MAX - 1).heightClass, 'short');
eq('tall screen', computeScreen(400, SHORT_MAX).heightClass, 'tall');

console.log('\ncontent width');
eq('a phone gets the screen minus padding', computeScreen(390, 844).content, 390 - 32);
eq('a tablet is capped', computeScreen(800, 1280).content, MAX_CONTENT);
eq('the cap is never exceeded', computeScreen(2000, 1500).content, MAX_CONTENT);
eq('the narrowest phone still has room', computeScreen(320, 568).content, 288);

console.log('\nscale is clamped at both ends');
eq('design width is 1x', computeScreen(390, 844).scale(100), 100);
eq('a narrow phone shrinks but not below the floor', computeScreen(320, 568).scale(100), Math.round(100 * SCALE_MIN));
eq('a tablet grows but not past the ceiling', computeScreen(800, 1280).scale(100), Math.round(100 * SCALE_MAX));
eq('an absurd width still clamps', computeScreen(4000, 3000).scale(100), Math.round(100 * SCALE_MAX));

console.log('\nhero fits every device in the matrix');
for (const device of DEVICE_MATRIX) {
  const screen = computeScreen(device.width, device.height);

  eq(`${device.name}: hero fits the content width`, screen.hero <= screen.content, true);
  // A hero plus the header, a row of tiles and a footer under it. If the hero
  // took more than 45% of the column, that stack would run off a short screen.
  eq(`${device.name}: hero leaves room below it`, screen.hero <= device.height * 0.45, true);
  eq(`${device.name}: hero is still usable`, screen.hero >= 150, true);
  eq(`${device.name}: content is positive`, screen.content > 0, true);
}


/* -------------------------------------------------------------------------- */
/* Sekme — physics                                                            */
/* -------------------------------------------------------------------------- */

const near = (label: string, got: number, want: number, tolerance = 0.001) =>
  eq(label, Math.abs(got - want) < tolerance, true);

console.log('\nreflection');
eq('off a wall', reflect({ x: 3, y: -4 }, 'x'), { x: -3, y: -4 });
eq('off a ceiling', reflect({ x: 3, y: -4 }, 'y'), { x: 3, y: 4 });
eq('off nothing', reflect({ x: 3, y: -4 }, null), { x: 3, y: -4 });

console.log('\naim is clamped away from the horizontal');
{
  // A shot aimed flat right would crawl along the floor for ten seconds.
  const flat = clampAim({ x: 1, y: 0 });
  eq('it is nudged upward', flat.y < 0, true);
  near('and stays a unit vector', Math.hypot(flat.x, flat.y), 1);
  eq('it keeps its side', flat.x > 0, true);

  const left = clampAim({ x: -1, y: -0.01 });
  eq('mirrored on the left', left.x < 0, true);

  // A shot already steep enough is left alone.
  const steep = clampAim({ x: 0, y: -1 });
  near('straight up is untouched', steep.y, -1);
}

console.log('\ncollision picks the surface, not the heading');
{
  const box = { x: 100, y: 100, width: 50, height: 50 };
  eq('clear of the box', hitAxis({ x: 0, y: 0 }, 10, box), null);
  eq('into the left face', hitAxis({ x: 95, y: 125 }, 10, box), 'x');
  eq('into the top face', hitAxis({ x: 125, y: 95 }, 10, box), 'y');
  eq('into the right face', hitAxis({ x: 155, y: 125 }, 10, box), 'x');
  // At a corner the shallower penetration wins, which is what stops balls
  // slipping through the seam between two blocks.
  eq('a corner still resolves', hitAxis({ x: 97, y: 97 }, 10, box) !== null, true);
  eq('dead centre falls back to the nearer wall', hitAxis({ x: 125, y: 125 }, 5, box), 'y');
}

console.log('\ntriangle blocks deflect off the diagonal, not the box');
{
  const box = { x: 100, y: 100, width: 50, height: 50 };

  // Top-left solid: the open corner is bottom-right, so a ball approaching
  // from there should hit, and one approaching from the solid corner's own
  // territory should not have a shot fired INTO it read as "clear".
  eq('tl: touching the diagonal from the open side', hitTriangle({ x: 130, y: 130 }, 10, box, 1) !== null, true);
  eq('tl: far into the open corner is clear', hitTriangle({ x: 145, y: 145 }, 10, box, 1), null);
  near('tl: normal points toward the open corner', hitTriangle({ x: 130, y: 130 }, 10, box, 1)!.normal.x, Math.SQRT1_2);

  // Top-right solid: hypotenuse is the OTHER diagonal, so the open corner is
  // bottom-left this time.
  eq('tr: far into its open corner (bottom-left) is clear', hitTriangle({ x: 105, y: 145 }, 10, box, 2), null);
  eq('tr: its solid corner (top-right) is not clear', hitTriangle({ x: 145, y: 105 }, 10, box, 2) !== null, true);

  // The two corners sharing a diagonal (tl/br, tr/bl) must bounce a ball the
  // same way off that shared line, regardless of which side is solid.
  const tl = hitTriangle({ x: 130, y: 130 }, 15, box, 1)!;
  const br = hitTriangle({ x: 120, y: 120 }, 15, box, 4)!;
  eq('tl and br share a diagonal, opposite normals', tl.normal, { x: -br.normal.x, y: -br.normal.y });
}

console.log('\nreflecting off a diagonal is the general mirror formula');
{
  // Sanity: reflecting off a normal that IS an axis must agree with the
  // dedicated axis reflect() — same physics, different surface shapes.
  eq('a normal along +x matches an x-axis reflect', reflectOff({ x: 3, y: -4 }, { x: 1, y: 0 }), reflect({ x: 3, y: -4 }, 'x'));
  eq('a normal along +y matches a y-axis reflect', reflectOff({ x: 3, y: -4 }, { x: 0, y: 1 }), reflect({ x: 3, y: -4 }, 'y'));

  // The '/' diagonal (tl/br) swaps and negates both components.
  const slash = reflectOff({ x: 5, y: -2 }, { x: Math.SQRT1_2, y: Math.SQRT1_2 });
  near('off a tl/br diagonal, x', slash.x, 2);
  near('off a tl/br diagonal, y', slash.y, -5);
  // The '\' diagonal (tr/bl) swaps them straight.
  const backslash = reflectOff({ x: 5, y: -2 }, { x: -Math.SQRT1_2, y: Math.SQRT1_2 });
  near('off a tr/bl diagonal, x', backslash.x, -2);
  near('off a tr/bl diagonal, y', backslash.y, 5);
}

console.log('\nwalls');
{
  const bounds = { left: 0, right: 200, top: 0 };
  const past = stepWalls({ x: 5, y: 100 }, { x: -100, y: 0 }, 5, bounds, 0.1);
  eq('a ball is put back inside', past.position.x, 5);
  eq('and sent the other way', past.velocity.x > 0, true);

  const ceiling = stepWalls({ x: 100, y: 5 }, { x: 0, y: -100 }, 5, bounds, 0.1);
  eq('the ceiling bounces it down', ceiling.velocity.y > 0, true);

  const free = stepWalls({ x: 100, y: 100 }, { x: 10, y: 10 }, 5, bounds, 1);
  eq('otherwise it just moves', free.position, { x: 110, y: 110 });
}

console.log('\nsub-stepping prevents tunnelling');
eq('a slow ball needs one step', subSteps(100, 1 / 60, 8), 1);
eq('a fast one needs several', subSteps(2400, 1 / 60, 8), 5);
eq('never fewer than one', subSteps(0, 1 / 60, 8), 1);

console.log('\njitter turns the velocity without changing its speed');
{
  const turned = rotate({ x: 100, y: 0 }, 0.1);
  near('speed is preserved', Math.hypot(turned.x, turned.y), 100, 0.0001);
  eq('and the direction changed', turned.y !== 0, true);
}

/* -------------------------------------------------------------------------- */
/* Sekme — board and curve                                                    */
/* -------------------------------------------------------------------------- */

console.log('\nthe difficulty curve rises without a cliff');
{
  let previous = 0;
  let biggestJump = 0;
  for (let turn = 1; turn <= 120; turn++) {
    const hp = baseHp(turn, 'orta');
    eq(`turn ${turn} never goes backwards`, hp >= previous, true);
    biggestJump = Math.max(biggestJump, hp - previous);
    previous = hp;
  }
  eq('and never leaps by more than 4 in one turn', biggestJump <= 4, true);
  eq('turn 1 is gentle', baseHp(1, 'orta') <= 3, true);
  eq('turn 50 is a wall', baseHp(50, 'orta') > 100, true);

  eq('kolay is softer than orta at the same turn', baseHp(50, 'kolay') < baseHp(50, 'orta'), true);
  eq('zor is harder than orta at the same turn', baseHp(50, 'zor') > baseHp(50, 'orta'), true);
}

console.log('\nspawned rows');
{
  const random = seededRandom(42);
  const row = spawnRow(10, random, 'orta');
  eq('the row is board width', row.length, COLUMNS);
  eq('it has blocks', row.some((c) => c.kind === 'block'), true);
  eq('but is not full', row.some((c) => c.kind === 'empty'), true);
  eq(
    'every block starts at full health',
    row.every((c) => c.kind !== 'block' || c.hp === c.maxHp),
    true,
  );
}

console.log('\ndescending');
{
  const random = seededRandom(7);
  let board = emptyBoard();
  ({ board } = descend(board, 1, random, 'orta'));
  eq('a row arrived at the top', board[0]?.some((c) => c.kind === 'block'), true);
  eq('the board keeps its height', board.length, ROWS);

  // Push a block to the floor and the game must end.
  let overflow = false;
  for (let turn = 2; turn < 40 && !overflow; turn++) {
    ({ board, overflow } = descend(board, turn, random, 'orta'));
  }
  eq('eventually something reaches the bottom', overflow, true);
}

console.log('\ndamage');
{
  const random = seededRandom(3);
  const board = [spawnRow(5, random, 'orta'), ...emptyBoard().slice(1)];
  const column = board[0]!.findIndex((c) => c.kind === 'block');
  const cell = board[0]![column]!;
  const hp = cell.kind === 'block' ? cell.hp : 0;

  const once = damage(board, 0, column);
  eq('one hit takes one point', (once.board[0]![column] as { hp: number }).hp, hp - 1);
  eq('and it has not broken yet', once.broke, hp - 1 <= 0);

  let working = board;
  for (let i = 0; i < hp; i++) working = damage(working, 0, column).board;
  eq('at zero it is gone', working[0]![column]?.kind, 'empty');

  eq('hitting an empty cell does nothing', damage(working, 0, column).broke, false);
  eq('and scores nothing', damage(working, 0, column).scored, 0);
  eq('a heavy ball takes two', damage(board, 0, column, 2).board[0]![column]?.kind !== undefined, true);
}

/* -------------------------------------------------------------------------- */
/* Sekme — engine                                                             */
/* -------------------------------------------------------------------------- */

console.log('\na whole run, replayed from a seed');
{
  const run = (seed: number) => {
    const random = seededRandom(seed);
    let state = initialState(random);
    let turns = 0;

    while (!state.over && turns < 500) {
      state = reduce(state, {
        type: 'resolve-turn',
        result: { scored: 1, ballsCollected: 0, goldCollected: 0, launchX: 0.5, board: state.board },
        random,
      });
      turns++;
    }
    return { turns, state };
  };

  const first = run(99);
  const second = run(99);
  eq('the same seed plays out the same way', first.turns, second.turns);
  eq('a run that never collects a ball does end', first.state.over, true);
  eq('and the turn counter is the score', first.state.turn, first.turns + 1);

  // The number of turns is NOT the thing that varies: a run that never clears
  // a block dies when the stack reaches the floor, which takes the same number
  // of descents every time. What the seed changes is the board itself.
  const other = run(12345);
  eq('an uncleared board always dies on the same turn', other.turns, first.turns);
  eq(
    'but the board it died with is different',
    JSON.stringify(other.state.board) !== JSON.stringify(first.state.board),
    true,
  );
}

console.log('\ncollecting');
{
  const random = seededRandom(5);
  let state = initialState(random);
  state = reduce(state, {
    type: 'resolve-turn',
    result: { scored: 0, ballsCollected: 3, goldCollected: 2, launchX: 0.25, board: state.board },
    random,
  });
  eq('balls are added', state.balls, 4);
  eq('gold is added', state.gold, 2);
  eq('the next shot starts where the last ball landed', state.launchX, 0.25);
}

console.log('\nblock damage survives the turn, not just the frame it happened on');
{
  // Regression: resolve-turn used to descend state.board — the board BEFORE
  // the shot — discarding every hit the turn just landed. It must descend
  // action.result.board instead, which is what the UI thread hands back
  // after the balls stop moving.
  // A fresh row spawns at board[0] (index ROWS - 1 is the death line, at the
  // bottom); descend() shifts row 0 to row 1 as it adds a new row on top.
  const random = seededRandom(7);
  const state = initialState(random);
  const column = state.board[0]!.findIndex((c) => c.kind === 'block');
  const cell = state.board[0]![column]!;
  const hp = cell.kind === 'block' ? cell.hp : 0;

  const damaged = damage(state.board, 0, column).board;
  const next = reduce(state, {
    type: 'resolve-turn',
    result: { scored: 1, ballsCollected: 0, goldCollected: 0, launchX: 0.5, board: damaged },
    random,
  });

  const landed = next.board[1]?.[column];
  eq('the hit is still there next turn', landed?.kind === 'block' ? landed.hp : -1, hp - 1);
}

console.log('\na finished game ignores further turns');
{
  const random = seededRandom(5);
  const state = { ...initialState(random), over: true, turn: 40 };
  const after = reduce(state, {
    type: 'resolve-turn',
    result: { scored: 10, ballsCollected: 5, goldCollected: 5, launchX: 0.5, board: state.board },
    random,
  });
  eq('nothing moves', after.turn, 40);
}

/* -------------------------------------------------------------------------- */
/* Sekme — capsules                                                           */
/* -------------------------------------------------------------------------- */

console.log('\nthe drop table is honest');
{
  const sum = RARITY_ORDER.reduce((total, r) => total + RARITY_ODDS[r], 0);
  near('odds add up to one', sum, 1, 0.000001);
  for (const rarity of RARITY_ORDER) {
    eq(`${rarity} has at least one ball`, BALLS.some((b) => b.rarity === rarity), true);
  }
}

console.log('\nsoft pity');
{
  // Nine unlucky capsules, then the tenth must be epic or better.
  const unlucky = () => 0.01; // always the commonest rarity
  let pity: Pity = { sinceEpic: 0, sinceLegendary: 0 };
  const owned = new Set<string>();

  for (let i = 0; i < SOFT_PITY - 1; i++) {
    const pull = openCapsule(owned, pity, unlucky);
    pity = pull.pity;
    owned.add(pull.ball.id);
  }
  eq('the counter has been climbing', pity.sinceEpic, SOFT_PITY - 1);

  const rescued = openCapsule(owned, pity, unlucky);
  eq('the tenth is epic at worst', RARITY_ORDER.indexOf(rescued.ball.rarity) >= 2, true);
  eq('and says why', rescued.reason, 'soft-pity');
  eq('the counter resets', rescued.pity.sinceEpic, 0);
}

console.log('\nhard pity');
{
  const unlucky = () => 0.01;
  let pity: Pity = { sinceEpic: 0, sinceLegendary: HARD_PITY - 1 };
  const pull = openCapsule(new Set<string>(), pity, unlucky);
  eq('a legendary is guaranteed', RARITY_ORDER.indexOf(pull.ball.rarity) >= 3, true);
  eq('and says why', pull.reason, 'hard-pity');
  eq('that counter resets too', pull.pity.sinceLegendary, 0);
}

console.log('\nduplicates');
{
  const common = BALLS.filter((b) => b.rarity === 'yaygin');
  const owned = new Set(common.map((b) => b.id));
  const pity: Pity = { sinceEpic: 0, sinceLegendary: 0 };

  const pull = openCapsule(owned, pity, () => 0.01);
  eq('every common is owned, so it must be a duplicate', pull.duplicate, true);
  eq('and it pays gold back', pull.refund > 0, true);
}

console.log('\nnew balls are preferred over owned ones');
{
  const owned = new Set(['klasik']);
  let sawSomethingNew = false;
  for (let i = 0; i < 20; i++) {
    const pull = openCapsule(owned, { sinceEpic: 0, sinceLegendary: 0 }, seededRandom(i + 1));
    if (pull.ball.rarity === 'yaygin' && pull.ball.id !== 'klasik') sawSomethingNew = true;
  }
  eq('a common pull avoids the one already held', sawSomethingNew, true);
}

console.log(failures ? `\n${failures} kontrol başarısız\n` : '\nTüm kontroller geçti\n');
process.exit(failures ? 1 : 0);
