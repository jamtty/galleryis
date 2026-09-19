import { useEffect, useMemo } from "react";
import * as THREE from "three";

// What you see through hall 1's shopfront: Insadong, suggested rather than
// depicted. Flat unlit planes only, the real street is a scraped photo we may
// not republish (§7), and unlit is what makes the outside read as daylight
// against a warm-lit room without a second light rig to sell it.
//
// The composition follows galleryis_1F_01.jpg: a wide band of pale paving
// across the bottom, dark shopfronts opposite at eye level, a cool facade
// above, and near tree trunks running the full height of the opening.
//
// Local space matches <Glazing>: +x runs along the wall, +z points into the
// room, so everything here sits at negative z.

const SKY_TOP = "#e4ecf1";
const SKY_HORIZON = "#d5dad9";
const PAVING = "#b4aea5";
const KERB = "#9b958c";
/** The shop interiors opposite, the darkest thing in the view, and what gives
 *  the street its depth. Without it every plane sits at the same value. */
const SHOPFRONT = "#6c665f";
const AWNING = "#9d9490";
const FACADE = "#c3bcb1";
const FOLIAGE = "#7f8d76";
const TRUNK = "#6d6459";

/** Metres out to the row opposite, and to the sky behind it. Far enough that a
 *  standing eye sees a real band of paving before the facade starts. */
const FACADE_Z = 9;
const BACKDROP_Z = 11;
/** Shop-to-shop spacing on the row opposite, Insadong's are narrow. */
const SHOP_PITCH = 3.2;

function useSkyTexture(): THREE.CanvasTexture | null {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, SKY_TOP);
    gradient.addColorStop(1, SKY_HORIZON);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const made = new THREE.CanvasTexture(canvas);
    made.colorSpace = THREE.SRGBColorSpace;
    return made;
  }, []);
  useEffect(() => () => texture?.dispose(), [texture]);
  return texture;
}

// Near enough to the glass to run out of the top of the opening, which is what
// puts the street at arm's length rather than behind a picture.
function Tree({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 2.4, 0]}>
        <boxGeometry args={[0.34, 4.8, 0.34]} />
        <meshBasicMaterial color={TRUNK} />
      </mesh>
      {/* Two offset discs read as a canopy from the angles a walker can reach,
          without the cost of a billboard or an alpha-cut texture. */}
      <mesh position={[0, 3.9, 0]}>
        <circleGeometry args={[1.5, 20]} />
        <meshBasicMaterial color={FOLIAGE} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0.5, 3.3, 0.35]} rotation={[0, Math.PI / 3, 0]}>
        <circleGeometry args={[1.1, 20]} />
        <meshBasicMaterial color={FOLIAGE} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** The street beyond one glazed span, `width` metres wide. */
export default function StreetView({ width }: { width: number }) {
  const sky = useSkyTexture();
  // Wide enough to cover the opening at an oblique look, without being so wide
  // that the two windows' backdrops read as one continuous wall at the corner.
  const spread = width + 10;
  const shops = Math.round(spread / SHOP_PITCH);
  return (
    <group>
      <mesh position={[0, 3, -BACKDROP_Z]}>
        <planeGeometry args={[spread * 1.5, 14]} />
        <meshBasicMaterial map={sky} color={sky ? "#ffffff" : SKY_TOP} />
      </mesh>
      {/* Paving, from just under the floor track out to the row opposite. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, -FACADE_Z / 2]}
      >
        <planeGeometry args={[spread * 1.5, FACADE_Z + 2]} />
        <meshBasicMaterial color={PAVING} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.005, -FACADE_Z + 0.7]}
      >
        <planeGeometry args={[spread * 1.5, 0.5]} />
        <meshBasicMaterial color={KERB} />
      </mesh>
      {/* The row opposite. A single dark band at eye level would read as one
          more horizontal stripe; punching separate shop openings into a plain
          facade gives the verticals that make it a street. */}
      <mesh position={[0, 3.4, -FACADE_Z]}>
        <planeGeometry args={[spread, 6.8]} />
        <meshBasicMaterial color={FACADE} />
      </mesh>
      {Array.from({ length: shops }, (_, i) => {
        const at = (i - (shops - 1) / 2) * SHOP_PITCH;
        return (
          <group key={at} position={[at, 0, -FACADE_Z + 0.05]}>
            <mesh position={[0, 1.15, 0]}>
              <planeGeometry args={[SHOP_PITCH - 0.7, 2.3]} />
              <meshBasicMaterial color={SHOPFRONT} />
            </mesh>
            <mesh position={[0, 2.48, 0.05]}>
              <planeGeometry args={[SHOP_PITCH - 0.4, 0.36]} />
              <meshBasicMaterial color={AWNING} />
            </mesh>
          </group>
        );
      })}
      <Tree x={-width * 0.3} z={-3.2} />
      <Tree x={width * 0.34} z={-4.4} />
      {/* The granite kerb benches that sit right outside the glass. */}
      <mesh position={[width * 0.05, 0.22, -2.1]}>
        <boxGeometry args={[1.4, 0.44, 0.5]} />
        <meshBasicMaterial color={KERB} />
      </mesh>
    </group>
  );
}
