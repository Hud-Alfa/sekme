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
