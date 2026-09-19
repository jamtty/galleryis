import type { HallWindow } from "@galleryis/shared";
import * as THREE from "three";
import { cmToM, pointOnWall, type Wall } from "../lib/geometry";
import StreetView from "./StreetView";

// Hall 1's street shopfront. Frameless butt-jointed panes as the photos show
// (galleryis_1F_01.jpg, 1-1.jpg) rather than the isometric's bronze mullions:
// a head trim, a floor track, and a hairline every couple of metres.
//
// Same local frame as <Doorway>: +x along the wall (a→b), +z into the room.

const GLASS_COLOR = "#cfdbe0";
const TRIM_COLOR = "#2f2c29";
const DAYLIGHT_COLOR = "#eaf1f7";

const TRIM_DEPTH = 0.05;
const HEAD_TRIM = 0.05;
const FLOOR_TRACK = 0.04;
/** Butt joints run about this far apart across the real shopfront. */
const JOINT_SPACING = 2.3;
const JOINT_WIDTH = 0.02;

export default function Glazing({
  wall,
  window: win,
  // Only the walk camera stands inside looking out. From the dollhouse the
  // street is seen from behind and above, where flat unlit scenery reads as
  // loose panels stuck to the model, the same reason the doorway's vestibule
  // box is walk-only.
  enclosed,
}: {
  wall: Wall;
  window: HallWindow;
  enclosed: boolean;
}) {
  const centre = pointOnWall(wall, win.offset_m);
  const sill = cmToM(win.sill_cm);
  const head = cmToM(win.head_cm);
  const height = head - sill;
  const width = win.width_m;
  // Interior joints only, the ones at the ends are the reveals.
  const joints = Math.max(0, Math.ceil(width / JOINT_SPACING) - 1);

  return (
    <group position={[centre.x, 0, centre.z]} rotation={[0, wall.angleY, 0]}>
      <mesh
        position={[0, sill + height / 2, 0]}
        // Glass is never a drop target, the drag raycast in Artworks looks for
        // wall panels, and this must not answer for one.
        raycast={() => null}
      >
        <planeGeometry args={[width, height]} />
        <meshPhysicalMaterial
          color={GLASS_COLOR}
          transparent
          // Walking, the glass has to get out of the way of the street. From
          // the dollhouse there is no street behind it, so a near-clear pane
          // just shows the charcoal floor and reads as a dark wall; leaning on
          // the tint is what keeps it legible as glazing.
          opacity={enclosed ? 0.16 : 0.34}
          roughness={0.05}
          metalness={0}
          side={THREE.DoubleSide}
          // Two perpendicular runs meet at the corner column; without this the
          // nearer pane depth-culls the farther one instead of blending.
          depthWrite={false}
        />
      </mesh>

      <mesh position={[0, head - HEAD_TRIM / 2, 0]} raycast={() => null}>
        <boxGeometry args={[width, HEAD_TRIM, TRIM_DEPTH]} />
        <meshStandardMaterial color={TRIM_COLOR} roughness={0.6} />
      </mesh>
      <mesh position={[0, sill + FLOOR_TRACK / 2, 0]} raycast={() => null}>
        <boxGeometry args={[width, FLOOR_TRACK, TRIM_DEPTH]} />
        <meshStandardMaterial color={TRIM_COLOR} roughness={0.6} />
      </mesh>
      {Array.from({ length: joints }, (_, i) => {
        const at = -width / 2 + (width * (i + 1)) / (joints + 1);
        return (
          <mesh
            key={at}
            position={[at, sill + height / 2, 0]}
            raycast={() => null}
          >
            <boxGeometry args={[JOINT_WIDTH, height, TRIM_DEPTH]} />
            <meshStandardMaterial color={TRIM_COLOR} roughness={0.6} />
          </mesh>
        );
      })}

      {/* Daylight through the opening, what makes the glazed corner read as
          lit from outside rather than as a tinted panel. A directional light's
          default target is an Object3D outside the scene graph, so it aims at
          the world origin: the recentred footprint puts that mid-floor, which
          is exactly where we want the light thrown. */}
      <directionalLight
        position={[0, height * 0.9, -4]}
        intensity={1.3}
        color={DAYLIGHT_COLOR}
      />
      {enclosed && <StreetView width={width} />}
    </group>
  );
}
