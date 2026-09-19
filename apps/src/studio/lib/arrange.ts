import { cmToM, type Wall } from "./geometry";
import {
  clearSpans,
  DEFAULT_ELEVATION_CM,
  resolveElevation,
  resolveOffset,
  type SizeCm,
  type WallLimits,
} from "./placement";

// Hanging a whole set at once, where placement.ts hangs one work at a time.
// `findSpot` is right for a single arrival, widest clear span, centred, but
// repeated it clusters everything on the long wall and leaves the returns bare,
// with every work at whatever height it happened to get. This pass spreads the
// set over the room instead: each wall's clear spans take a share of the works
// proportional to their length, evenly spaced, on one common centre line.
//
// Pure math, no three.js, same as geometry.ts and placement.ts.

/** Shorter than this and a span can't hold a work and its margins. */
export const MIN_RUN_M = 1.2;
/** Breathing room between neighbours, and at both ends of a run. */
export const MIN_GAP_M = 0.4;
/**
 * The closest two works may hang when a tighter hang is asked for.
 *
 * "촘촘하게" has to mean something, and it has to stop somewhere: frames need
 * air to read as separate works rather than as one long strip, and 12 cm is
 * about the tightest a salon hang goes before it becomes a mural.
 */
export const MIN_TIGHT_GAP_M = 0.12;

/** One continuous stretch of wall that artwork can hang on. */
export interface Run {
  wall: Wall;
  /** Offset along the wall (a→b) to the start of the span. */
  start: number;
  length: number;
}

export interface ArrangedPlacement {
  wall_index: number;
  offset_m: number;
  elevation_cm: number;
}

/**
 * Every usable hanging surface in the hall, in the order a visitor meets them.
 *
 * A wall is not one surface: hall 1's 7.7 m entrance wall is a 0.38 m stub and
 * a 6.36 m run either side of the door, and its 6.42 m shopfront is 5.6 m of
 * glass between two useless returns. Runs come back ordered by wall index then
 * by position along the wall, which *is* the walk from the door, every hall's
 * door is on wall 0 and every seeded footprint is already CCW, so
 * `normalizeFootprint` leaves the indices alone.
 */
export function hangingRuns(walls: Wall[], limits: WallLimits): Run[] {
  const runs: Run[] = [];
  for (const wall of walls) {
    for (const span of clearSpans(wall, limits)) {
      const length = span.max - span.min;
      if (length >= MIN_RUN_M) runs.push({ wall, start: span.min, length });
    }
  }
  return runs;
}

/**
 * How many of `n` works each run should carry, by largest-remainder
 * apportionment on run length: floor every exact share, then hand the leftovers
 * to the largest fractional remainders. The result sums to exactly `n`, which
 * is what stops one long run from swallowing the queue and leaving the rest of
 * the room bare. Fewer works than runs is the same rule, the works land on the
 * longest runs.
 */
export function apportion(runs: Run[], n: number): number[] {
  const total = runs.reduce((sum, run) => sum + run.length, 0);
  if (n <= 0 || total <= 0) return runs.map(() => 0);
  const exact = runs.map((run) => (n * run.length) / total);
  const quota = exact.map(Math.floor);
  // Ties break toward the longer run, then the earlier one, so the outcome
  // never rides on sort stability.
  const byRemainder = exact
    .map((share, index) => ({ index, remainder: share - Math.floor(share) }))
    .sort(
      (a, b) =>
        b.remainder - a.remainder ||
        runs[b.index].length - runs[a.index].length ||
        a.index - b.index,
    );
  // The fractional parts sum to the shortfall, so this never runs off the end.
  let left = n - quota.reduce((a, b) => a + b, 0);
  for (const { index } of byRemainder) {
    if (left <= 0) break;
    quota[index] += 1;
    left -= 1;
  }
  return quota;
}

/**
 * Air a run must have spare to hold `count` works: one gap between each pair
 * and one at each end. A lone work is exempt, it should hang wherever it
 * physically fits rather than be turned away from a wall it fills.
 */
function airFor(count: number): number {
  return count <= 1 ? 0 : (count + 1) * MIN_GAP_M;
}

