import type {
  FootprintVertex,
  Hall,
  HallDesk,
  HallDoor,
  HallExtinguisher,
  HallFloor,
  HallWindow,
} from "@galleryis/shared";
import { Html, Line, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import * as THREE from "three";
import { clampToInterior, pointInPolygon } from "../lib/collision";
import { glossToRoughness, makeTileTexture } from "../lib/floorTexture";
import {
  boundingBox,
  cmToM,
  deskOutline,
  deskRects,
  normalizeFootprint,
  openingFromDoor,
  openingFromWindow,
  pointOnWall,
  polygonCentroid,
  wallPanels,
  wallsFromFootprint,
  type Wall,
} from "../lib/geometry";
import type { Turn } from "../lib/glide";
import {
  keyFittings,
  TRACK_DROP_M,
  trackRuns,
  type TrackRun,
} from "../lib/lighting";
import { viewpointFor } from "../lib/viewpoint";
import { useCameraStore } from "../store/camera";
import { useWorksStore } from "../store/works";
import Artworks from "./Artworks";
import Extinguisher from "./Extinguisher";
import FirstPersonRig, {
  EYE_HEIGHT,
  PITCH_LIMIT,
  PLAYER_RADIUS,
} from "./FirstPersonRig";
import Glazing from "./Glazing";
import StudioEnvironment from "./StudioEnvironment";
import TrackLighting from "./TrackLighting";

const WALL_COLOR = "#f6f3ed";
const FLOOR_COLOR = "#c9c1b4";
const CEILING_COLOR = "#f2efe9";
// The void the model floats in, and the fog that fades its far edges into it.
// A clear step darker than both the page ground (#faf9f7) and the hall's own
// plaster (#f6f3ed): the model is a white room, and a white room on a white
// void has no silhouette. Safe for the interior because fog starts at
// reach * 2, twice the hall's longest dimension, so neither the walls nor
// the street seen through hall 1's shopfront is ever fogged.
const VOID_COLOR = "#e8e4db";
// The outside of the model, added on the gallery's own note (2026-08-27):
// "확실하게 구분이 가면 좋겠다". A wall is a single plane, so until now its
// back wore the same plaster as its face and the dollhouse read as one pale
// mass on a pale void. The back of every panel takes this dark grey and the
// wall tops are capped with a black line, so from the orbit view the hall is
// unmistakably a room seen from outside.
const EXTERIOR_COLOR = "#575450";
const OUTLINE_COLOR = "#181716";
const OUTLINE_WIDTH = 2;
/** How far a line of the outside stands off the wall it draws — a corner along
 *  its bisector, a foot straight out from its wall. */
const CORNER_LIFT_M = 0.015;
/** And how far out the same direction is sampled to ask whether what lies
 *  outside is open air or more room. A hand's width: past hall 3's 12 cm
 *  partition, nowhere near across any hall. */
const CORNER_OPEN_M = 0.3;
const FRAME_COLOR = "#6f5c52";
// The lobby beyond, which since the leaf was glazed is only ever seen through
// it. Lighter than the dark box it used to be: behind glass, a dim cavity
// reads as a solid panel, and a lit space is what tells you the pane is glass.
const VESTIBULE_COLOR = "#776e66";
// "색상은 전체 연한 그레이" — the gallery's 2026-08-29 note on the 3D read. The
// counter was a warm sand body under a brown top; it is one grey now, top and
// base alike, told apart by the sheen of the slab and the reveal under it
// rather than by a second colour.
//
// The albedo is a good deal darker than the light grey it is meant to read as:
// the track runs right over the counter, and the first try at a literal light
// grey came back off the render at 226 against the plaster's 242 — the gallery
// saw white and asked for grey again. This lands the lit faces near 197, a
// clear step off the wall while still a light grey in the room.
const DESK_COLOR = "#9c9c9c";
const TAP_SLOP_PX = 5;

// The leaf, from the same note: "전시장 출입문은 닫힌 상태로 유리문으로". The
// halls' own doors are a slim-framed glass leaf standing closed in the frame.
// It used to be drawn swung 84° into the room — the plans' convention, and a
// door the walker could stroll straight through.
const GLASS_COLOR = "#cfdbe0";
/** The leaf's own timber, a shade lighter than the frame it stands in. */
const RAIL_COLOR = "#7d6a5f";
const HANDLE_COLOR = "#9a9791";
const LEAF_THICKNESS = 0.04;
/** Section of the stiles and the head rail, and the deeper kick rail. */
const LEAF_RAIL = 0.06;
const LEAF_KICK = 0.11;
const HANDLE_LENGTH = 0.34;
const HANDLE_ELEVATION = 1.05;
const VESTIBULE_DEPTH = 1.2;
const FRAME_WIDTH = 0.06;

/** The counter's top slab, and how far its base is set back under it. */
const DESK_TOP_M = 0.05;
const DESK_REVEAL_M = 0.03;

const OVERVIEW_FOV = 55;
const WALK_FOV = 68;

// Orbit start/reset position, as multiples of the room's longest span. Scaled
// against the old 45° framing by tan(22.5°)/tan(27.5°) so the wider overview
// FOV doesn't push the dollhouse into the distance.
function overviewPosition(reach: number): [number, number, number] {
  return [reach * 0.6, reach * 0.76, reach * 0.6];
}

// The entrance, sunk into the wall that carries it. Inside this group local +x
// runs along the wall (a→b) and local +z points into the room, which is what
// the wall's own rotation about Y gives us.
function Doorway({
  wall,
  door,
  enclosed,
}: {
  wall: Wall;
  door: HallDoor;
  // Only the walk camera is inside the room; from the dollhouse the vestibule
  // would read as a dark box stuck to the outside of the building.
  enclosed: boolean;
}) {
  const width = cmToM(door.width_cm);
  const height = cmToM(door.height_cm);
  const centre = pointOnWall(wall, door.offset_m);
  const jamb = width / 2 + FRAME_WIDTH / 2;
  return (
    <group position={[centre.x, 0, centre.z]} rotation={[0, wall.angleY, 0]}>
      {/* Seen through the opening: the back faces of a box behind the wall, so
          the doorway reads as a lobby beyond rather than a hole to nowhere. */}
      {enclosed && (
        <mesh position={[0, height / 2, -VESTIBULE_DEPTH / 2]}>
          <boxGeometry args={[width + 0.24, height + 0.12, VESTIBULE_DEPTH]} />
          <meshStandardMaterial
            color={VESTIBULE_COLOR}
            roughness={1}
            side={THREE.BackSide}
          />
        </mesh>
      )}
      {[-jamb, jamb].map((x) => (
        <mesh key={x} position={[x, height / 2, 0.02]}>
          <boxGeometry args={[FRAME_WIDTH, height + FRAME_WIDTH, 0.1]} />
          <meshStandardMaterial color={FRAME_COLOR} roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[0, height + FRAME_WIDTH / 2, 0.02]}>
        <boxGeometry args={[width + FRAME_WIDTH * 2, FRAME_WIDTH, 0.1]} />
        <meshStandardMaterial color={FRAME_COLOR} roughness={0.7} />
      </mesh>
      {/* The leaf, closed in its frame: a tinted pane inside a slim rail, and
          the pull on the free edge — hinged at the jamb further along the
          wall, as every plan draws it, so the handle stands at the other. None
          of it answers a raycast: glass is never a drop target, and the drag
          in Artworks looks for wall panels through this opening. */}
      <mesh position={[0, height / 2, 0]} raycast={() => null}>
        <planeGeometry args={[width, height]} />
        <meshPhysicalMaterial
          color={GLASS_COLOR}
          transparent
          // Walking, the glass has to get out of the way of the lobby behind
          // it. From the dollhouse there is no lobby — the box is walk-only —
          // so the pane stands against the pale void, and leaning on the tint
          // is what keeps a cool sheet of glass in a warm plaster wall.
          opacity={enclosed ? 0.42 : 0.6}
          roughness={0.05}
          // A little of <StudioEnvironment> in it, which the shopfront does
          // without: the street carries that glazing, while this leaf has only
          // a lobby behind it and the sheen is what says the pane is glass.
          metalness={0.2}
          envMapIntensity={0.9}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {[
        [LEAF_KICK / 2, LEAF_KICK],
        [height - LEAF_RAIL / 2, LEAF_RAIL],
      ].map(([y, section]) => (
        <mesh key={y} position={[0, y, 0]} raycast={() => null}>
          <boxGeometry args={[width, section, LEAF_THICKNESS]} />
          <meshStandardMaterial color={RAIL_COLOR} roughness={0.55} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[(side * (width - LEAF_RAIL)) / 2, height / 2, 0]}
          raycast={() => null}
        >
          <boxGeometry args={[LEAF_RAIL, height, LEAF_THICKNESS]} />
          <meshStandardMaterial color={RAIL_COLOR} roughness={0.55} />
        </mesh>
      ))}
      {/* The pull, on the room side of the free edge — the one face anyone in
          the hall ever reaches for. */}
      <mesh
        position={[
          -width / 2 + LEAF_RAIL + 0.07,
          HANDLE_ELEVATION,
          LEAF_THICKNESS / 2 + 0.03,
        ]}
        raycast={() => null}
      >
        <boxGeometry args={[0.03, HANDLE_LENGTH, 0.03]} />
        <meshStandardMaterial
          color={HANDLE_COLOR}
          roughness={0.35}
          metalness={0.6}
        />
      </mesh>
    </group>
  );
}

/** A closed footprint polygon as a shape on the ground plane, which a mesh
 *  rotated a quarter turn about x lays back down flat. */
function groundShape(outline: FootprintVertex[]): THREE.Shape {
  const shape = new THREE.Shape();
  outline.forEach((v, i) =>
    i === 0 ? shape.moveTo(v.x, v.z) : shape.lineTo(v.x, v.z),
  );
  shape.closePath();
  return shape;
}

// The counter, extruded from the L that `deskOutline` builds: a top slab, and
// a base set back under it so the slab keeps its shadow line now that the two
// are the same grey. Extruded rather than boxed because an L drawn as two
// boxes has to overlap at the corner, and two coincident slab faces at the
// same height flicker against each other.
function Desk({
  desk,
  entrance,
}: {
  desk: HallDesk;
  entrance: FootprintVertex | null;
}) {
  const height = cmToM(desk.height_cm);
  const top = useMemo(
    () => groundShape(deskOutline(desk, entrance)),
    [desk, entrance],
  );
  const base = useMemo(
    () => groundShape(deskOutline(desk, entrance, -DESK_REVEAL_M)),
    [desk, entrance],
  );
  return (
    <group>
      {/* Extrusion runs along the shape's own +z, which the quarter turn sends
          straight down, so each mesh sits at the top of what it extrudes. */}
      <mesh
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, height - DESK_TOP_M, 0]}
      >
        <extrudeGeometry
          args={[base, { depth: height - DESK_TOP_M, bevelEnabled: false }]}
        />
        <meshStandardMaterial color={DESK_COLOR} roughness={0.85} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, height, 0]}>
        <extrudeGeometry
          args={[top, { depth: DESK_TOP_M, bevelEnabled: false }]}
        />
        <meshStandardMaterial color={DESK_COLOR} roughness={0.45} />
      </mesh>
    </group>
  );
}

