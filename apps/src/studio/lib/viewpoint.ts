import type { FootprintVertex } from "@galleryis/shared";
import { clampToInterior } from "./collision";
import { cmToM, pointOnWall, type Rect, type Wall } from "./geometry";
import type { Turn } from "./glide";

// Where to stand to look at a hung work, and which way to face once you're
// there. Pure, no three.js, no store, so the arithmetic that decides whether
// you end up looking at the painting or at the wall beside it is testable.

/** Standoff as a multiple of the work's long side, roughly gallery distance. */
export const VIEW_FACTOR = 1.6;
/** Never closer than this, however small the work. */
export const MIN_VIEW_M = 1.2;
/** Nor further than this, however large, a big canvas still wants a room. */
export const MAX_VIEW_M = 6;

export interface Viewpoint extends Turn {
  at: FootprintVertex;
}

/**
 * Stand in front of `work` on `wall` and face it.
 *
 * The order matters. The standing point is pushed off the wall along its inward
 * normal, and then **clamped into the interior**, which is what handles the
 * narrow end of a hall, the reception counter, and a work hung opposite a wall
 * only two metres away. Clamping moves you sideways as well as forward, so the
 * yaw is taken **from where you actually ended up** to the work, never from the
 * wall's normal: a normal-derived heading would have you standing beside the
 * work looking parallel to it, which is precisely the failure the visitor would
 * notice and no unit test of the normal would catch.
 */
export function viewpointFor(
  wall: Wall,
  offsetM: number,
  work: { width_cm: number; height_cm: number; elevation_cm: number },
  footprint: FootprintVertex[],
  radius: number,
  obstacles: Rect[],
  eyeHeight: number,
  pitchLimit: number,
): Viewpoint {
  const anchor = pointOnWall(wall, offsetM);
  const longM = cmToM(Math.max(work.width_cm, work.height_cm));
  const standoff = Math.min(
    MAX_VIEW_M,
    Math.max(MIN_VIEW_M, longM * VIEW_FACTOR),
  );
  const at = clampToInterior(
    {
      x: anchor.x + wall.inwardNormal.x * standoff,
      z: anchor.z + wall.inwardNormal.z * standoff,
    },
    footprint,
    radius,
    obstacles,
  );

  const dx = anchor.x - at.x;
  const dz = anchor.z - at.z;
  return {
    at,
    yaw: yawToward(dx, dz),
    pitch: pitchToward(dx, dz, work.elevation_cm, eyeHeight, pitchLimit),
  };
}

/**
 * The rig's yaw for looking along (dx, dz).
 *
 * Pinned to `FirstPersonRig`'s own spawn: it faces the room's south wall by
 * setting `rotation.set(0, Math.PI, 0)`, and that wall lies at local +z. So
 * looking along +z is π, which `atan2(-dx, -dz)` gives for (0, +1). Deriving it
 * any other way risks a sign that only shows up as the camera facing backwards.
 */
export function yawToward(dx: number, dz: number): number {
  if (Math.abs(dx) < 1e-9 && Math.abs(dz) < 1e-9) return 0;
  return Math.atan2(-dx, -dz);
}

/** How far up or down the work sits from eye height, clamped to the rig's limit. */
export function pitchToward(
  dx: number,
  dz: number,
  elevationCm: number,
  eyeHeight: number,
  pitchLimit: number,
): number {
  const horizontal = Math.hypot(dx, dz);
  if (horizontal < 1e-6) return 0;
  const rise = cmToM(elevationCm) - eyeHeight;
  return Math.min(
    pitchLimit,
    Math.max(-pitchLimit, Math.atan2(rise, horizontal)),
  );
}
