/**
 * Ball motion and collision. Pure maths, no state, no React.
 *
 * Every function here carries the 'worklet' directive so the same code runs on
 * the UI thread inside a Reanimated frame callback — the physics cannot live on
 * the JS thread, because with forty balls in flight a single React render would
 * drop the frame and the game with it. Being pure is also what lets `npm test`
 * check the maths without a device.
 *
 * There is no gravity. Balls travel at constant speed and reflect; that is the
 * genre, and it is also what keeps the step function stable at any frame time.
 */

export type Vec = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };

/** Which side of a box was struck. */
export type Axis = 'x' | 'y' | null;

export function unit(from: Vec, to: Vec): Vec {
  'worklet';
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length === 0) return { x: 0, y: -1 };
  return { x: dx / length, y: dy / length };
}

/**
 * Clamps an aim direction away from the horizontal.
 *
 * A ball fired at 1° above the floor takes an age to come back and looks like a
 * bug. Every game in this genre clamps; the value is how much it feels like
 * cheating (too much) or a waste of a shot (too little).
 */
export function clampAim(direction: Vec, minAngleFromHorizon = 0.18): Vec {
  'worklet';
  const length = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
  if (length === 0) return { x: 0, y: -1 };

  const x = direction.x / length;
  const y = direction.y / length;

  // Up is negative y; a shot must always have some upward component.
  if (y > -minAngleFromHorizon) {
    const clampedY = -minAngleFromHorizon;
    const clampedX = Math.sign(x || 1) * Math.sqrt(Math.max(0, 1 - clampedY * clampedY));
    return { x: clampedX, y: clampedY };
  }

  return { x, y };
}

/** Reflects a velocity off a vertical ('x') or horizontal ('y') surface. */
export function reflect(velocity: Vec, axis: Axis): Vec {
  'worklet';
  if (axis === 'x') return { x: -velocity.x, y: velocity.y };
  if (axis === 'y') return { x: velocity.x, y: -velocity.y };
  return velocity;
}

/**
 * Rotates a velocity by a small angle. Used by the anti-stuck jitter: a ball
 * trapped in a perfectly flat corridor needs its angle broken, not its speed.
 */
export function rotate(velocity: Vec, radians: number): Vec {
  'worklet';
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: velocity.x * cos - velocity.y * sin,
    y: velocity.x * sin + velocity.y * cos,
  };
}

/**
 * Does a circle overlap a box, and if so which axis should it bounce off?
 *
 * The axis comes from the overlap depths rather than from the ball's heading:
 * at a corner the shallower penetration is the surface actually struck, and
 * choosing by heading makes corners send balls through blocks.
 */
export function hitAxis(centre: Vec, radius: number, box: Rect): Axis {
  'worklet';
  const nearestX = Math.max(box.x, Math.min(centre.x, box.x + box.width));
  const nearestY = Math.max(box.y, Math.min(centre.y, box.y + box.height));

  const dx = centre.x - nearestX;
  const dy = centre.y - nearestY;

  if (dx * dx + dy * dy > radius * radius) return null;

  // Fully inside: fall back to whichever wall is closer.
  if (dx === 0 && dy === 0) {
    const left = centre.x - box.x;
    const right = box.x + box.width - centre.x;
    const top = centre.y - box.y;
    const bottom = box.y + box.height - centre.y;
    return Math.min(left, right) < Math.min(top, bottom) ? 'x' : 'y';
  }

  return Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
}

/**
 * `hitAxis` without the objects: the same answer (0 none, 1 'x', 2 'y') for a
 * square cell at (bx, by) of side `size`, taking and returning plain numbers.
 *
 * The frame loop calls this for every ball × every nearby cell × every
 * sub-step — thousands of times a frame with forty balls out. Allocating a
 * centre and a box object for each call was the bulk of the garbage the UI
 * thread had to collect mid-shot; `hitAxis` stays for everything else and
 * the tests pin the two to the same answers.
 */
