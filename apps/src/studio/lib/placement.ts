import type {
  ArtworkPlacement,
  HallDesk,
  HallDoor,
  HallWindow,
} from "@galleryis/shared";
import { DEFAULT_HO, longSideForHo } from "./canvasSizes";
import { cmToM, type Wall } from "./geometry";

// Pure hang-placement math, no three.js, same rule as geometry.ts. Positions
// speak the §5 studio_layouts vocabulary: wall_index names a CCW footprint
// edge, offset_m runs a→b along it to the artwork's horizontal centre,
// elevation_cm is floor → artwork centre.

export const SNAP_CM = 10; // placement grid, both axes
export const DEFAULT_ELEVATION_CM = 150; // museum-standard centre height
// New works arrive at a 20호 long side, the gallery's own "20호가 무난".
export const DEFAULT_LONG_CM = longSideForHo(DEFAULT_HO) ?? 72.7;
export const MIN_SIZE_CM = 10;
// The door's no-hang zone reaches past the clear opening to the outer edge of
// its frame (FRAME_WIDTH in HallScene), so nothing hangs over the jambs.
const DOOR_CLEARANCE_M = 0.06;
/**
 * How far off a wall the reception counter can stand and still be judged to be
 * standing against it. The four halls' desks sit 1.08~1.13 m clear, so 2 m
 * catches all of them with room to spare while staying well inside these rooms'
 * 6.4 m short span, a counter marooned mid-floor would shadow nothing.
 */
const DESK_REACH_M = 2;
/** How parallel the desk must run to a wall to count as standing against it. */
const DESK_PARALLEL = 0.9;

/**
 * Everything on a hall's walls that a work has to keep clear of. Bundled rather
 * than passed as three nullable arguments: they always travel together, and
 * every one of them is a reason a stretch of wall cannot be hung on.
 */
export interface WallLimits {
  door: HallDoor | null;
  windows: HallWindow[] | null;
  /** The reception counter, you cannot hang, or stand to look, behind it. */
  desk: HallDesk | null;
}

export const NO_LIMITS: WallLimits = { door: null, windows: null, desk: null };

const round1 = (v: number) => Math.round(v * 10) / 10;

export function mToCm(m: number): number {
  return m * 100;
}

export function snapM(m: number): number {
  return Math.round(mToCm(m) / SNAP_CM) * (SNAP_CM / 100);
}

export function snapCm(cm: number): number {
  return Math.round(cm / SNAP_CM) * SNAP_CM;
}

/** A closed range of allowed artwork-centre positions along a wall, metres. */
export interface Interval {
  min: number;
  max: number;
}

/** Remove [zoneMin, zoneMax] from each interval (splitting where needed). */
function subtract(
  intervals: Interval[],
  zoneMin: number,
  zoneMax: number,
): Interval[] {
  const out: Interval[] = [];
  for (const iv of intervals) {
    if (zoneMin > iv.min)
      out.push({ min: iv.min, max: Math.min(iv.max, zoneMin) });
    if (zoneMax < iv.max)
      out.push({ min: Math.max(iv.min, zoneMax), max: iv.max });
  }
  return out;
}

/** The door span widened to its frame, as an occupied interval on its wall. */
function doorZone(door: HallDoor): Interval {
  const half = cmToM(door.width_cm) / 2 + DOOR_CLEARANCE_M;
  return { min: door.offset_m - half, max: door.offset_m + half };
}

/**
 * The stretch of `wall` the reception counter stands in front of, or null when
 * this is not the wall it stands against.
 *
 * "Against" is two tests, and it needs both. Distance alone would catch the
 * wall the counter merely points at, halls 2-4's south wall is only 1.9 m off
 * its end, so the counter must also run *parallel* to the wall, which is what
 * a counter placed against one does. Distance then rules out the far wall the
 * near one is parallel to.
 *
 * The zone is the counter's own footprint with no added clearance, the same
 * choice glazing makes: a work may sit edge-to-edge with where the desk ends.
 */
