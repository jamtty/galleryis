// The 호수 (号数) canvas series Korean painters actually order in, the French
// figure/paysage/marine standard as it is sold in Seoul. Gallery IS's own
// guidance to renting artists is "20호가 무난": a 20호 is the size that hangs
// comfortably in these rooms, which is why it is what a new work arrives at.
//
// Only the long side is tabulated, and that is not a shortcut: at any given 호
// the F (인물), P (풍경) and M (해경) variants share their long side and differ
// only in the short one. So the 호 number fixes the long side, and the
// uploaded image's own aspect supplies the rest, which is what stops a
// photograph being stretched to a nominal ratio it does not have.

export interface CanvasSize {
  ho: number;
  longCm: number;
}

export const HO_SERIES: CanvasSize[] = [
  { ho: 1, longCm: 22.7 },
  { ho: 2, longCm: 25.8 },
  { ho: 3, longCm: 27.3 },
  { ho: 4, longCm: 33.4 },
  { ho: 5, longCm: 34.8 },
  { ho: 6, longCm: 40.9 },
  { ho: 8, longCm: 45.5 },
  { ho: 10, longCm: 53.0 },
  { ho: 12, longCm: 60.6 },
  { ho: 15, longCm: 65.2 },
  { ho: 20, longCm: 72.7 },
  { ho: 25, longCm: 80.3 },
  { ho: 30, longCm: 90.9 },
  { ho: 40, longCm: 100.0 },
  { ho: 50, longCm: 116.8 },
  { ho: 60, longCm: 130.3 },
  { ho: 80, longCm: 145.5 },
  { ho: 100, longCm: 162.2 },
  { ho: 120, longCm: 193.9 },
  { ho: 150, longCm: 227.3 },
  { ho: 200, longCm: 259.1 },
];

/** The gallery's own recommendation for a first work. */
export const DEFAULT_HO = 20;

export function longSideForHo(ho: number): number | null {
  return HO_SERIES.find((size) => size.ho === ho)?.longCm ?? null;
}

/**
 * The 호 a work of this long side is, or null when it sits between two, a
 * photograph cropped off-standard, or a size typed straight into the cm
 * inputs. Half a centimetre of tolerance covers the 0.1 cm rounding the
 * aspect lock introduces, without ever claiming a neighbouring 호.
 */
export function hoForLongSide(longCm: number): number | null {
  return (
    HO_SERIES.find((size) => Math.abs(size.longCm - longCm) <= 0.5)?.ho ?? null
  );
}

/** The long side of a work, whichever way round it is hung. */
export function longSideOf(size: {
  width_cm: number;
  height_cm: number;
}): number {
  return Math.max(size.width_cm, size.height_cm);
}
