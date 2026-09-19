import type { FootprintVertex } from "@galleryis/shared";
import {
  closestPointOnSegment,
  polygonCentroid,
  wallsFromFootprint,
  type Rect,
  type Wall,
} from "./geometry";

// Pure walk-collision math against the CCW footprint, no three.js. Movement
// is resolved by per-wall push-out (closest point on segment), which yields
// wall-stop head-on and wall-slide at oblique angles for free.

const EPS = 1e-9;
const ITERATIONS = 3;

export function pointInPolygon(
  p: FootprintVertex,
  footprint: FootprintVertex[],
): boolean {
  let inside = false;
  for (let i = 0, j = footprint.length - 1; i < footprint.length; j = i++) {
    const a = footprint[i];
    const b = footprint[j];
    const crosses =
      a.z > p.z !== b.z > p.z &&
      p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

// Corrections are strictly local (within radius of a wall segment), a signed
// test against the infinite wall line would evict interior points of this
// non-convex footprint. Callers keep steps ≤ radius/2 so nothing tunnels past
// the proximity check.
function pushOut(
  pos: FootprintVertex,
  walls: Wall[],
  radius: number,
): FootprintVertex {
  const out = { ...pos };
  for (let pass = 0; pass < ITERATIONS; pass += 1) {
    for (const wall of walls) {
      const cp = closestPointOnSegment(out, wall.a, wall.b);
      const dx = out.x - cp.x;
      const dz = out.z - cp.z;
      const dist = Math.hypot(dx, dz);
      if (dist >= radius) continue;
      const signed =
        (out.x - wall.a.x) * wall.inwardNormal.x +
        (out.z - wall.a.z) * wall.inwardNormal.z;
      if (signed < 0 || dist < EPS) {
        // On or just past the wall: snap to the interior side.
        out.x = cp.x + wall.inwardNormal.x * radius;
        out.z = cp.z + wall.inwardNormal.z * radius;
      } else {
        // Too close: push away from the wall (radially near corners).
        out.x = cp.x + (dx / dist) * radius;
        out.z = cp.z + (dz / dist) * radius;
      }
    }
  }
  return out;
}

/**
 * Eject a point from an obstacle (the reception desk) along the shallowest of
 * the four penetration axes, the standard AABB resolution, which slides along
 * the counter instead of sticking to it.
 */
export function pushOutOfRect(
  p: FootprintVertex,
  rect: Rect,
  radius: number,
): FootprintVertex {
  const minX = rect.minX - radius;
  const maxX = rect.maxX + radius;
  const minZ = rect.minZ - radius;
  const maxZ = rect.maxZ + radius;
  if (p.x <= minX || p.x >= maxX || p.z <= minZ || p.z >= maxZ) return p;
  const west = p.x - minX;
  const east = maxX - p.x;
  const south = p.z - minZ;
  const north = maxZ - p.z;
  const shallowest = Math.min(west, east, south, north);
  if (shallowest === west) return { x: minX, z: p.z };
  if (shallowest === east) return { x: maxX, z: p.z };
  if (shallowest === south) return { x: p.x, z: minZ };
  return { x: p.x, z: maxZ };
}

/**
 * Out of every obstacle, and then out of them again: the counter is an L, two
 * boxes meeting at a face, and one pass can eject a walker off the leg into the
 * run it has already been checked against. The passes are the wall loop's own
 * count, and the shallowest-axis ejection is what settles them.
 */
function pushOutOfAll(
  p: FootprintVertex,
  obstacles: Rect[],
  radius: number,
): FootprintVertex {
  let out = p;
  for (let pass = 0; pass < ITERATIONS; pass += 1) {
    out = obstacles.reduce(
      (acc, rect) => pushOutOfRect(acc, rect, radius),
      out,
    );
  }
  return out;
}

/** Resolve a walk step: stop at walls head-on, slide along them obliquely. */
export function resolveMovement(
  from: FootprintVertex,
  to: FootprintVertex,
  footprint: FootprintVertex[],
  radius: number,
  obstacles: Rect[] = [],
): FootprintVertex {
  const walls = wallsFromFootprint(footprint);
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (radius / 2)));
  let pos = { ...from };
  for (let i = 0; i < steps; i += 1) {
    // Walls first, obstacles second, then the interior gate, so an ejection
    // off the desk can never push the walker out through a wall.
    const candidate = pushOutOfAll(
      pushOut({ x: pos.x + dx / steps, z: pos.z + dz / steps }, walls, radius),
      obstacles,
      radius,
    );
    if (pointInPolygon(candidate, footprint)) pos = candidate;
  }
  return pos;
}

/** Clamp a teleport target to the interior with wall and obstacle clearance. */
export function clampToInterior(
  p: FootprintVertex,
  footprint: FootprintVertex[],
  radius: number,
  obstacles: Rect[] = [],
): FootprintVertex {
  const walls = wallsFromFootprint(footprint);
  let pos = { ...p };
  if (!pointInPolygon(pos, footprint)) {
    let best: FootprintVertex | null = null;
    let bestDist = Infinity;
    for (const wall of walls) {
      const cp = closestPointOnSegment(pos, wall.a, wall.b);
      const dist = Math.hypot(pos.x - cp.x, pos.z - cp.z);
      if (dist < bestDist) {
        bestDist = dist;
        best = {
          x: cp.x + wall.inwardNormal.x * radius,
          z: cp.z + wall.inwardNormal.z * radius,
        };
      }
    }
    if (best) pos = best;
  }
  const out = pushOutOfAll(pushOut(pos, walls, radius), obstacles, radius);
  if (pointInPolygon(out, footprint)) return out;
  return pushOutOfAll(polygonCentroid(footprint), obstacles, radius);
}