export function deskZone(wall: Wall, desk: HallDesk | null): Interval | null {
  if (!desk) return null;
  const along = {
    x: (wall.b.x - wall.a.x) / wall.length,
    z: (wall.b.z - wall.a.z) / wall.length,
  };
  // The counter's long axis, these are narrow counters, ~0.4 m by ~1.8 m.
  const long = desk.depth_m >= desk.width_m ? { x: 0, z: 1 } : { x: 1, z: 0 };
  if (Math.abs(along.x * long.x + along.z * long.z) < DESK_PARALLEL)
    return null;

  const corners = [-1, 1].flatMap((sx) =>
    [-1, 1].map((sz) => ({
      x: desk.center.x + (sx * desk.width_m) / 2,
      z: desk.center.z + (sz * desk.depth_m) / 2,
    })),
  );
  let nearest = Infinity;
  let min = Infinity;
  let max = -Infinity;
  for (const corner of corners) {
    const dx = corner.x - wall.a.x;
    const dz = corner.z - wall.a.z;
    // Into the room is positive; a corner behind the wall plane is not near it.
    nearest = Math.min(
      nearest,
      dx * wall.inwardNormal.x + dz * wall.inwardNormal.z,
    );
    const t = dx * along.x + dz * along.z;
    min = Math.min(min, t);
    max = Math.max(max, t);
  }
  if (nearest < 0 || nearest > DESK_REACH_M) return null;
  return {
    min: Math.max(0, min),
    max: Math.min(wall.length, max),
  };
}

/**
 * Stretches of `wall` no artwork may cross: the door's opening, every glazed
 * span, and the wall the reception counter stands against. Windows and the desk
 * take no clearance, the glass edge *is* the wall edge, and hall 1's returns
 * are already tight enough without eating into them.
 */
export function blockedZones(wall: Wall, limits: WallLimits): Interval[] {
  const zones: Interval[] = [];
  const { door, windows, desk } = limits;
  if (door && door.wall_index === wall.wallIndex) zones.push(doorZone(door));
  for (const win of windows ?? []) {
    if (win.wall_index !== wall.wallIndex) continue;
    zones.push({
      min: win.offset_m - win.width_m / 2,
      max: win.offset_m + win.width_m / 2,
    });
  }
  const shadow = deskZone(wall, desk);
  if (shadow && shadow.max > shadow.min) zones.push(shadow);
  return zones;
}

/**
 * Centre intervals where a work `widthM` across may sit on `wall`, inside the
 * corners, clear of the door and of any glazing on this wall. Empty when the
 * work is wider than the wall allows anywhere.
 */
export function allowedIntervals(
  wall: Wall,
  widthM: number,
  limits: WallLimits,
): Interval[] {
  const half = widthM / 2;
  if (widthM <= 0 || widthM > wall.length) return [];
  let intervals = [{ min: half, max: wall.length - half }];
  for (const zone of blockedZones(wall, limits)) {
    intervals = subtract(intervals, zone.min - half, zone.max + half);
  }
  return intervals;
}

/**
 * Where a drag to `rawOffset` actually lands: snapped to the 10 cm grid, then
 * clamped into the nearest allowed interval, corner and door clamping win
 * over the grid at interval edges. Null when the work fits nowhere on `wall`.
 */
