import { Html, useCursor } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import * as THREE from "three";
import { cmToM, pointOnWall, type Wall } from "../lib/geometry";
import { overlappingIds } from "../lib/placement";
import { useWorksStore, type Work } from "../store/works";

// The hung works, as color-true planes riding their walls. All placement math
// lives in the store (snap/clamp/door happen in moveTo); this layer converts
// pointer drags into raw wall coordinates and renders the result.

const LIFT_M = 0.02; // off the wall face, clear of z-fighting and the jambs
const OUTLINE_M = 0.05; // selection border reaching past each edge
const SELECT_COLOR = "#f26522"; // mirrors --color-accent
// Hall-interior materials, deliberately NOT tied to the UI token layer any
// more: the chrome went to a near-black ground, but the room itself is still
// white plaster, and a lit hall inside dark chrome is the whole point.
const PAPER = "#fbf8f2"; // the work's mat, a shade lighter than the wall
const HAIRLINE = "#594540"; // the plan-stroke, dark on a white wall

function wallCoordinates(wall: Wall, point: THREE.Vector3): number {
  return (
    ((point.x - wall.a.x) * (wall.b.x - wall.a.x) +
      (point.z - wall.a.z) * (wall.b.z - wall.a.z)) /
    wall.length
  );
}

function ArtworkMesh({
  work,
  wall,
  selected,
  overlapping,
  onDragStart,
}: {
  work: Work;
  wall: Wall;
  selected: boolean;
  overlapping: boolean;
  onDragStart: (pointerId: number) => void;
}) {
  const { t } = useTranslation();
  const gl = useThree((state) => state.gl);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);
  const texture = useMemo(() => {
    // Non-null in edit mode by construction; review renders ReviewFrame.
    const map = new THREE.CanvasTexture(work.canvas!);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    return map;
  }, [gl, work.canvas]);
  useEffect(() => () => texture.dispose(), [texture]);

  const width = cmToM(work.width_cm);
  const height = cmToM(work.height_cm);
  const at = pointOnWall(wall, work.offset_m);
  const normal = wall.inwardNormal;
  const y = cmToM(work.elevation_cm);

  return (
    <group
      position={[at.x + normal.x * LIFT_M, y, at.z + normal.z * LIFT_M]}
      rotation={[0, wall.angleY, 0]}
    >
      {selected && (
        <mesh position={[0, 0, -LIFT_M / 2]}>
          <planeGeometry args={[width + OUTLINE_M, height + OUTLINE_M]} />
          <meshBasicMaterial color={SELECT_COLOR} toneMapped={false} />
        </mesh>
      )}
      <mesh
        onPointerDown={(event) => {
          event.stopPropagation();
          onDragStart(event.pointerId);
        }}
        // Without this the browser click a clean tap generates carries on to
        // the floor behind the wall (walls hold no handlers, so they never
        // occlude events), deselecting the work and gliding the camera.
        onClick={(event) => event.stopPropagation()}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <planeGeometry args={[width, height]} />
        {/* Unlit and un-tone-mapped: the artist's pixels, not the gallery's
            lighting, decide the colour. */}
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      {overlapping && (
        <Html
          position={[0, height / 2 + 0.16, 0]}
          center
          zIndexRange={[10, 0]}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          <span className="rounded-full bg-ink px-3 py-1 text-sm whitespace-nowrap text-ground shadow-sm">
            {t("works.overlap")}
          </span>
        </Html>
      )}
    </group>
  );
}

/**
 * A work in a submitted plan: the gallery gets the size and the position, not
 * the picture. A pale sheet with a hairline edge and a faint cross, it has to
 * read as "a work goes here" and never be mistaken for the work itself.
 *
 * The cm label is drei `<Html>`, so it is DOM: legible at any distance, and
 * assertable in Playwright, which cannot read SwiftShader's pixels.
 */
function ReviewFrame({ work, wall }: { work: Work; wall: Wall }) {
  const width = cmToM(work.width_cm);
  const height = cmToM(work.height_cm);
  const at = pointOnWall(wall, work.offset_m);
  const normal = wall.inwardNormal;
  const outline = useMemo(
    () => new THREE.EdgesGeometry(new THREE.PlaneGeometry(width, height)),
    [width, height],
  );
  useEffect(() => () => outline.dispose(), [outline]);
  const cross = useMemo(() => {
    const half = new THREE.Vector2(width / 2, height / 2);
    return new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-half.x, -half.y, 0),
      new THREE.Vector3(half.x, half.y, 0),
      new THREE.Vector3(-half.x, half.y, 0),
      new THREE.Vector3(half.x, -half.y, 0),
    ]);
  }, [width, height]);
  useEffect(() => () => cross.dispose(), [cross]);

  return (
    <group
      position={[
        at.x + normal.x * LIFT_M,
        cmToM(work.elevation_cm),
        at.z + normal.z * LIFT_M,
      ]}
      rotation={[0, wall.angleY, 0]}
    >
      <mesh>
        <planeGeometry args={[width, height]} />
        {/* Unlit, like a real hung work: the hall's lighting must not make one
            applicant's plan read warmer than another's. */}
        <meshBasicMaterial
          color={PAPER}
          opacity={0.55}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {/* A true hairline at any distance, and no z-fighting, unlike the
          scaled-plane trick the selection border uses. */}
      <lineSegments geometry={outline}>
        <lineBasicMaterial color={HAIRLINE} toneMapped={false} />
      </lineSegments>
      <lineSegments geometry={cross}>
        <lineBasicMaterial
          color={HAIRLINE}
          transparent
          opacity={0.2}
          toneMapped={false}
        />
      </lineSegments>
      <Html
        center
        zIndexRange={[10, 0]}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        <span className="rounded-full bg-ink/90 px-2.5 py-0.5 text-sm whitespace-nowrap text-ground tabular-nums backdrop-blur">
          {work.name}. {work.width_cm} × {work.height_cm} cm
        </span>
      </Html>
    </group>
  );
}

