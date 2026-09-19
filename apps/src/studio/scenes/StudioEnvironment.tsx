import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";

// A procedural room environment, so glossy surfaces have something to reflect.
//
// Halls 2-4 are poured epoxy: what the photos show is the ceiling and the track
// lights mirrored in the floor. Without an environment a low-roughness standard
// material sends its energy into a specular lobe that mostly misses the camera,
// so raising gloss makes the floor darker rather than wetter, the opposite of
// the photograph. drei's <Environment> would fetch an HDR from a CDN, which the
// studio cannot do (no external assets, and the artwork-stays-local stance), so
// this paints a 2:1 equirectangular gradient by hand: bright warm ceiling above
// the horizon, the room's own floor bounce below, and a band of lamp-bright
// streaks where the track lighting sits.

const EQUIRECT_W = 256;
const EQUIRECT_H = 128;

function paintEquirect(): THREE.DataTexture | THREE.CanvasTexture | null {
  const canvas = document.createElement("canvas");
  canvas.width = EQUIRECT_W;
  canvas.height = EQUIRECT_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const sky = ctx.createLinearGradient(0, 0, 0, EQUIRECT_H);
  sky.addColorStop(0, "#fffaf2"); // ceiling, warm white
  sky.addColorStop(0.46, "#efe9df");
  sky.addColorStop(0.54, "#b9b2a7"); // horizon: the walls
  sky.addColorStop(1, "#6d675f"); // downward: floor bounce
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, EQUIRECT_W, EQUIRECT_H);

  // Track lights: short bright bars just above the horizon. These are what a
  // walker actually sees strung out across a wet-looking floor.
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 7; i += 1) {
    const x = ((i + 0.5) / 7) * EQUIRECT_W;
    ctx.fillRect(x - 7, EQUIRECT_H * 0.3, 14, 5);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export default function StudioEnvironment() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  useEffect(() => {
    const source = paintEquirect();
    if (!source) return;
    const pmrem = new THREE.PMREMGenerator(gl);
    const target = pmrem.fromEquirectangular(source);
    scene.environment = target.texture;
    source.dispose();
    pmrem.dispose();
    return () => {
      scene.environment = null;
      target.dispose();
    };
  }, [gl, scene]);
  return null;
}