export function resolveOffset(
  wall: Wall,
  widthM: number,
  rawOffset: number,
  limits: WallLimits,
): number | null {
  const intervals = allowedIntervals(wall, widthM, limits);
  const snapped = snapM(rawOffset);
  let best: number | null = null;
  let bestDist = Infinity;
  for (const iv of intervals) {
    const candidate = Math.min(iv.max, Math.max(iv.min, snapped));
    // Distance measured to the raw pointer position, so a drag toward the
    // door clamps to whichever side the pointer is actually on.
    const dist = Math.abs(candidate - rawOffset);
    if (dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }
  return best;
}

/** Snap and clamp a centre elevation so the work stays on the wall face. */
export function resolveElevation(
  rawCm: number,
  heightCm: number,
  ceilingCm: number,
): number {
  const min = heightCm / 2;
  const max = ceilingCm - heightCm / 2;
  // Taller than the room, size caps prevent this, but never go negative.
  if (min > max) return ceilingCm / 2;
  return Math.min(max, Math.max(min, snapCm(rawCm)));
}

export interface SizeCm {
  width_cm: number;
  height_cm: number;
}

/** Complete a one-sided size edit from the image's aspect ratio (w/h). */
export function aspectSize(aspect: number, edit: Partial<SizeCm>): SizeCm {
  const width = edit.width_cm ?? (edit.height_cm ?? 0) * aspect;
  return { width_cm: round1(width), height_cm: round1(width / aspect) };
}

export function defaultSize(naturalW: number, naturalH: number): SizeCm {
  const aspect = naturalW / naturalH;
  return aspect >= 1
    ? aspectSize(aspect, { width_cm: DEFAULT_LONG_CM })
    : aspectSize(aspect, { height_cm: DEFAULT_LONG_CM });
}

/**
 * The solid stretches of `wall` left once the door and glazing are cut out,
 * ordered a→b. Unlike `allowedIntervals` these are the spans themselves, not
 * the centres a given work may take within them, the arrange pass hangs a
 * whole set inside one span, so it needs the span.
 */
export function clearSpans(wall: Wall, limits: WallLimits): Interval[] {
  let spans = [{ min: 0, max: wall.length }];
  for (const zone of blockedZones(wall, limits)) {
    spans = subtract(spans, zone.min, zone.max);
  }
  return spans;
}

/** The widest clear span on a wall once the door and glazing are excluded. */
export function maxWidthOn(wall: Wall, limits: WallLimits): number {
  return clearSpans(wall, limits).reduce(
    (widest, s) => Math.max(widest, s.max - s.min),
    0,
  );
}

/**
 * The widest gap left on `wall` once the door, glazing, desk **and the works
 * already hanging on it** are all cut out.
 *
 * `maxWidthOn` answers "how much of this wall could ever be used"; this answers
 * "how much of it is still going spare", which is the question a visitor
 * actually asks ("여기 더 걸 수 있어?"). It is also the one number in the request
 * the model cannot derive for itself, it needs interval arithmetic over every
 * blocked zone and every hung work, and a lite model doing that is quietly
 * wrong rather than visibly wrong.
 *
 * Works are cut at their own width, not widened by a candidate's half-width the
 * way `spotOnWall` does: this is a measurement of the wall, not a search for a
 * centre, so widening it would report a gap smaller than the one that is there.
 */
export function freeSpanOn(
  wall: Wall,
  limits: WallLimits,
  works: readonly ArtworkPlacement[],
): number {
  let spans = clearSpans(wall, limits);
  for (const work of works) {
    if (work.wall_index !== wall.wallIndex) continue;
    const half = cmToM(work.width_cm) / 2;
    spans = subtract(spans, work.offset_m - half, work.offset_m + half);
  }
  return spans.reduce((widest, s) => Math.max(widest, s.max - s.min), 0);
}

/**
 * Clamp an aspect-locked size edit so the work still fits its wall's widest
 * clear span and stands under the ceiling.
 */
export function clampSize(
  aspect: number,
  edit: Partial<SizeCm>,
  wall: Wall,
  limits: WallLimits,
  ceilingCm: number,
): SizeCm {
  const wanted = aspectSize(aspect, edit);
  // Floor the cap to the 0.1 cm grid aspectSize rounds to: rounding half-up
  // could otherwise exceed the true span (hall 2's diagonal wall is
  // 1258.65… cm) and leave the capped work unplaceable on its own wall.
  const maxW =
    Math.floor(
      Math.min(mToCm(maxWidthOn(wall, limits)), aspect * ceilingCm) * 10,
    ) / 10;
  const width = Math.min(maxW, Math.max(MIN_SIZE_CM, wanted.width_cm));
  return aspectSize(aspect, { width_cm: width });
}

export function worksOverlap(
  a: ArtworkPlacement,
  b: ArtworkPlacement,
): boolean {
  if (a.wall_index !== b.wall_index) return false;
  const gapX =
    Math.abs(a.offset_m - b.offset_m) -
    (cmToM(a.width_cm) + cmToM(b.width_cm)) / 2;
  const gapY =
    Math.abs(a.elevation_cm - b.elevation_cm) - (a.height_cm + b.height_cm) / 2;
  return gapX < -1e-9 && gapY < -1e-9;
}

/** Ids of every work that overlaps another on its wall, warned, not blocked. */
export function overlappingIds(
  works: (ArtworkPlacement & { id: string })[],
): Set<string> {
  const ids = new Set<string>();
  for (let i = 0; i < works.length; i += 1) {
    for (let j = i + 1; j < works.length; j += 1) {
      if (worksOverlap(works[i], works[j])) {
        ids.add(works[i].id);
        ids.add(works[j].id);
      }
    }
  }
  return ids;
}

/**
 * Pick a wall and offset for a newly added work: widest clear span first, the
 * door, glazing and existing works excluded; when every clear stretch is taken,
 * the same walls again ignoring works, the overlap is warned, not blocked.
 * Null only when the work is wider than every wall's clear span.
 *
 * Ranked by clear span rather than raw wall length so a mostly-glazed wall
 * (hall 1's 7.6 m side elevation is 6.3 m of glass) sinks below the plaster
 * walls it can actually lose to.
 */
/**
 * Where on *this* wall a work `widthM` across should go when the visitor named
 * the wall but not the spot, "왼쪽 큰 벽에 걸어줘".
 *
 * `findSpot`'s job is to choose a wall; this one has already been told which,
 * so it may not fall back to another. It shares the two-pass structure: first
 * avoiding the works already on the wall, then ignoring them, because a hall
 * that is merely crowded should still honour the instruction and let the
 * existing overlap warning speak.
 *
 * `prefer` is which end of the chosen span to sit at, "입구 쪽" and "안쪽" are
 * the a→b ends of the wall, and the middle is what an unqualified request gets.
 */
export function spotOnWall(
  wall: Wall,
  limits: WallLimits,
  works: ArtworkPlacement[],
  widthM: number,
  prefer: "start" | "middle" | "end" = "middle",
): number | null {
  const half = widthM / 2;
  for (const avoidWorks of [true, false]) {
    let intervals = allowedIntervals(wall, widthM, limits);
    if (avoidWorks) {
      for (const work of works) {
        if (work.wall_index !== wall.wallIndex) continue;
        const workHalf = cmToM(work.width_cm) / 2;
        intervals = subtract(
          intervals,
          work.offset_m - workHalf - half,
          work.offset_m + workHalf + half,
        );
      }
    }
    const widest = intervals.reduce(
      (a, b) => (b.max - b.min > a.max - a.min ? b : a),
      { min: 0, max: -Infinity },
    );
    if (widest.max < widest.min) continue;
    const raw =
      prefer === "start"
        ? widest.min
        : prefer === "end"
          ? widest.max
          : (widest.min + widest.max) / 2;
    return Math.min(widest.max, Math.max(widest.min, snapM(raw)));
  }
  return null;
}

export function findSpot(
  walls: Wall[],
  limits: WallLimits,
  works: ArtworkPlacement[],
  widthM: number,
): { wall_index: number; offset_m: number } | null {
  const byLength = [...walls].sort(
    (a, b) => maxWidthOn(b, limits) - maxWidthOn(a, limits),
  );
  const half = widthM / 2;
  for (const avoidWorks of [true, false]) {
    for (const wall of byLength) {
      let intervals = allowedIntervals(wall, widthM, limits);
      if (avoidWorks) {
        for (const work of works) {
          if (work.wall_index !== wall.wallIndex) continue;
          const workHalf = cmToM(work.width_cm) / 2;
          intervals = subtract(
            intervals,
            work.offset_m - workHalf - half,
            work.offset_m + workHalf + half,
          );
        }
      }
      const widest = intervals.reduce(
        (a, b) => (b.max - b.min > a.max - a.min ? b : a),
        { min: 0, max: -Infinity },
      );
      if (widest.max < widest.min) continue;
      const centre = Math.min(
        widest.max,
        Math.max(widest.min, snapM((widest.min + widest.max) / 2)),
      );
      return { wall_index: wall.wallIndex, offset_m: centre };
    }
  }
  return null;
}
