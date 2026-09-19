import type { HallFloor } from "@galleryis/shared";
import * as THREE from "three";

// A procedural floor finish, drawn to a canvas rather than fetched: the studio
// ships no binary assets, and a texture URL would need CORS on the media bucket
// for THREE.TextureLoader. Hall 1's is a ~30 cm charcoal tile with joints and
// tile-to-tile tonal variation; halls 2-4 are jointless, so they get the
// speckle alone (see halls_data.py, their sheets draw no module).

/** Tiles across one texture repeat. Four keeps the repeat large enough that the
 *  jitter doesn't read as a pattern, and small enough that 512² stays sharp. */
const TILES_PER_REPEAT = 4;
const CANVAS_PX = 512;
/** Metres per repeat for a jointless finish, which has no module of its own.
 *  Wide, because trowel clouding is a large-scale feature, tile it every
 *  metre and the repeat becomes the pattern. */
const SEAMLESS_REPEAT_M = 3;

// Deterministic so the finish is identical on every remount, a floor that
// reshuffles its tiles when the hall re-renders reads as a bug.
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shade(color: THREE.Color, factor: number): string {
  return `#${color.clone().multiplyScalar(factor).getHexString()}`;
}

function rgba(color: THREE.Color, factor: number, alpha: number): string {
  const c = color.clone().multiplyScalar(factor);
  const to255 = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255);
  return `rgba(${to255(c.r)}, ${to255(c.g)}, ${to255(c.b)}, ${alpha})`;
}

/**
 * The hall's floor as a repeating CanvasTexture. `repeat` is pre-set for UVs
 * measured in metres, which is what the floor's shapeGeometry gives us (it is
 * built straight from the footprint), so the caller only has to assign it.
 *
 * The caller owns disposal.
 */
export function makeTileTexture(finish: HallFloor): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_PX;
  canvas.height = CANVAS_PX;
  const ctx = canvas.getContext("2d");
  const body = new THREE.Color(finish.color);
  const cell = CANVAS_PX / TILES_PER_REPEAT;

  // jsdom gives no 2D context; the unit tests only care that a texture with the
  // right repeat comes back, so an unpainted canvas is fine there.
  if (ctx) {
    const random = mulberry32(0x9e3779b9);
    ctx.fillStyle = shade(body, 1);
    ctx.fillRect(0, 0, CANVAS_PX, CANVAS_PX);

    if (finish.tile_cm !== null) {
      // Tile-to-tile variation. ±6%: the photographed tiles vary batch to
      // batch, but not so far that any one of them reads as a stain.
      for (let row = 0; row < TILES_PER_REPEAT; row += 1) {
        for (let col = 0; col < TILES_PER_REPEAT; col += 1) {
          ctx.fillStyle = shade(body, 0.94 + random() * 0.12);
          ctx.fillRect(col * cell, row * cell, cell, cell);
        }
      }
      // Fine aggregate, and something for the specular highlight to sit on.
      for (let i = 0; i < 9000; i += 1) {
        ctx.fillStyle = shade(body, 0.86 + random() * 0.3);
        ctx.fillRect(random() * CANVAS_PX, random() * CANVAS_PX, 1.5, 1.5);
      }
      ctx.strokeStyle = shade(body, 0.72);
      ctx.lineWidth = 2;
      for (let i = 0; i < TILES_PER_REPEAT; i += 1) {
        // Offset by half a line width so the joint at 0 isn't clipped in half
        // by the canvas edge and doubled up by the wrap.
        const at = i * cell + 1;
        ctx.beginPath();
        ctx.moveTo(at, 0);
        ctx.lineTo(at, CANVAS_PX);
        ctx.moveTo(0, at);
        ctx.lineTo(CANVAS_PX, at);
        ctx.stroke();
      }
    } else {
      // A poured floor: halls 2-4 are seamless epoxy, and what breaks them up
      // is soft trowel clouding, not aggregate. Speckle here would read as
      // grit on what the photos show as a wet-looking sheet.
      for (let i = 0; i < 14; i += 1) {
        const x = random() * CANVAS_PX;
        const y = random() * CANVAS_PX;
        const r = CANVAS_PX * (0.12 + random() * 0.22);
        // Barely there: the photographed floors are all but uniform, and the
        // variation only registers as a slight unevenness in the sheen. Both
        // stops carry the same RGB so the fade is pure alpha, interpolating
        // toward a bare "transparent" passes through black and haloes.
        const factor = random() < 0.5 ? 0.98 : 1.02;
        const peak = 0.3;
        // Drawn nine times so a cloud crossing an edge comes back on the far
        // side; the texture wraps, and a seam on a mirror-finish floor is the
        // first thing the eye finds.
        for (const dx of [-CANVAS_PX, 0, CANVAS_PX]) {
          for (const dy of [-CANVAS_PX, 0, CANVAS_PX]) {
            const g = ctx.createRadialGradient(
              x + dx,
              y + dy,
              0,
              x + dx,
              y + dy,
              r,
            );
            g.addColorStop(0, rgba(body, factor, peak));
            g.addColorStop(1, rgba(body, factor, 0));
            ctx.fillStyle = g;
            ctx.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
          }
        }
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  const repeatM =
    finish.tile_cm !== null
      ? (finish.tile_cm / 100) * TILES_PER_REPEAT
      : SEAMLESS_REPEAT_M;
  texture.repeat.set(1 / repeatM, 1 / repeatM);
  return texture;
}

/** Gloss 0~1 → material roughness. Hall 1's 0.55 lands at 0.45, which is where
 *  the point lights start throwing the soft reflection the photos show. */
export function glossToRoughness(gloss: number): number {
  return 1 - gloss;
}
