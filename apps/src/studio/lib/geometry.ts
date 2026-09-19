import type {
  FootprintVertex,
  HallDesk,
  HallDoor,
  HallWindow,
} from "@galleryis/shared";

// Pure footprint→geometry math, deliberately free of three.js so it can be
// unit-tested in plain vitest. Convention: the footprint lives on the scene's
// ground plane as (x, z); CCW means positive shoelace area over (x, z) read as
// standard 2D axes, and the interior lies to the LEFT of each directed edge.
//
// Those (x, z) are the scene's axes, not the floor plan's, +z runs *down* the
// drawing. The API seeds them that way on purpose (see halls_data.py): feeding
// this layer the drawing's north-up z renders every hall mirrored, and viewed
// from above a mirrored room still looks plausible, so nothing catches it.

export interface Wall {
  wallIndex: number;
  a: FootprintVertex;
  b: FootprintVertex;
  length: number;
  /** Rotation about the scene Y axis that aligns a plane's local +x with a→b. */
  angleY: number;
  /** Unit normal pointing into the room (left of a→b). */
  inwardNormal: FootprintVertex;
}

export function cmToM(cm: number): number {
  return cm / 100;
}

export function signedArea(footprint: FootprintVertex[]): number {
  let doubled = 0;
  for (let i = 0; i < footprint.length; i += 1) {
    const a = footprint[i];
    const b = footprint[(i + 1) % footprint.length];
    doubled += a.x * b.z - b.x * a.z;
  }
  return doubled / 2;
}

/** Returns a CCW copy (reverses CW input; already-CCW input comes back as-is). */
export function normalizeFootprint(
  footprint: FootprintVertex[],
): FootprintVertex[] {
  return signedArea(footprint) < 0 ? [...footprint].reverse() : footprint;
}

export function wallsFromFootprint(footprint: FootprintVertex[]): Wall[] {
  const ccw = normalizeFootprint(footprint);
  return ccw.map((a, i) => {
    const b = ccw[(i + 1) % ccw.length];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = Math.hypot(dx, dz);
    return {
      wallIndex: i,
      a,
      b,
      length,
      angleY: -Math.atan2(dz, dx),
      inwardNormal: { x: -dz / length, z: dx / length },
    };
  });
}

/** A solid piece of a wall, in wall-local coordinates (offset along a→b, and
 *  height above the floor). A wall without an opening is one panel. */
export interface WallPanel {
  centerOffset: number;
  width: number;
  bottom: number;
  height: number;
}

export interface Opening {
  /** Along the wall (a→b) to the opening's centre, metres. */
  offset: number;
  width: number;
  /** Floor → top of the opening. */
  height: number;
  /** Floor → bottom of the opening; omitted or 0 for a door. */
  bottom?: number;
}

// Anything thinner than a millimetre is drawing noise, not architecture,
// dropping those is what lets a door sit flush in a corner (hall 4's is 1.5 cm
// from it) without emitting a degenerate jamb.
const MIN_PANEL = 1e-3;

/** Degenerate-length guard, well under any real dimension in metres. */
const EPS = 1e-9;

export function openingFromDoor(door: HallDoor): Opening {
  return {
    offset: door.offset_m,
    width: cmToM(door.width_cm),
    height: cmToM(door.height_cm),
  };
}

export function openingFromWindow(win: HallWindow): Opening {
  return {
    offset: win.offset_m,
    width: win.width_m,
    height: cmToM(win.head_cm),
    bottom: cmToM(win.sill_cm),
  };
}

/** An opening resolved onto its wall: clamped to the wall's own extent, so
 *  out-of-range data degrades into a smaller opening rather than a negative
 *  panel. Degenerate spans come back null and are skipped. */
function span(
  wall: Wall,
  height: number,
  opening: Opening,
): { start: number; end: number; sill: number; top: number } | null {
  const start = Math.max(0, opening.offset - opening.width / 2);
  const end = Math.min(wall.length, opening.offset + opening.width / 2);
  if (end - start < MIN_PANEL) return null;
  const top = Math.min(height, opening.height);
  return {
    start,
    end,
    sill: Math.max(0, Math.min(top, opening.bottom ?? 0)),
    top,
  };
}

/** Split a wall into the solid panels left once every opening is cut out of it.
 *  Openings are taken left to right; one that starts inside its predecessor is
 *  dropped, so overlapping data can never emit an inverted panel. */
