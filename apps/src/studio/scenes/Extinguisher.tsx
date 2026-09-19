import type { HallExtinguisher } from "@galleryis/shared";
import { pointOnWall, type Wall } from "../lib/geometry";

// The red cylinder every hall keeps tucked in beside its entrance doors. It is
// scene dressing, not a placement constraint: it stands about half a metre tall
// against the skirting, well under the works' 150 cm centre line, so it takes
// no hang space and gets no no-hang zone. Positions are seeded in halls_data.py
// and read off photographs, see that module's docstring.

const BODY_COLOR = "#b4231d";
const NECK_COLOR = "#2c2a28";
const LABEL_COLOR = "#f2ece0";

const BODY_R = 0.08;
const BODY_H = 0.42;
const SHOULDER_H = 0.09;
const NECK_H = 0.07;
/** Cylinder centre out from the wall face, its own radius plus a little air. */
const STANDOFF_M = BODY_R + 0.03;

export default function Extinguisher({
  wall,
  extinguisher,
}: {
  wall: Wall;
  extinguisher: HallExtinguisher;
}) {
  const at = pointOnWall(wall, extinguisher.offset_m);
  const { x: nx, z: nz } = wall.inwardNormal;
  return (
    <group
      position={[at.x + nx * STANDOFF_M, 0, at.z + nz * STANDOFF_M]}
      rotation={[0, wall.angleY, 0]}
    >
      <mesh position={[0, BODY_H / 2, 0]}>
        <cylinderGeometry args={[BODY_R, BODY_R, BODY_H, 16]} />
        <meshStandardMaterial color={BODY_COLOR} roughness={0.42} />
      </mesh>
      {/* The domed shoulder, as a truncated cone rather than a sphere: cheaper,
          and at this size the silhouette is all that reads. */}
      <mesh position={[0, BODY_H + SHOULDER_H / 2, 0]}>
        <cylinderGeometry args={[BODY_R * 0.42, BODY_R, SHOULDER_H, 16]} />
        <meshStandardMaterial color={BODY_COLOR} roughness={0.42} />
      </mesh>
      <mesh position={[0, BODY_H + SHOULDER_H + NECK_H / 2, 0]}>
        <cylinderGeometry args={[BODY_R * 0.3, BODY_R * 0.34, NECK_H, 12]} />
        <meshStandardMaterial
          color={NECK_COLOR}
          roughness={0.55}
          metalness={0.3}
        />
      </mesh>
      {/* The pale instruction label, just proud of the drum. */}
      <mesh position={[0, BODY_H * 0.62, BODY_R + 0.002]}>
        <planeGeometry args={[BODY_R * 1.2, BODY_H * 0.4]} />
        <meshStandardMaterial color={LABEL_COLOR} roughness={0.85} />
      </mesh>
    </group>
  );
}