export function hitAxisXY(cx: number, cy: number, radius: number, bx: number, by: number, size: number): 0 | 1 | 2 {
  'worklet';
  const nearestX = cx < bx ? bx : cx > bx + size ? bx + size : cx;
  const nearestY = cy < by ? by : cy > by + size ? by + size : cy;
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  if (dx * dx + dy * dy > radius * radius) return 0;
  if (dx === 0 && dy === 0) {
    const horizontal = Math.min(cx - bx, bx + size - cx);
    const vertical = Math.min(cy - by, by + size - cy);
    return horizontal < vertical ? 1 : 2;
  }
  return Math.abs(dx) > Math.abs(dy) ? 1 : 2;
}

/**
 * The four ways a right-triangle block can sit in a cell — named for which
 * corner is solid ground; the other three corners are open. Two of the
 * triangle's sides are legs lying along the cell's own edges; the third is
 * the diagonal hypotenuse. All three are solid and all three are checked.
 */
export type TriangleCorner = 1 | 2 | 3 | 4; // top-left, top-right, bottom-left, bottom-right

export type TriangleHit = { normal: Vec; distance: number };

/** The three corners of the solid half, in cell-local coordinates. */
function triangleCorners(corner: TriangleCorner, s: number): Vec[] {
  'worklet';
  if (corner === 1) return [{ x: 0, y: 0 }, { x: s, y: 0 }, { x: 0, y: s }];
  if (corner === 2) return [{ x: 0, y: 0 }, { x: s, y: 0 }, { x: s, y: s }];
  if (corner === 3) return [{ x: 0, y: 0 }, { x: 0, y: s }, { x: s, y: s }];
  return [{ x: s, y: 0 }, { x: 0, y: s }, { x: s, y: s }];
}

/** The point on segment a→b nearest to p. */
function nearestOnSegment(p: Vec, a: Vec, b: Vec): Vec {
  'worklet';
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSquared = abx * abx + aby * aby;
  if (lengthSquared === 0) return a;
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / lengthSquared;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return { x: a.x + abx * t, y: a.y + aby * t };
}

/**
 * Circle-vs-triangle collision, against the whole solid shape.
 *
 * This used to measure the perpendicular distance to the hypotenuse LINE and
 * nothing else, on the reasoning that a triangle's two legs sit on the cell's
 * edges and so "behave like a square block's faces". They do not: nothing
 * else ever checked them, so a ball arriving at a leg from outside the cell
 * passed straight through the block, and — because an infinite line has no
 * ends — a ball well outside the cell entirely could still report a hit and
 * bounce off nothing. Both were visible in play.
 *
 * Now the real shape decides: the nearest point on the triangle (its three
 * SEGMENTS, plus the inside case) gives both the distance and the normal, so
 * every solid side deflects and no empty space does.
 *
 * `distance` stays signed the same way as before — negative means the centre
 * is already inside the solid corner, which sub-stepping should prevent but
 * which is pushed back out the same way regardless.
 */
