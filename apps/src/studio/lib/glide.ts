import type { FootprintVertex } from "@galleryis/shared";
import { resolveMovement } from "./collision";
import type { Rect } from "./geometry";

// Eased tap-to-move glide, resolved through the collision layer every frame,
// a straight-line lerp could cut a concave corner of these footprints, and the
// per-frame resolve inherits wall-stop/wall-slide behaviour instead.

const PEAK_SPEED = 5; // m/s mid-glide (~2× walk speed)
const MIN_SPEED = 0.9; // m/s at either end so the glide still arrives
const EASE_IN = 5; // (m/s) gained per metre travelled from the start
const EASE_OUT = 2.8; // (m/s) shed per metre approaching the target
const ARRIVE = 0.06; // m, close enough to stop
const STALL_FRACTION = 0.2; // progress below this share of a step = blocked

export interface Glide {
  target: FootprintVertex;
  /** Straight-line distance when the glide started, for the ease profile. */
  total: number;
}

export function startGlide(
  from: FootprintVertex,
  target: FootprintVertex,
): Glide {
  return { target, total: Math.hypot(target.x - from.x, target.z - from.z) };
}

/** Advance one frame; done when arrived or blocked by a wall or the desk. */
export function advanceGlide(
  pos: FootprintVertex,
  glide: Glide,
  delta: number,
  footprint: FootprintVertex[],
  radius: number,
  obstacles: Rect[] = [],
): { pos: FootprintVertex; done: boolean } {
  const dx = glide.target.x - pos.x;
  const dz = glide.target.z - pos.z;
  const remaining = Math.hypot(dx, dz);
  if (remaining <= ARRIVE) return { pos, done: true };
  const travelled = Math.max(0, glide.total - remaining);
  const speed = Math.min(
    PEAK_SPEED,
    MIN_SPEED + EASE_IN * travelled,
    MIN_SPEED + EASE_OUT * remaining,
  );
  const step = Math.min(speed * delta, remaining);
  const next = resolveMovement(
    pos,
    { x: pos.x + (dx / remaining) * step, z: pos.z + (dz / remaining) * step },
    footprint,
    radius,
    obstacles,
  );
  const progress = Math.hypot(next.x - pos.x, next.z - pos.z);
  const left = Math.hypot(glide.target.x - next.x, glide.target.z - next.z);
  return {
    pos: next,
    done: left <= ARRIVE || progress < step * STALL_FRACTION,
  };
}

// Turning, on the same ease profile as the walk above, so when the assistant
// takes you to a work, the turn and the glide finish together and you arrive
// already facing it rather than swinging round on the spot afterwards.

const TURN_PEAK = 3.2; // rad/s mid-turn
const TURN_MIN = 0.7; // rad/s approaching the target, so the turn still arrives
const TURN_EASE_OUT = 4; // (rad/s) shed per radian remaining
const TURN_ARRIVE = 0.004; // rad, close enough to stop (~0.2°)

/** A heading in the rig's YXZ convention. */
export interface Turn {
  /** Rotation about Y. */
  yaw: number;
  /** Rotation about X; positive looks up. */
  pitch: number;
}

/**
 * The signed shortest way from `from` to `to`, normalised into (−π, π].
 *
 * Without this a turn from 3.0 rad to −3.0 rad takes the long way round: the
 * naive difference is −6.0, so the camera sweeps 344° through the whole room
 * instead of 16° across the corner. Yaw is unbounded, the drag handler just
 * accumulates into `rotation.y`, so by the time someone has looked around a
 * few times the raw values are nowhere near each other.
 */
export function shortestDelta(from: number, to: number): number {
  const TAU = Math.PI * 2;
  let delta = (to - from) % TAU;
  if (delta > Math.PI) delta -= TAU;
  if (delta <= -Math.PI) delta += TAU;
  return delta;
}

/** Advance one frame of a turn toward `target`; done when it has arrived. */
export function advanceTurn(
  current: Turn,
  target: Turn,
  delta: number,
): { at: Turn; done: boolean } {
  const dYaw = shortestDelta(current.yaw, target.yaw);
  const dPitch = target.pitch - current.pitch;
  const remaining = Math.hypot(dYaw, dPitch);
  if (remaining <= TURN_ARRIVE) return { at: target, done: true };
  // Distance from the start is not tracked: unlike the glide, a turn can be
  // retargeted mid-flight by a second instruction, and easing in from wherever
  // the head happens to be pointing is both simpler and indistinguishable.
  const speed = Math.min(TURN_PEAK, TURN_MIN + TURN_EASE_OUT * remaining);
  const step = Math.min(speed * delta, remaining);
  const share = step / remaining;
  const at = {
    yaw: current.yaw + dYaw * share,
    pitch: current.pitch + dPitch * share,
  };
  return { at, done: remaining - step <= TURN_ARRIVE };
}