// DOM billboards rather than SDF text: Korean renders correctly with the app's
// own fonts and nothing has to be fetched at runtime.
function FeatureLabel({
  position,
  children,
}: {
  position: [number, number, number];
  children: string;
}) {
  return (
    // No distanceFactor: a marker that scales with distance is unreadable
    // across the dollhouse and overwhelming at arm's length in walk mode.
    <Html
      position={position}
      center
      zIndexRange={[10, 0]}
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      <span className="rounded-full bg-ink/85 px-3 py-1 text-sm whitespace-nowrap text-ground shadow-sm backdrop-blur">
        {children}
      </span>
    </Html>
  );
}

// The floor finish off the hall doc, as a repeating canvas texture. Halls that
// predate the field fall back to the old flat colour.
function FloorMaterial({ finish }: { finish: HallFloor | null }) {
  const maxAnisotropy = useThree((state) =>
    state.gl.capabilities.getMaxAnisotropy(),
  );
  const texture = useMemo(() => {
    if (!finish) return null;
    const made = makeTileTexture(finish);
    made.anisotropy = maxAnisotropy;
    return made;
  }, [finish, maxAnisotropy]);
  useEffect(() => () => texture?.dispose(), [texture]);
  if (!finish || !texture)
    return (
      <meshStandardMaterial
        color={FLOOR_COLOR}
        roughness={0.95}
        side={THREE.DoubleSide}
      />
    );
  return (
    <meshStandardMaterial
      map={texture}
      roughness={glossToRoughness(finish.gloss)}
      metalness={0.04}
      // Reflects <StudioEnvironment>; without it a glossy floor only darkens.
      // Weighted to gloss, so hall 1's matt-ish tile takes distinctly less of
      // the reflection than the epoxy floors that are meant to look wet.
      envMapIntensity={0.25 + finish.gloss * 0.55}
      side={THREE.DoubleSide}
    />
  );
}