function fits(run: Run, widths: number[]): boolean {
  if (widths.length === 0) return true;
  const used = widths.reduce((a, b) => a + b, 0);
  return used + airFor(widths.length) <= run.length;
}

/**
 * Centres for `widths` hung across `run`: the free air splits into equal gaps,
 * one between each pair and one at each end, so the works read as evenly spaced
 * with matching margins at both corners.
 */
function layOut(run: Run, widths: number[], targetGap?: number): number[] {
  const used = widths.reduce((a, b) => a + b, 0);
  // The default hang divides *all* the free air equally, so there is a gap at
  // each end as well as between each pair, and both corners match.
  const even = (run.length - used) / (widths.length + 1);
  const centres: number[] = [];

  if (targetGap == null || targetGap >= even) {
    let cursor = run.start;
    for (const width of widths) {
      cursor += even;
      centres.push(cursor + width / 2);
      cursor += width;
    }
    return centres;
  }

  // Asked for something tighter: put `targetGap` between neighbours only and
  // centre the whole group on the run, so the works read as one cluster with
  // matching air either side rather than as a set shoved against one corner.
  const gap = Math.max(MIN_TIGHT_GAP_M, targetGap);
  const span = used + gap * (widths.length - 1);
  let cursor = run.start + Math.max(0, (run.length - span) / 2);
  for (const width of widths) {
    centres.push(cursor + width / 2);
    cursor += width + gap;
  }
  return centres;
}

/**
 * Hang `sizes` across the hall in panel order: proportional share per run,
 * even spacing within each, one 150 cm centre line throughout.
 *
 * Returns one entry per input, in the same order. `null` means the work found
 * no home, it is wider than every run in the hall, or the room ran out of wall
 * and the caller should leave that work's current placement alone.
 */
export function arrangeWorks(
  walls: Wall[],
  limits: WallLimits,
  ceilingCm: number,
  sizes: SizeCm[],
  /** Metres between neighbours; omitted spreads them across all the free air. */
  targetGap?: number,
): (ArrangedPlacement | null)[] {
  const placements: (ArrangedPlacement | null)[] = sizes.map(() => null);
  const runs = hangingRuns(walls, limits);
  if (runs.length === 0) return placements;

  // A work wider than the longest run can't hang anywhere, so it must not eat
  // an apportioned slot that a placeable work needs.
  const longest = runs.reduce((widest, run) => Math.max(widest, run.length), 0);
  const queue = sizes
    .map((size, index) => ({
      index,
      widthM: cmToM(size.width_cm),
      heightCm: size.height_cm,
    }))
    .filter((work) => work.widthM <= longest);

  const quota = apportion(runs, queue.length);
  let taken = 0;
  // A run's quota counts works, not centimetres, so wide works can leave it
  // short. Trim from the tail until the slice fits and carry what's left over
  // to the next run, forward only, which is what keeps panel order intact as
  // you walk the room.
  let deficit = 0;
  for (let r = 0; r < runs.length; r += 1) {
    const want = Math.min(quota[r] + deficit, queue.length - taken);
    let take = want;
    while (
      take > 0 &&
      !fits(
        runs[r],
        queue.slice(taken, taken + take).map((work) => work.widthM),
      )
    ) {
      take -= 1;
    }
    const hung = queue.slice(taken, taken + take);
    taken += take;
    deficit = want - take;
    if (hung.length === 0) continue;

    const centres = layOut(
      runs[r],
      hung.map((work) => work.widthM),
      targetGap,
    );
    hung.forEach((work, k) => {
      // resolveOffset re-applies the 10 cm grid and the corner/jamb clamp; the
      // centre is already inside this run, so it lands back in the same span.
      const offset = resolveOffset(
        runs[r].wall,
        work.widthM,
        centres[k],
        limits,
      );
      if (offset === null) return;
      placements[work.index] = {
        wall_index: runs[r].wall.wallIndex,
        offset_m: offset,
        elevation_cm: resolveElevation(
          DEFAULT_ELEVATION_CM,
          work.heightCm,
          ceilingCm,
        ),
      };
    });
  }
  return placements;
}
