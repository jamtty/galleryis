import type { FootprintVertex } from "@galleryis/shared";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { clampToInterior, resolveMovement } from "../lib/collision";
import type { Rect } from "../lib/geometry";
import {
  advanceGlide,
  advanceTurn,
  startGlide,
  type Glide,
  type Turn,
} from "../lib/glide";
import { useWorksStore } from "../store/works";

export const EYE_HEIGHT = 1.6;
export const PLAYER_RADIUS = 0.35;
const SPEED = 2.5;
const LOOK_SPEED = 0.005;
export const PITCH_LIMIT = 1.2;

const KEY_DIRS: Record<string, [number, number]> = {
  KeyW: [0, 1],
  ArrowUp: [0, 1],
  KeyS: [0, -1],
  ArrowDown: [0, -1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

// Eye-height camera rig, Matterport-style on every device: drag-to-look
// (grab-the-scene direction), tap-to-move glides consumed from glideToRef,
// WASD/arrows kept as a quiet extra. All movement goes through the collision
// layer each frame.
//
// `faceToRef` is the same idea for the head: the assistant sets a heading when
// it takes the visitor to a work, and it eases on the same profile as the walk
// so both land together.
export default function FirstPersonRig({
  footprint,
  obstacles,
  glideToRef,
  faceToRef,
}: {
  footprint: FootprintVertex[];
  obstacles: Rect[];
  glideToRef: RefObject<FootprintVertex | null>;
  faceToRef?: RefObject<Turn | null>;
}) {
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const keys = useRef(new Set<string>());
  const glide = useRef<Glide | null>(null);
  const turn = useRef<Turn | null>(null);

  useEffect(() => {
    const spawn = clampToInterior(
      { x: 0, z: 0 },
      footprint,
      PLAYER_RADIUS,
      obstacles,
    );
    camera.position.set(spawn.x, EYE_HEIGHT, spawn.z);
    // Footprints are in scene axes, so every hall's south wall (the short one
    // beside the entrance, edge 5) sits at z=0 with the room at z<0, from the
    // recentred centroid it lies at local +z. Face it on entry.
    //
    // Set the yaw directly rather than via lookAt: looking down +z is a 180°
    // turn about Y, which lookAt stores as the XYZ Euler (π, 0, π). The
    // look-drag below reads rotation.x as pitch, so that representation gets
    // clamped to PITCH_LIMIT on the first drag and pitches the camera at the
    // floor. Naming the YXZ order up front keeps pitch and yaw separate.
    camera.rotation.order = "YXZ";
    camera.rotation.set(0, Math.PI, 0);
  }, [camera, footprint, obstacles]);

  useEffect(() => {
    const pressed = keys.current;
    const down = (event: KeyboardEvent) => {
      // Typing must not walk the camera, the works panel's cm inputs, and the
      // assistant's composer, where "wall" is four movement keys in a row.
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      )
        return;
      if (KEY_DIRS[event.code]) pressed.add(event.code);
    };
    const up = (event: KeyboardEvent) => {
      pressed.delete(event.code);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      pressed.clear();
    };
  }, []);

  useEffect(() => {
    const el = gl.domElement;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const onDown = (event: PointerEvent) => {
      // A pointer that lands on an artwork drags the artwork, not the view.
      if (useWorksStore.getState().draggingId) return;
      dragging = true;
      // Taking hold of the view cancels the turn but *not* the glide: grabbing
      // the scene to look around while walking is the Matterport convention
      // this rig already has, and only the heading is now in dispute.
      turn.current = null;
      lastX = event.clientX;
      lastY = event.clientY;
    };
    const onMove = (event: PointerEvent) => {
      if (!dragging || useWorksStore.getState().draggingId) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      // Grab-the-scene direction (the Matterport convention): the world
      // follows the pointer, so dragging up looks down.
      camera.rotation.order = "YXZ";
      camera.rotation.y += dx * LOOK_SPEED;
      camera.rotation.x = Math.min(
        PITCH_LIMIT,
        Math.max(-PITCH_LIMIT, camera.rotation.x + dy * LOOK_SPEED),
      );
    };
    const onUp = () => {
      dragging = false;
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [camera, gl]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    if (glideToRef.current) {
      glide.current = startGlide(
        { x: camera.position.x, z: camera.position.z },
        glideToRef.current,
      );
      glideToRef.current = null;
    }
    if (faceToRef?.current) {
      camera.rotation.order = "YXZ";
      turn.current = faceToRef.current;
      faceToRef.current = null;
    }
    if (turn.current) {
      const out = advanceTurn(
        { yaw: camera.rotation.y, pitch: camera.rotation.x },
        turn.current,
        dt,
      );
      camera.rotation.y = out.at.yaw;
      camera.rotation.x = out.at.pitch;
      if (out.done) turn.current = null;
    }
    let fx = 0;
    let fz = 0;
    for (const code of keys.current) {
      const dir = KEY_DIRS[code];
      fx += dir[0];
      fz += dir[1];
    }
    if (fx || fz) {
      // Walking yourself takes the camera back, heading and all.
      glide.current = null;
      turn.current = null;
      const norm = Math.hypot(fx, fz);
      fx /= norm;
      fz /= norm;
      camera.getWorldDirection(forward);
      forward.y = 0;
      if (forward.lengthSq() < 1e-6) return;
      forward.normalize();
      right.crossVectors(forward, UP);
      const step = SPEED * dt;
      const next = resolveMovement(
        { x: camera.position.x, z: camera.position.z },
        {
          x: camera.position.x + (forward.x * fz + right.x * fx) * step,
          z: camera.position.z + (forward.z * fz + right.z * fx) * step,
        },
        footprint,
        PLAYER_RADIUS,
        obstacles,
      );
      camera.position.set(next.x, EYE_HEIGHT, next.z);
      return;
    }
    if (glide.current) {
      const out = advanceGlide(
        { x: camera.position.x, z: camera.position.z },
        glide.current,
        dt,
        footprint,
        PLAYER_RADIUS,
        obstacles,
      );
      camera.position.set(out.pos.x, EYE_HEIGHT, out.pos.z);
      if (out.done) glide.current = null;
    }
  });

  return null;
}