/** One black line of the outside: where it runs, and the outward normals of
 *  the wall or walls it draws the edge of, which is how the view lights it. */
interface OutsideEdge {
  key: string;
  /** Where the camera's side of those walls is measured from. */
  at: FootprintVertex;
  faces: FootprintVertex[];
  points: [number, number, number][];
}

/**
 * The black edges of the outside — one up each corner, one along the foot of
 * each outside wall — each lit only while the outside it draws is the side you
 * are looking at.
 *
 * Standing a line off the wall is enough to make the plaster hide it from
 * within the room in principle, but 1.5 cm at twenty metres is thinner than
 * the depth buffer can tell apart, and the far ones came through the plaster
 * as dashes. So the view decides instead of the depth test: a line is an edge
 * of the outside exactly when the camera is on the outside of one of the walls
 * it belongs to, which is also the plain-language rule — you can see the dark
 * side of one of them.
 */
function OutsideEdges({ edges }: { edges: OutsideEdge[] }) {
  const lines = useRef<(THREE.Object3D | null)[]>([]);
  useFrame(({ camera }) => {
    edges.forEach((edge, i) => {
      const line = lines.current[i];
      if (!line) return;
      const outX = camera.position.x - edge.at.x;
      const outZ = camera.position.z - edge.at.z;
      line.visible = edge.faces.some(
        (face) => outX * face.x + outZ * face.z > 0,
      );
    });
  });
  return edges.map((edge, i) => (
    <Line
      key={edge.key}
      ref={(line: THREE.Object3D | null) => {
        lines.current[i] = line;
      }}
      points={edge.points}
      color={OUTLINE_COLOR}
      lineWidth={OUTLINE_WIDTH}
    />
  ));
}

