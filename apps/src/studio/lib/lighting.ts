import type { FootprintVertex } from "@galleryis/shared";
import { MIN_RUN_M } from "./arrange";
import { distanceToSegment, pointOnWall, type Wall } from "./geometry";
import { clearSpans, DEFAULT_ELEVATION_CM, type WallLimits } from "./placement";

// The halls' real lighting, read off the gallery's own photographs: a track
// runs parallel to each wall a little way out from it, suspended just under the
// ceiling, with cylindrical spots clipped on at roughly even spacing and aimed
// back at the wall. What that produces, and what every empty-wall photo of
// halls 1~4 shows, is a row of soft, evenly spaced pools sitting on the
// hanging line.
//
// Track is emitted over the same clear spans arrange.ts hangs into, so there is
// a spot above every place a work can go and none over the door or the glazing.
// Pure math, no three.js.

/** Rail distance out from the wall face. */
export const TRACK_OFFSET_M = 1.2;
/** Rail drop below the ceiling slab. */
export const TRACK_DROP_M = 0.14;
/** Nominal spacing between fittings; the real gap is evened out per run. */
export const FITTING_SPACING_M = 1.6;
/** Where the spots are aimed, the same centre line the works hang on. */
export const AIM_ELEVATION_CM = DEFAULT_ELEVATION_CM;
/**
 * How close a rail may come to any wall other than the one it lights.
 *
 * Offsetting a wall's whole length into the room is only exact in a rectangle.
 * These halls turn as tight as 70°, and hall 3 turns around a freestanding
 * partition; at a corner like that the offset rail reaches the next wall while
 * the wall it lights still has length to run. The track is left flush with the
 * plaster at best — and a 5 cm box flush with a plane pushes a corner of its
 * section through it — and at worst carries on out of the building. Invisible
 * while the outside of the model was the same white as the inside; against the
 * dark exterior, a white nick hanging in mid-air. So every run is trimmed back
 * to where its own section clears every other wall.
 */
export const RAIL_CLEARANCE_M = 0.12;

export interface Fitting {
  /** Rail position of the fitting body. */
  at: FootprintVertex;
  /** Wall point it is aimed at, on the hanging line. */
  aim: FootprintVertex;
}

export interface TrackRun {
  wallIndex: number;
  /** Rail ends, offset off the wall face. */
  from: FootprintVertex;
  to: FootprintVertex;
  /** Rotation about Y that aligns a local +x with from→to, the wall's own. */
  angleY: number;
  fittings: Fitting[];
}

/**
 * How many fittings a run of `length` carries: one about every
 * FITTING_SPACING_M, never fewer than one, so even a short return gets its spot.
 */
export function fittingCount(length: number): number {
  return Math.max(1, Math.round(length / FITTING_SPACING_M));
}

/**
 * The rail's distance to one wall, read as a function of the offset along the
 * wall the rail lights.
 *
 * It is **convex**: distance to a segment is a convex function of position, and
 * the rail is a straight line through that field. Everything below leans on
 * that — one minimum, and one crossing of the clearance on each side of it.
 */
function gapTo(
  rail: (offset: number) => FootprintVertex,
  other: Wall,
): (offset: number) => number {
  return (offset) => distanceToSegment(rail(offset), other.a, other.b);
}

/** The offset of the rail's closest approach to one wall, by ternary search:
 *  valid because the gap is convex, and 60 thirds leave nothing measurable. */
function closestApproach(
  gap: (offset: number) => number,
  min: number,
  max: number,
): number {
  let lo = min;
  let hi = max;
  for (let i = 0; i < 60; i += 1) {
    const a = lo + (hi - lo) / 3;
    const b = hi - (hi - lo) / 3;
    if (gap(a) < gap(b)) hi = b;
    else lo = a;
  }
  return (lo + hi) / 2;
}

/** Where between an offset that clears the wall and one that does not the rail
 *  crosses the clearance, bisected. Convexity puts exactly one crossing in
 *  there; 20 halvings put a 13 m rail inside 13 µm. */