export function hitTriangle(
  centre: Vec,
  radius: number,
  box: Rect,
  corner: TriangleCorner,
): TriangleHit | null {
  'worklet';
  const s = box.width; // cells are always square — width === height
  const p = { x: centre.x - box.x, y: centre.y - box.y };

  // Cheap reject: the cell's bounding box, grown by the radius. An infinite
  // line had no such bound, which is exactly how phantom hits got through.
  if (p.x < -radius || p.y < -radius || p.x > s + radius || p.y > s + radius) return null;

  const corners = triangleCorners(corner, s);
  const a = corners[0]!;
  const b = corners[1]!;
  const c = corners[2]!;

  // Inside test by edge sign. The corner lists above are wound consistently,
  // so all three cross products share a sign for an interior point.
  const d1 = (p.x - a.x) * (b.y - a.y) - (p.y - a.y) * (b.x - a.x);
  const d2 = (p.x - b.x) * (c.y - b.y) - (p.y - b.y) * (c.x - b.x);
  const d3 = (p.x - c.x) * (a.y - c.y) - (p.y - c.y) * (a.x - c.x);
  const inside = (d1 <= 0 && d2 <= 0 && d3 <= 0) || (d1 >= 0 && d2 >= 0 && d3 >= 0);

  let nearest = nearestOnSegment(p, a, b);
  let best = (p.x - nearest.x) * (p.x - nearest.x) + (p.y - nearest.y) * (p.y - nearest.y);

  const second = nearestOnSegment(p, b, c);
  const secondDistance = (p.x - second.x) * (p.x - second.x) + (p.y - second.y) * (p.y - second.y);
  if (secondDistance < best) {
    best = secondDistance;
    nearest = second;
  }

  const third = nearestOnSegment(p, c, a);
  const thirdDistance = (p.x - third.x) * (p.x - third.x) + (p.y - third.y) * (p.y - third.y);
  if (thirdDistance < best) {
    best = thirdDistance;
    nearest = third;
  }

  const gap = Math.sqrt(best);
  if (!inside && gap > radius) return null;

  // Outward normal: from the surface toward the centre. Inside, that vector
  // points the wrong way (the centre is behind the surface), so it flips.
  let nx = p.x - nearest.x;
  let ny = p.y - nearest.y;
  if (gap > 0) {
    nx /= gap;
    ny /= gap;
  } else {
    // Dead on the edge: fall back to the direction away from the solid
    // corner's centroid, which is never zero.
    const cx = (a.x + b.x + c.x) / 3;
    const cy = (a.y + b.y + c.y) / 3;
    const length = Math.hypot(p.x - cx, p.y - cy) || 1;
    nx = (p.x - cx) / length;
    ny = (p.y - cy) / length;
  }

  if (inside) return { normal: { x: -nx, y: -ny }, distance: -gap };
  return { normal: { x: nx, y: ny }, distance: gap };
}

/** Reflects a velocity off an arbitrary unit normal — the general mirror
 * formula, for the diagonal surfaces `reflect` (axis-only) cannot express. */
export function reflectOff(velocity: Vec, normal: Vec): Vec {
  'worklet';
  const dot = velocity.x * normal.x + velocity.y * normal.y;
  return { x: velocity.x - 2 * dot * normal.x, y: velocity.y - 2 * dot * normal.y };
}

/** Circle-to-circle overlap, for pickups. */
export function circlesOverlap(a: Vec, aRadius: number, b: Vec, bRadius: number): boolean {
  'worklet';
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const reach = aRadius + bRadius;
  return dx * dx + dy * dy <= reach * reach;
}

export type WallBounds = { left: number; right: number; top: number };

/**
 * Advances one ball by `dt` seconds and bounces it off the side and top walls.
 *
 * Movement is split into small sub-steps so a fast ball cannot tunnel through a
 * block between frames. The cap is on distance travelled, not on frame time,
 * which is what makes the behaviour identical at 60 and 120 Hz.
 */
export function stepWalls(
  position: Vec,
  velocity: Vec,
  radius: number,
  bounds: WallBounds,
  dt: number,
): { position: Vec; velocity: Vec } {
  'worklet';
  let x = position.x + velocity.x * dt;
  let y = position.y + velocity.y * dt;
  let vx = velocity.x;
  let vy = velocity.y;

  if (x - radius < bounds.left) {
    x = bounds.left + radius;
    vx = Math.abs(vx);
  } else if (x + radius > bounds.right) {
    x = bounds.right - radius;
    vx = -Math.abs(vx);
  }

  if (y - radius < bounds.top) {
    y = bounds.top + radius;
    vy = Math.abs(vy);
  }

  return { position: { x, y }, velocity: { x: vx, y: vy } };
}

/**
 * How many sub-steps a frame needs so no ball moves more than `maxStep` pixels
 * at a time. Tunnelling is the one physics bug players call cheating.
 */
export function subSteps(speed: number, dt: number, maxStep: number): number {
  'worklet';
  const distance = speed * dt;
  return Math.max(1, Math.ceil(distance / maxStep));
}