export function wallPanels(
  wall: Wall,
  height: number,
  openings: Opening[] = [],
): WallPanel[] {
  const spans = openings
    .map((opening) => span(wall, height, opening))
    .filter((s) => s !== null)
    .sort((a, b) => a.start - b.start)
    .filter((s, i, all) => i === 0 || s.start >= all[i - 1].end);

  const panels: WallPanel[] = [];
  let solidFrom = 0;
  for (const { start, end, sill, top } of spans) {
    // The full-height stretch of wall leading up to this opening.
    panels.push({
      centerOffset: (solidFrom + start) / 2,
      width: start - solidFrom,
      bottom: 0,
      height,
    });
    // Header above, and, for a window, the sill panel below.
    panels.push({
      centerOffset: (start + end) / 2,
      width: end - start,
      bottom: top,
      height: height - top,
    });
    panels.push({
      centerOffset: (start + end) / 2,
      width: end - start,
      bottom: 0,
      height: sill,
    });
    solidFrom = end;
  }
  panels.push({
    centerOffset: (solidFrom + wall.length) / 2,
    width: wall.length - solidFrom,
    bottom: 0,
    height,
  });
  return panels.filter((p) => p.width >= MIN_PANEL && p.height >= MIN_PANEL);
}

/** World (x, z) at `offset` metres along the wall from its start vertex. */
export function pointOnWall(wall: Wall, offset: number): FootprintVertex {
  const t = wall.length < MIN_PANEL ? 0 : offset / wall.length;
  return {
    x: wall.a.x + (wall.b.x - wall.a.x) * t,
    z: wall.a.z + (wall.b.z - wall.a.z) * t,
  };
}

/** The point of segment a→b nearest `p`; the segment's ends cap it, so this is
 *  a distance to the wall itself and not to the infinite line through it. */
export function closestPointOnSegment(
  p: FootprintVertex,
  a: FootprintVertex,
  b: FootprintVertex,
): FootprintVertex {
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const lengthSq = abx * abx + abz * abz;
  const t =
    lengthSq < EPS
      ? 0
      : Math.max(
          0,
          Math.min(1, ((p.x - a.x) * abx + (p.z - a.z) * abz) / lengthSq),
        );
  return { x: a.x + abx * t, z: a.z + abz * t };
}

export function distanceToSegment(
  p: FootprintVertex,
  a: FootprintVertex,
  b: FootprintVertex,
): number {
  const on = closestPointOnSegment(p, a, b);
  return Math.hypot(p.x - on.x, p.z - on.z);
}

export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** The counter's long run, the rectangle the hall doc stores. */
export function deskRect(desk: HallDesk): Rect {
  return {
    minX: desk.center.x - desk.width_m / 2,
    maxX: desk.center.x + desk.width_m / 2,
    minZ: desk.center.z - desk.depth_m / 2,
    maxZ: desk.center.z + desk.depth_m / 2,
  };
}

/** The return leg, as a fraction of the run it turns off, and its longest. */
const DESK_LEG_FRACTION = 0.5;
const DESK_LEG_MAX_M = 0.95;

/**
 * The reception counter is an L — "인포데스크는 ㄴ자 형태로", the gallery's
 * 2026-08-29 note on the 3D read. The hall doc still stores what the plans
 * draw, the long run standing off the entrance wall; the return leg is built
 * from it here, so all four halls turn the same corner and the walker collides
 * with exactly the counter it can see.
 *
 * Which corner is read off the entrance. The leg turns off the run's entrance
 * end — the end nearer the door along the run — and reaches **back toward the
 * wall the counter stands off**, which is the sheet's own isometric: the L
 * closes the staff side at the entrance end and is entered from the far one.
 * (The gallery said so again on 2026-08-29, pointing at that isometric, after
 * the first build turned the leg out into the room.) It stops short of the
 * plaster on all four halls — the counters stand 1.0~1.1 m off the wall and the
 * leg is at most 0.95 — so the way behind stays open past the far end.
 */
interface DeskL {
  /** True when the run's long axis is z, which is how all four halls stand. */
  alongZ: boolean;
  /** Run centre, split into the run axis (u) and the one across it (v). */
  u: number;
  v: number;
  runLength: number;
  runWidth: number;
  legLength: number;
  /** +1 when the entrance end of the run is the +u one, -1 when it is -u. */
  endSign: number;
  /** +1 when the leg reaches toward +v — the wall's side — and -1 toward -v. */
  legSign: number;
}

