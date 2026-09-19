import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { cmToM } from "../lib/geometry";
import {
  AIM_ELEVATION_CM,
  TRACK_DROP_M,
  TRACK_OFFSET_M,
  type Fitting,
  type TrackRun,
} from "../lib/lighting";

// The visible half of the halls' lighting: the rail, the spots clipped to it,
// and the pool each one throws on the wall. Positions come from lib/lighting.ts;
// this layer only draws them.
//
// The pools are painted rather than lit. Hung artwork is deliberately unlit
// (see Artworks.tsx, the artist's pixels decide the colour, not the gallery's
// lamps), so a real spot would never touch the thing it is aimed at, and thirty
// of them would cost per-fragment shader work for a wash one additive decal
// renders for free. The few lights that do exist are in HallScene's LightRig,
// standing at fitting positions so the room's shading agrees with the rig.

const RAIL_COLOR = "#e7e2d9";
const BODY_COLOR = "#d6cfc4";
const LENS_COLOR = "#fff4de";
const RAIL_SIZE = 0.05; // square section, metres
const BODY_LENGTH = 0.19;
const BODY_RADIUS = 0.043;
/** Pool size on the wall. Taller than wide: a spot rakes down the plaster. */
const POOL_W = 1.3;
const POOL_H = 1.8;
const POOL_LIFT_M = 0.006; // off the wall, and behind artwork's own 0.02

const POOL_PX = 128;

/** A soft round falloff, drawn once and shared by every pool. */
function makePoolTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = POOL_PX;
  canvas.height = POOL_PX;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const r = POOL_PX / 2;
    const gradient = ctx.createRadialGradient(r, r, 0, r, r, r);
    // A flat-ish core then a long tail: a hard edge reads as a decal, and a
    // straight linear ramp reads as fog.
    //
    // Kept very low on purpose. The plaster is already near-white (#f6f3ed),
    // so additive light saturates it to flat 255 almost immediately, at half
    // opacity the wall becomes a row of glaring discs and the artwork on it
    // disappears. The gallery's own photographs show the pools only a shade
    // brighter than the wall between them, which is what these numbers give.
    gradient.addColorStop(0, "rgba(255, 246, 230, 0.15)");
    gradient.addColorStop(0.35, "rgba(255, 244, 226, 0.10)");
    gradient.addColorStop(0.7, "rgba(255, 242, 222, 0.03)");
    gradient.addColorStop(1, "rgba(255, 240, 220, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, POOL_PX, POOL_PX);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Orientation that points a +Y cylinder down its own beam. */
function beamQuaternion(fitting: Fitting, railY: number, aimY: number) {
  const direction = new THREE.Vector3(
    fitting.aim.x - fitting.at.x,
    aimY - railY,
    fitting.aim.z - fitting.at.z,
  ).normalize();
  return new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, -1, 0),
    direction,
  );
}

export default function TrackLighting({
  runs,
  height,
}: {
  runs: TrackRun[];
  height: number;
}) {
  const pool = useMemo(makePoolTexture, []);
  useEffect(() => () => pool.dispose(), [pool]);
  const railY = height - TRACK_DROP_M;
  const aimY = cmToM(AIM_ELEVATION_CM);

  return (
    <group>
      {runs.map((run) => {
        const length = Math.hypot(run.to.x - run.from.x, run.to.z - run.from.z);
        return (
          <group key={`${run.wallIndex}-${run.from.x}-${run.from.z}`}>
            <mesh
              position={[
                (run.from.x + run.to.x) / 2,
                railY,
                (run.from.z + run.to.z) / 2,
              ]}
              rotation={[0, run.angleY, 0]}
            >
              <boxGeometry args={[length, RAIL_SIZE, RAIL_SIZE]} />
              <meshStandardMaterial color={RAIL_COLOR} roughness={0.6} />
            </mesh>
            {run.fittings.map((fitting) => {
              // at − aim is the wall's inward normal times the rail offset, so
              // dividing by that offset is the unit normal back to the wall.
              const nx = (fitting.at.x - fitting.aim.x) / TRACK_OFFSET_M;
              const nz = (fitting.at.z - fitting.aim.z) / TRACK_OFFSET_M;
              return (
                <group key={`${fitting.at.x}-${fitting.at.z}`}>
                  <group
                    position={[fitting.at.x, railY, fitting.at.z]}
                    quaternion={beamQuaternion(fitting, railY, aimY)}
                  >
                    {/* Body hangs off the rail, down its own beam. */}
                    <mesh position={[0, -BODY_LENGTH / 2 - RAIL_SIZE / 2, 0]}>
                      <cylinderGeometry
                        args={[
                          BODY_RADIUS,
                          BODY_RADIUS * 0.86,
                          BODY_LENGTH,
                          12,
                        ]}
                      />
                      <meshStandardMaterial
                        color={BODY_COLOR}
                        roughness={0.45}
                        metalness={0.15}
                      />
                    </mesh>
                    {/* The lit lens at the muzzle. */}
                    <mesh position={[0, -BODY_LENGTH - RAIL_SIZE / 2, 0]}>
                      <circleGeometry args={[BODY_RADIUS * 0.82, 12]} />
                      <meshBasicMaterial
                        color={LENS_COLOR}
                        toneMapped={false}
                        side={THREE.DoubleSide}
                      />
                    </mesh>
                  </group>
                  {/* Rotating a plane by the wall's angleY turns its front face
                      along the inward normal, so this looks into the room. */}
                  <mesh
                    position={[
                      fitting.aim.x + nx * POOL_LIFT_M,
                      aimY,
                      fitting.aim.z + nz * POOL_LIFT_M,
                    ]}
                    rotation={[0, run.angleY, 0]}
                  >
                    <planeGeometry args={[POOL_W, POOL_H]} />
                    <meshBasicMaterial
                      map={pool}
                      transparent
                      depthWrite={false}
                      blending={THREE.AdditiveBlending}
                      toneMapped={false}
                    />
                  </mesh>
                </group>
              );
            })}
          </group>
        );
      })}
    </group>
  );
}