function clearanceCrossing(
  gap: (offset: number) => number,
  clear: number,
  blocked: number,
): number {
  let good = clear;
  let bad = blocked;
  for (let i = 0; i < 20; i += 1) {
    const mid = (good + bad) / 2;
    if (gap(mid) >= RAIL_CLEARANCE_M) good = mid;
    else bad = mid;
  }
  return good;
}

/**
 * A run's span trimmed to the stretch of rail that clears every wall, or null
 * if no part of it does.
 *
 * The seed is the span's middle: a metre and a fifth off the wall being lit,
 * in the body of the room. Each other wall can only take a bite out of one end
 * of the span, because its gap has a single minimum — so find that minimum,
 * and if the rail is too close there, walk back from it towards the seed to
 * the offset where the clearance is met. Leaving the room *is* one of these
 * bites: the rail cannot get out without passing through a wall, and a wall it
 * passes through is a wall it came within nothing of.
 */
function clearOfWalls(
  rail: (offset: number) => FootprintVertex,
  span: { min: number; max: number },
  walls: Wall[],
): { min: number; max: number } | null {
  const seed = (span.min + span.max) / 2;
  let min = span.min;
  let max = span.max;
  for (const other of walls) {
    const gap = gapTo(rail, other);
    if (gap(seed) < RAIL_CLEARANCE_M) return null;
    const nearest = closestApproach(gap, min, max);
    if (gap(nearest) >= RAIL_CLEARANCE_M) continue;
    if (nearest > seed)
      max = Math.min(max, clearanceCrossing(gap, seed, nearest));
    else min = Math.max(min, clearanceCrossing(gap, seed, nearest));
  }
  return min < max ? { min, max } : null;
}

/**
 * The lighting rig for a hall: one run of track per clear wall span, with its
 * fittings evenly spaced along it and aimed at the wall behind, trimmed to
 * where the rail is inside the room.
 */
export function trackRuns(walls: Wall[], limits: WallLimits): TrackRun[] {
  const runs: TrackRun[] = [];
  for (const wall of walls) {
    const { x: nx, z: nz } = wall.inwardNormal;
    for (const hangable of clearSpans(wall, limits)) {
      if (hangable.max - hangable.min < MIN_RUN_M) continue;
      const offRail = (offset: number): FootprintVertex => {
        const on = pointOnWall(wall, offset);
        return { x: on.x + nx * TRACK_OFFSET_M, z: on.z + nz * TRACK_OFFSET_M };
      };
      const span = clearOfWalls(offRail, hangable, walls);
      if (!span) continue;
      const length = span.max - span.min;
      if (length < MIN_RUN_M) continue;
      const count = fittingCount(length);
      const fittings: Fitting[] = [];
      for (let i = 0; i < count; i += 1) {
        // Half-gap margins, so the end fittings sit inside the run rather than
        // on its corners.
        const offset = span.min + (length * (i + 0.5)) / count;
        fittings.push({ at: offRail(offset), aim: pointOnWall(wall, offset) });
      }
      runs.push({
        wallIndex: wall.wallIndex,
        from: offRail(span.min),
        to: offRail(span.max),
        angleY: wall.angleY,
        fittings,
      });
    }
  }
  return runs;
}

/**
 * Fittings promoted to actual scene lights. Every fitting draws its pool on the
 * wall as a surface effect, but real lights cost shader work per fragment, so
 * only a spread few become one: enough to shade the room and glance off the
 * floor, taken evenly across the whole rig so the lit spots aren't clustered.
 */
export function keyFittings(runs: TrackRun[], budget: number): Fitting[] {
  const all = runs.flatMap((run) => run.fittings);
  if (all.length <= budget) return all;
  return Array.from(
    { length: budget },
    (_, i) => all[Math.floor(((i + 0.5) * all.length) / budget)],
  );
}