function Room({
  footprint,
  height,
  door,
  desk,
  entrance,
  windows,
  extinguishers,
  floorFinish,
  showCeiling,
  onFloorClick,
  onFloorMove,
  onFloorLeave,
}: {
  footprint: FootprintVertex[];
  height: number;
  door: HallDoor | null;
  desk: HallDesk | null;
  /** Where the door stands, which is what turns the counter's L. */
  entrance: FootprintVertex | null;
  windows: HallWindow[] | null;
  extinguishers: HallExtinguisher[] | null;
  floorFinish: HallFloor | null;
  // Overview is a dollhouse (ceiling off); the walk mode turns it on.
  showCeiling: boolean;
  onFloorClick?: (point: FootprintVertex, pointerType: string) => void;
  onFloorMove?: (point: FootprintVertex, pointerType: string) => void;
  onFloorLeave?: (pointerType: string) => void;
}) {
  const walls = useMemo(() => wallsFromFootprint(footprint), [footprint]);
  const shape = useMemo(() => groundShape(footprint), [footprint]);
  // The footprint traced at ceiling height, closed back onto its first vertex:
  // the top edge of every wall, near and far, which is exactly the silhouette
  // the gallery marked in black. Every opening's head sits below the ceiling
  // (the shopfront's is 250 of hall 1's 280), so the line always runs on solid
  // wall rather than over a hole.
  const topEdge = useMemo(
    () =>
      [...footprint, footprint[0]].map(
        (v) => [v.x, height, v.z] as [number, number, number],
      ),
    [footprint, height],
  );
  // The building's corners, floor to ceiling.
  //
  // Footprint vertices only: the wall meshes are split at every door and
  // window, and a line down each of those seams would draw jambs, not corners.
  // A vertex earns one when the building turns a corner there, either way
  // about, and there is open air on the outside of the turn.
  //
  // Either way about, because a corner that turns inward — the notch all four
  // halls share, where the plan steps back from the neighbour — is two
  // exterior faces meeting in a crease, and a crease at this hour of the light
  // rig is two nearly equal greys with a soft seam between them. It is the
  // same case the outward corners were drawn for.
  //
  // The open-air test is what keeps a line out of the white room, and it takes
  // both kinds: hall 3's partition is a 12 cm peninsula whose two faces both
  // look into the room, so what lies outside its tip — an inward turn of its
  // own — is the slab itself and then more room.
  const corners = useMemo(() => {
    const found: OutsideEdge[] = [];
    footprint.forEach((v, i) => {
      const previous = footprint[(i - 1 + footprint.length) % footprint.length];
      const next = footprint[(i + 1) % footprint.length];
      // Positive is a left turn, and the footprint is CCW, so positive turns
      // outward and negative inward; either is a corner. Zero is a vertex the
      // wall runs straight through — hall 3 has one, where the partition
      // leaves the party wall — and has no edge to draw.
      const turn =
        (v.x - previous.x) * (next.z - v.z) -
        (v.z - previous.z) * (next.x - v.x);
      if (Math.abs(turn) < 1e-9) return;
      const before = walls[(i - 1 + walls.length) % walls.length].inwardNormal;
      const after = walls[i].inwardNormal;
      const outX = -(before.x + after.x);
      const outZ = -(before.z + after.z);
      const spread = Math.hypot(outX, outZ);
      if (spread < 1e-6) return;
      const step = (distance: number) => ({
        x: v.x + (outX / spread) * distance,
        z: v.z + (outZ / spread) * distance,
      });
      if (pointInPolygon(step(CORNER_OPEN_M), footprint)) return;
      // Stood off the corner along its own bisector, so that from inside the
      // room the walls are nearer the camera than the line.
      const at = step(CORNER_LIFT_M);
      found.push({
        key: `corner-${i}`,
        at,
        faces: [
          { x: -before.x, z: -before.z },
          { x: -after.x, z: -after.z },
        ],
        points: [
          [at.x, 0, at.z],
          [at.x, height, at.z],
        ],
      });
    });
    return found;
  }, [footprint, walls, height]);
  // And the line along the foot of each wall, where the outside stops being a
  // building and becomes void. Without it the corner lines end in mid-air and
  // the dark mass simply runs off; with it the silhouette closes. The two
  // tests are the corners' own, for the corners' own reasons: hall 3's
  // partition, whose faces both look into the room, would otherwise lay a
  // black line along the floor of the room, and so would every wall of the
  // dollhouse read from within — at the foot of a wall you are standing
  // inside, a hard black line is a skirting board, not a silhouette.
  const bases = useMemo(
    () =>
      walls.flatMap<OutsideEdge>((wall) => {
        const out = { x: -wall.inwardNormal.x, z: -wall.inwardNormal.z };
        const middle = {
          x: (wall.a.x + wall.b.x) / 2,
          z: (wall.a.z + wall.b.z) / 2,
        };
        const step = (from: FootprintVertex, distance: number) => ({
          x: from.x + out.x * distance,
          z: from.z + out.z * distance,
        });
        if (pointInPolygon(step(middle, CORNER_OPEN_M), footprint)) return [];
        // Stood off the wall rather than drawn on it: the floor slab ends on
        // this exact line, and a line lying in the slab's own plane stipples.
        const a = step(wall.a, CORNER_LIFT_M);
        const b = step(wall.b, CORNER_LIFT_M);
        return [
          {
            key: `base-${wall.wallIndex}`,
            at: middle,
            faces: [out],
            points: [
              [a.x, 0, a.z],
              [b.x, 0, b.z],
            ],
          },
        ];
      }),
    [footprint, walls],
  );
  return (
    <group>
      <mesh
        rotation={[Math.PI / 2, 0, 0]}
        onClick={
          onFloorClick &&
          ((event) => {
            event.stopPropagation();
            // A look-drag ends with a click too, only a still pointer taps.
            if (event.delta > TAP_SLOP_PX) return;
            onFloorClick(
              { x: event.point.x, z: event.point.z },
              (event.nativeEvent as PointerEvent).pointerType ?? "mouse",
            );
          })
        }
        onPointerMove={
          onFloorMove &&
          ((event) =>
            onFloorMove(
              { x: event.point.x, z: event.point.z },
              event.pointerType,
            ))
        }
        onPointerLeave={
          onFloorLeave && ((event) => onFloorLeave(event.pointerType))
        }
      >
        <shapeGeometry args={[shape]} />
        <FloorMaterial finish={floorFinish} />
      </mesh>
      {showCeiling && (
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, height, 0]}>
          <shapeGeometry args={[shape]} />
          <meshStandardMaterial
            color={CEILING_COLOR}
            roughness={1}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      {walls.map((wall) => {
        const openings = [
          ...(door && door.wall_index === wall.wallIndex
            ? [openingFromDoor(door)]
            : []),
          ...(windows ?? [])
            .filter((win) => win.wall_index === wall.wallIndex)
            .map(openingFromWindow),
        ];
        return wallPanels(wall, height, openings).map((panel) => {
          const centre = pointOnWall(wall, panel.centerOffset);
          return (
            <group
              key={`${wall.wallIndex}-${panel.centerOffset}-${panel.bottom}`}
              position={[centre.x, panel.bottom + panel.height / 2, centre.z]}
              rotation={[0, wall.angleY, 0]}
            >
              {/* The face you stand in front of. FrontSide rather than the old
                  DoubleSide: the plane's +z normal is the wall's inward one,
                  so this mesh is the plaster and nothing else, and it stays
                  the one thing a drag can drop a work onto. */}
              <mesh userData={{ wallIndex: wall.wallIndex }}>
                <planeGeometry args={[panel.width, panel.height]} />
                <meshStandardMaterial
                  color={WALL_COLOR}
                  roughness={0.92}
                  side={THREE.FrontSide}
                />
              </mesh>
              {/* Its back, which only the dollhouse ever sees. Same plane, no
                  offset: the two materials cull opposite faces, so they never
                  fight for a pixel. */}
              <mesh raycast={() => null}>
                <planeGeometry args={[panel.width, panel.height]} />
                <meshStandardMaterial
                  color={EXTERIOR_COLOR}
                  roughness={0.95}
                  side={THREE.BackSide}
                />
              </mesh>
            </group>
          );
        });
      })}
      {/* Overview only. Walking, this line is the wall/ceiling junction, where
          a hard black seam would read as damage rather than as an edge; the
          dollhouse is the view that has an outside to be told apart from. */}
      {!showCeiling && (
        <>
          <Line
            points={topEdge}
            color={OUTLINE_COLOR}
            lineWidth={OUTLINE_WIDTH}
          />
          <OutsideEdges edges={corners} />
          <OutsideEdges edges={bases} />
        </>
      )}
      {door && walls[door.wall_index] && (
        <Doorway
          wall={walls[door.wall_index]}
          door={door}
          enclosed={showCeiling}
        />
      )}
      {(windows ?? []).map(
        (win) =>
          walls[win.wall_index] && (
            <Glazing
              key={`${win.wall_index}-${win.offset_m}`}
              wall={walls[win.wall_index]}
              window={win}
              enclosed={showCeiling}
            />
          ),
      )}
      {(extinguishers ?? []).map(
        (item) =>
          walls[item.wall_index] && (
            <Extinguisher
              key={`${item.wall_index}-${item.offset_m}`}
              wall={walls[item.wall_index]}
              extinguisher={item}
            />
          ),
      )}
      {desk && <Desk desk={desk} entrance={entrance} />}
    </group>
  );
}