function deskL(desk: HallDesk, entrance: FootprintVertex): DeskL {
  const alongZ = desk.depth_m >= desk.width_m;
  const runLength = alongZ ? desk.depth_m : desk.width_m;
  const runWidth = alongZ ? desk.width_m : desk.depth_m;
  const u = alongZ ? desk.center.z : desk.center.x;
  const v = alongZ ? desk.center.x : desk.center.z;
  const doorU = alongZ ? entrance.z : entrance.x;
  const doorV = alongZ ? entrance.x : entrance.z;
  return {
    alongZ,
    u,
    v,
    runLength,
    runWidth,
    legLength: Math.min(DESK_LEG_MAX_M, runLength * DESK_LEG_FRACTION),
    endSign: doorU >= u ? 1 : -1,
    legSign: doorV >= v ? 1 : -1,
  };
}

/** Back out of the run's own axes into the scene's. */
function deskPoint(l: DeskL, u: number, v: number): FootprintVertex {
  return l.alongZ ? { x: v, z: u } : { x: u, z: v };
}

function rectBetween(a: FootprintVertex, b: FootprintVertex): Rect {
  return {
    minX: Math.min(a.x, b.x),
    maxX: Math.max(a.x, b.x),
    minZ: Math.min(a.z, b.z),
    maxZ: Math.max(a.z, b.z),
  };
}

/**
 * The counter's two solid parts — the run, and the leg that turns off its
 * entrance end. They meet at a face rather than overlapping, so the union is
 * the L exactly once. This is what the walker is pushed out of; a hall doc
 * without a door keeps the plain run.
 */
export function deskRects(
  desk: HallDesk,
  entrance: FootprintVertex | null,
): Rect[] {
  const run = deskRect(desk);
  if (!entrance) return [run];
  const l = deskL(desk, entrance);
  const end = l.u + l.endSign * (l.runLength / 2);
  const face = l.v + l.legSign * (l.runWidth / 2);
  const leg = rectBetween(
    deskPoint(l, end, face),
    deskPoint(l, end - l.endSign * l.runWidth, face + l.legSign * l.legLength),
  );
  return [run, leg];
}

/**
 * The same L as one closed rectilinear outline, for the extruded counter.
 * `inflate` moves every edge along its own outward normal, so a negative one
 * sets the base back under the overhanging top.
 */
export function deskOutline(
  desk: HallDesk,
  entrance: FootprintVertex | null,
  inflate = 0,
): FootprintVertex[] {
  if (!entrance) {
    const run = deskRect(desk);
    return [
      { x: run.minX - inflate, z: run.minZ - inflate },
      { x: run.maxX + inflate, z: run.minZ - inflate },
      { x: run.maxX + inflate, z: run.maxZ + inflate },
      { x: run.minX - inflate, z: run.maxZ + inflate },
    ];
  }
  const l = deskL(desk, entrance);
  // The run's far end, its entrance end, and the leg's own far side — the one
  // edge of the six that faces back up the run.
  const far = l.u - l.endSign * (l.runLength / 2 + inflate);
  const end = l.u + l.endSign * (l.runLength / 2 + inflate);
  const inner = l.u + l.endSign * (l.runLength / 2 - l.runWidth - inflate);
  // The run's room-facing side, its wall-facing one — which the leg turns off
  // — and the tip of the leg itself.
  const front = l.v - l.legSign * (l.runWidth / 2 + inflate);
  const back = l.v + l.legSign * (l.runWidth / 2 + inflate);
  const tip = l.v + l.legSign * (l.runWidth / 2 + l.legLength + inflate);
  return [
    deskPoint(l, far, front),
    deskPoint(l, end, front),
    deskPoint(l, end, tip),
    deskPoint(l, inner, tip),
    deskPoint(l, inner, back),
    deskPoint(l, far, back),
  ];
}

export function polygonCentroid(footprint: FootprintVertex[]): FootprintVertex {
  let doubled = 0;
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < footprint.length; i += 1) {
    const a = footprint[i];
    const b = footprint[(i + 1) % footprint.length];
    const cross = a.x * b.z - b.x * a.z;
    doubled += cross;
    cx += (a.x + b.x) * cross;
    cz += (a.z + b.z) * cross;
  }
  const area6 = doubled * 3;
  return { x: cx / area6, z: cz / area6 };
}

export function boundingBox(footprint: FootprintVertex[]) {
  const xs = footprint.map((v) => v.x);
  const zs = footprint.map((v) => v.z);
  const min = { x: Math.min(...xs), z: Math.min(...zs) };
  const max = { x: Math.max(...xs), z: Math.max(...zs) };
  return {
    min,
    max,
    width: max.x - min.x,
    depth: max.z - min.z,
    center: { x: (min.x + max.x) / 2, z: (min.z + max.z) / 2 },
  };
}