export default function Artworks({ walls }: { walls: Wall[] }) {
  const mode = useWorksStore((state) => state.mode);
  // A whole subtree rather than conditionals inside ArtworkMesh: in review the
  // drag, cursor and Delete-key effects below must never mount at all.
  if (mode === "review") return <ReviewFrames walls={walls} />;
  return <EditableArtworks walls={walls} />;
}

function ReviewFrames({ walls }: { walls: Wall[] }) {
  const works = useWorksStore((state) => state.works);
  return (
    <>
      {works.map((work) => {
        const wall = walls[work.wall_index];
        return wall ? (
          <ReviewFrame key={work.id} work={work} wall={wall} />
        ) : null;
      })}
    </>
  );
}

function EditableArtworks({ walls }: { walls: Wall[] }) {
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const works = useWorksStore((state) => state.works);
  const selectedId = useWorksStore((state) => state.selectedId);
  const draggingId = useWorksStore((state) => state.draggingId);
  const overlaps = useMemo(() => overlappingIds(works), [works]);
  // Which pointer owns the live drag, a second touch must neither steer,
  // hijack, nor end it.
  const dragPointer = useRef<number | null>(null);

  const startDrag = (workId: string, pointerId: number) => {
    if (useWorksStore.getState().draggingId) return;
    dragPointer.current = pointerId;
    useWorksStore.getState().setDragging(workId);
  };

  // A drag stranded by unmount (history navigation with the button held)
  // must not leave both camera rigs locked when the scene returns.
  useEffect(() => () => useWorksStore.getState().setDragging(null), []);

  // An active drag follows the pointer across every wall panel (they carry
  // their wallIndex in userData); the store clamps whatever this reports.
  useEffect(() => {
    if (!draggingId) return;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const panels: THREE.Object3D[] = [];
    scene.traverse((object) => {
      if (object.userData.wallIndex !== undefined) panels.push(object);
    });
    const endDrag = (event: PointerEvent) => {
      if (event.pointerId !== dragPointer.current) return;
      dragPointer.current = null;
      useWorksStore.getState().setDragging(null);
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== dragPointer.current) return;
      // A release the window never saw (mouse let go outside the browser)
      // shows up as a buttons-free move, treat it as the missed pointerup.
      if (event.buttons === 0) {
        endDrag(event);
        return;
      }
      const bounds = gl.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      // Only faces looking at the camera count. The panels' FrontSide plaster
      // already drops a backface hit, and their dark exterior twin doesn't
      // raycast at all, but a drag must never land on the far side of a wall,
      // so the check stays here rather than resting on the materials.
      const hit = raycaster
        .intersectObjects(panels, false)
        .find((candidate) => {
          const wall = walls[candidate.object.userData.wallIndex as number];
          return (
            wall &&
            raycaster.ray.direction.x * wall.inwardNormal.x +
              raycaster.ray.direction.z * wall.inwardNormal.z <
              0
          );
        });
      if (!hit) return;
      const wallIndex = hit.object.userData.wallIndex as number;
      useWorksStore
        .getState()
        .moveTo(
          draggingId,
          wallIndex,
          wallCoordinates(walls[wallIndex], hit.point),
          hit.point.y * 100,
        );
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, [camera, draggingId, gl, scene, walls]);

  // Desktop: Delete/Backspace removes the selected work, unless the user is
  // typing in the panel's cm inputs.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      )
        return;
      const { selectedId: selected, removeWork } = useWorksStore.getState();
      if (selected) removeWork(selected);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {works.map((work) => {
        const wall = walls[work.wall_index];
        if (!wall) return null;
        return (
          <ArtworkMesh
            key={work.id}
            work={work}
            wall={wall}
            selected={work.id === selectedId}
            overlapping={overlaps.has(work.id)}
            onDragStart={(pointerId) => startDrag(work.id, pointerId)}
          />
        );
      })}
    </>
  );
}