// Real lights are expensive per fragment, and the wash on the walls is drawn by
// TrackLighting rather than lit, so only a spread handful of fittings become
// actual lamps, enough to shade the room and glance off the floor. They stand
// at fitting positions so the room's shading agrees with the rig you can see.
const KEY_LIGHTS = 4;

function LightRig({ runs, height }: { runs: TrackRun[]; height: number }) {
  const positions = useMemo(
    () => keyFittings(runs, KEY_LIGHTS).map((fitting) => fitting.at),
    [runs],
  );
  return (
    <>
      <ambientLight intensity={0.35} />
      <hemisphereLight args={["#fff8ee", "#cfc6b8", 0.85]} />
      {positions.map((at) => (
        <pointLight
          key={`${at.x}-${at.z}`}
          position={[at.x, height - TRACK_DROP_M - 0.1, at.z]}
          intensity={7}
          distance={0}
          decay={1.8}
          color="#fff2e0"
        />
      ))}
    </>
  );
}

function EntryVeil({ photo }: { photo: string | undefined }) {
  const [faded, setFaded] = useState(false);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const fade = setTimeout(() => setFaded(true), 250);
    const remove = setTimeout(() => setGone(true), 1200);
    return () => {
      clearTimeout(fade);
      clearTimeout(remove);
    };
  }, []);
  if (gone) return null;
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ease-out ${faded ? "opacity-0" : "opacity-100"}`}
    >
      {photo ? (
        <img src={photo} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full bg-ground" />
      )}
    </div>
  );
}

// Re-frames the dollhouse whenever orbit mode (re)activates, the walk rig
// leaves the camera at eye height inside the room otherwise. The pull-back
// factors are tuned to OVERVIEW_FOV; widening that alone shrinks the room.
function OverviewFraming({
  reach,
  enabled,
}: {
  reach: number;
  enabled: boolean;
}) {
  const camera = useThree((state) => state.camera);
  useEffect(() => {
    if (!enabled) return;
    camera.position.set(...overviewPosition(reach));
    camera.lookAt(0, 0.4, 0);
  }, [camera, enabled, reach]);
  return null;
}

// Vertical FOV per mode. Walking wants the wide, slightly exaggerated read of
// a real walkthrough, it also buys back horizontal view on portrait phones,
// where a vertical-FOV camera is otherwise very narrow. The dollhouse stays
// tighter: perspective distortion is far more obvious on a whole-room shape.
function ModeFov({ walking }: { walking: boolean }) {
  const camera = useThree((state) => state.camera);
  useEffect(() => {
    const perspective = camera as THREE.PerspectiveCamera;
    if (!perspective.isPerspectiveCamera) return;
    perspective.fov = walking ? WALK_FOV : OVERVIEW_FOV;
    perspective.updateProjectionMatrix();
  }, [camera, walking]);
  return null;
}

// Parametric hall: dollhouse orbit overview by default, first-person walk on
// demand. The footprint is recentred on its centroid so the origin, the
// orbit target and the walk spawn, is the middle of the floor.
export default function HallScene({
  hall,
  onAddWorks,
  interactionLocked = false,
}: {
  hall: Hall;
  /** Opens the works panel, the empty-hall call to action needs it. */
  onAddWorks: () => void;
  /**
   * A sheet is over the scene and owns the keyboard. Two window-level Escape
   * listeners cannot arbitrate between themselves, stopPropagation doesn't
   * help, so the scene simply stands down while one is open.
   */
  interactionLocked?: boolean;
}) {
  const { t } = useTranslation();
  const footprint = useMemo(() => {
    const ccw = normalizeFootprint(hall.footprint);
    const centre = polygonCentroid(ccw);
    return ccw.map((v) => ({ x: v.x - centre.x, z: v.z - centre.z }));
  }, [hall.footprint]);
  // The door rides its wall, so recentring the footprint carries it along; only
  // the desk, positioned in raw footprint coordinates, has to be shifted.
  const desk = useMemo(() => {
    if (!hall.desk) return null;
    const centre = polygonCentroid(normalizeFootprint(hall.footprint));
    return {
      ...hall.desk,
      center: {
        x: hall.desk.center.x - centre.x,
        z: hall.desk.center.z - centre.z,
      },
    };
  }, [hall.desk, hall.footprint]);
  const walls = useMemo(() => wallsFromFootprint(footprint), [footprint]);
  // Where the door stands in the recentred room, read once: it labels the
  // entrance, and it is what tells the counter which way to turn its L.
  const entrance = useMemo(() => {
    const wall = hall.door ? walls[hall.door.wall_index] : undefined;
    if (!hall.door || !wall) return null;
    return pointOnWall(wall, hall.door.offset_m);
  }, [hall.door, walls]);
  const obstacles = useMemo(
    () => (desk ? deskRects(desk, entrance) : []),
    [desk, entrance],
  );
  const labels = useMemo(() => {
    const marks: {
      key: "entrance" | "reception";
      position: [number, number, number];
    }[] = [];
    const doorWall = hall.door ? walls[hall.door.wall_index] : undefined;
    if (hall.door && doorWall && entrance) {
      marks.push({
        key: "entrance",
        position: [
          entrance.x + doorWall.inwardNormal.x * 0.35,
          cmToM(hall.door.height_cm) + 0.28,
          entrance.z + doorWall.inwardNormal.z * 0.35,
        ],
      });
    }
    if (desk) {
      marks.push({
        key: "reception",
        position: [desk.center.x, cmToM(desk.height_cm) + 0.35, desk.center.z],
      });
    }
    return marks;
  }, [desk, entrance, hall.door, walls]);
  const reach = useMemo(() => {
    const box = boundingBox(footprint);
    return Math.max(box.width, box.depth);
  }, [footprint]);
  const height = cmToM(hall.ceiling_cm);
  // One rig for the whole hall: TrackLighting draws it, LightRig lights from it.
  const lightingRuns = useMemo(
    () =>
      trackRuns(walls, {
        door: hall.door,
        windows: hall.windows,
        desk: hall.desk,
      }),
    [walls, hall.door, hall.windows, hall.desk],
  );

  const [mode, setMode] = useState<"orbit" | "walk">("orbit");
  // While an artwork drag is live, both camera rigs must let the pointer go.
  const draggingArtwork = useWorksStore((state) => state.draggingId !== null);
  const worksCount = useWorksStore((state) => state.works.length);
  const reviewing = useWorksStore((state) => state.mode === "review");
  const glideToRef = useRef<FootprintVertex | null>(null);
  const faceToRef = useRef<Turn | null>(null);
  const reticleRef = useRef<THREE.Mesh>(null);
  const flashTimer = useRef(0);

  const walking = mode === "walk";

  useEffect(() => {
    if (!walking || interactionLocked) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMode("orbit");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [walking, interactionLocked]);

  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  const showReticle = (p: FootprintVertex) => {
    const m = reticleRef.current;
    if (!m) return;
    m.position.set(p.x, 0.02, p.z);
    m.visible = true;
  };

  /**
   * Walk the visitor round to a work and face it.
   *
   * The viewpoint is resolved **here**, from this component's own recentred
   * footprint and walls, never from the ones on the works store, which are
   * built from the raw footprint and so agree on lengths and indices but not on
   * points. That is why `useCameraStore` carries an id rather than a position.
   *
   * Being taken somewhere implies walking: the dollhouse view cannot stand in
   * front of anything, so a focus switches to it rather than quietly doing
   * nothing from overhead.
   */
  const focusId = useCameraStore((state) => state.focusId);
  const focusSeq = useCameraStore((state) => state.seq);
  useEffect(() => {
    if (!focusId) return;
    const work = useWorksStore.getState().works.find((w) => w.id === focusId);
    const wall = work ? walls[work.wall_index] : undefined;
    if (!work || !wall) return;
    const view = viewpointFor(
      wall,
      work.offset_m,
      work,
      footprint,
      PLAYER_RADIUS,
      obstacles,
      EYE_HEIGHT,
      PITCH_LIMIT,
    );
    setMode("walk");
    glideToRef.current = view.at;
    faceToRef.current = { yaw: view.yaw, pitch: view.pitch };
    useCameraStore.getState().clear();
    // The same landing mark a floor tap drops, for the same reason: the
    // destination should be visible before the walk finishes. The rig only
    // mounts once `walking` is true, so the refs are read on its first frame.
    showReticle(view.at);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => {
      if (reticleRef.current) reticleRef.current.visible = false;
    }, 900);
    // focusSeq, not focusId: asking twice for the same work is a real request.
  }, [focusId, focusSeq, walls, footprint, obstacles]);

  return (
    // hall-canvas: touch drags belong to the camera rigs, not the browser,
    // see the touch-action rule in index.css. role="application" because the
    // scene consumes raw pointer and arrow-key input.
    <div
      role="application"
      aria-label={t("hallView.canvasLabel")}
      className="hall-canvas absolute inset-0"
    >
      <Canvas
        camera={{
          position: overviewPosition(reach),
          fov: OVERVIEW_FOV,
        }}
      >
        <color attach="background" args={[VOID_COLOR]} />
        <fog attach="fog" args={[VOID_COLOR, reach * 2, reach * 6]} />
        <Room
          footprint={footprint}
          height={height}
          door={hall.door}
          desk={desk}
          entrance={entrance}
          windows={hall.windows}
          extinguishers={hall.extinguishers}
          floorFinish={hall.floor_finish}
          showCeiling={walking}
          onFloorClick={
            walking
              ? (point, pointerType) => {
                  useWorksStore.getState().selectWork(null);
                  const target = clampToInterior(
                    point,
                    footprint,
                    PLAYER_RADIUS,
                    obstacles,
                  );
                  glideToRef.current = target;
                  showReticle(target);
                  // Hover keeps the reticle alive under a mouse; a tap has no
                  // hover, so flash it at the landing point instead.
                  if (pointerType !== "mouse") {
                    window.clearTimeout(flashTimer.current);
                    flashTimer.current = window.setTimeout(() => {
                      if (reticleRef.current)
                        reticleRef.current.visible = false;
                    }, 450);
                  }
                }
              : undefined
          }
          onFloorMove={
            walking
              ? (point, pointerType) => {
                  if (pointerType !== "mouse") return;
                  window.clearTimeout(flashTimer.current);
                  showReticle(
                    clampToInterior(point, footprint, PLAYER_RADIUS, obstacles),
                  );
                }
              : undefined
          }
          onFloorLeave={
            walking
              ? (pointerType) => {
                  if (pointerType !== "mouse" || !reticleRef.current) return;
                  reticleRef.current.visible = false;
                }
              : undefined
          }
        />
        <Artworks walls={walls} />
        <StudioEnvironment />
        <TrackLighting runs={lightingRuns} height={height} />
        <LightRig runs={lightingRuns} height={height} />
        <OverviewFraming reach={reach} enabled={!walking} />
        <ModeFov walking={walking} />
        {labels.map((label) => (
          <FeatureLabel key={label.key} position={label.position}>
            {t(`hallView.${label.key}`)}
          </FeatureLabel>
        ))}
        {walking ? (
          <>
            <FirstPersonRig
              footprint={footprint}
              obstacles={obstacles}
              glideToRef={glideToRef}
              faceToRef={faceToRef}
            />
            <mesh
              ref={reticleRef}
              visible={false}
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, 0.02, 0]}
              raycast={() => null}
            >
              <ringGeometry args={[0.16, 0.24, 48]} />
              <meshBasicMaterial
                color="#ffffff"
                transparent
                opacity={0.9}
                depthWrite={false}
              />
            </mesh>
          </>
        ) : (
          <OrbitControls
            enabled={!draggingArtwork}
            enableDamping
            maxPolarAngle={Math.PI / 2 - 0.05}
            minDistance={2}
            maxDistance={reach * 4}
          />
        )}
      </Canvas>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-end gap-3 p-4">
        {!walking && (
          <button
            type="button"
            onClick={() => setMode("walk")}
            className="pointer-events-auto rounded-full bg-ink/85 px-5 py-2 text-sm text-ground shadow-md backdrop-blur transition-colors hover:bg-ink-soft"
          >
            {t("hallView.walk")}
          </button>
        )}
        {walking && (
          <button
            type="button"
            onClick={() => setMode("orbit")}
            className="pointer-events-auto rounded-full bg-ink/85 px-5 py-2 text-sm text-ground shadow-md backdrop-blur transition-colors hover:bg-ink-soft"
          >
            {t("hallView.overview")}
          </button>
        )}
      </div>
      {/* The bottom hint slot. Bare walls are the more urgent thing to say, so
          the call to hang something sits under, and outlives, the navigation
          hint, which only speaks while walking. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-24 flex flex-col items-center gap-2 px-4">
        {walking && (
          <p className="text-center text-sm text-ground">
            <span className="rounded-full bg-ink/85 px-4 py-1.5 shadow-sm backdrop-blur">
              {t("hallView.hint")}
            </span>
          </p>
        )}
        {/* Nothing to add in review mode, the panel is not even mounted. */}
        {worksCount === 0 && !reviewing && (
          <button
            type="button"
            onClick={onAddWorks}
            className="pointer-events-auto animate-rise rounded-full border border-ink bg-surface px-5 py-2 text-sm font-medium text-ink shadow-md transition-colors hover:bg-ink hover:text-ground"
          >
            {t("works.nudge")}
          </button>
        )}
      </div>
      <EntryVeil photo={hall.photos?.[0]} />
    </div>
  );
}
