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
 * The four ways a right-triangle block can sit in a cell — named for which
 * corner is solid ground; the other three corners are open. The triangle's
 * two legs run along the cell's own edges (indistinguishable from a square
 * block there, so nothing extra is needed); the only new surface is the
 * diagonal hypotenuse, which is what `hitTriangle` checks.
 */
export type TriangleCorner = 1 | 2 | 3 | 4; // top-left, top-right, bottom-left, bottom-right

export type TriangleHit = { normal: Vec; distance: number };

/**
 * Circle-vs-diagonal collision. `distance` is the signed perpendicular
 * distance from the circle's centre to the hypotenuse LINE (not the
 * segment) — negative means the centre has already crossed into the solid
 * corner, which sub-stepping should prevent but which is still handled the
 * same way as a shallow touch: bounce it back out.
 *
 * The four normals were derived once, by hand, from which half-plane of each
 * diagonal is solid — `npm test` pins them so a future edit here cannot
 * silently flip a triangle's bounce direction.
 */
export function hitTriangle(
  centre: Vec,
  radius: number,
  box: Rect,
  corner: TriangleCorner,
): TriangleHit | null {
  'worklet';
  const dx = centre.x - box.x;
  const dy = centre.y - box.y;
  const s = box.width; // cells are always square — width === height

  let raw: number;
  let normal: Vec;
  if (corner === 1) {
    // top-left solid (legs on the top and left edges); hypotenuse runs
    // top-right to bottom-left.
    raw = dx + dy - s;
    normal = { x: Math.SQRT1_2, y: Math.SQRT1_2 };
  } else if (corner === 4) {
    // bottom-right solid; same diagonal as top-left, opposite side.
    raw = s - dx - dy;
    normal = { x: -Math.SQRT1_2, y: -Math.SQRT1_2 };
  } else if (corner === 2) {
    // top-right solid (legs on the top and right edges); hypotenuse runs
    // top-left to bottom-right.
    raw = dy - dx;
    normal = { x: -Math.SQRT1_2, y: Math.SQRT1_2 };
  } else {
    // bottom-left solid; same diagonal as top-right, opposite side.
    raw = dx - dy;
    normal = { x: Math.SQRT1_2, y: -Math.SQRT1_2 };
  }

  const distance = raw * Math.SQRT1_2;
  if (distance > radius) return null;
  return { normal, distance };
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
