import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

/**
 * 공개 — 전시장 3D 둘러보기.
 *
 * 규모(면적·층고)로 방을 만들고 전시장 사진을 벽 4면에 이어 붙여, 방 안에서 둘러보는 화면입니다.
 *   · 드래그(또는 ← → ↑ ↓)로 좌우·위아래 둘러보기
 *   · 휠(또는 ＋ / －)로 확대·축소
 *   · 사진이 4장을 넘으면 세트를 바꿔 다른 사진으로 둘러봅니다
 *
 * ⚠ 사진이 360° 파노라마가 아니라 일반 실내 사진이라, 벽마다 사진 한 장을 꽉 채워 넣는 방식입니다.
 *    (원본 사이트도 도면 치수로 방을 만들어 사진을 붙입니다. 치수는 근사치입니다)
 */
type HallStudioProps = {
  /** 방 크기 (m) */
  width: number
  depth: number
  height: number
  /** 벽 4면(정면 → 오른쪽 → 뒤 → 왼쪽)에 넣을 사진 — 4장씩 세트 */
  sets: readonly (readonly string[])[]
}

/** 드래그 감도 (rad/px) */
const LOOK_SENSITIVITY = 0.004
/** 위아래로 젖혀 볼 수 있는 한계 (rad) */
const PITCH_LIMIT = 1.25
/** 화각(확대) 한계 — 값이 작을수록 확대 */
const FOV_MIN = 32
const FOV_MAX = 95
const FOV_DEFAULT = 72
/** 눈높이 (m) */
const EYE_HEIGHT = 1.6

/** 벽 4면 — 사진은 이 순서대로 붙습니다. */
const WALL_LABELS = '정면 → 오른쪽 → 뒤 → 왼쪽'

/**
 * 업로드 사진은 개발 중에만 출처가 다릅니다.
 * WebGL 텍스처는 CORS 가 필요해서, 개발 서버가 /uploads 를 대신 받아 오게 합니다. (vite.config.ts)
 */
function textureUrl(url: string) {
  if (!import.meta.env.DEV) return url

  const match = /^https?:\/\/[^/]+(\/uploads\/.*)$/.exec(url)

  return match === null ? url : match[1]
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

/** 사진을 벽에 꽉 채웁니다 (CSS background-size: cover 와 같음) */
function coverTexture(texture: THREE.Texture, wallWidth: number, wallHeight: number) {
  const image = texture.image as { width?: number; height?: number } | undefined
  const imageWidth = image?.width ?? 0
  const imageHeight = image?.height ?? 0

  if (imageWidth === 0 || imageHeight === 0 || wallHeight === 0) return

  const wallAspect = wallWidth / wallHeight
  const photoAspect = imageWidth / imageHeight

  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping

  if (photoAspect > wallAspect) {
    texture.repeat.set(wallAspect / photoAspect, 1)
    texture.offset.set((1 - texture.repeat.x) / 2, 0)

    return
  }

  texture.repeat.set(1, photoAspect / wallAspect)
  texture.offset.set(0, (1 - texture.repeat.y) / 2)
}

export default function HallStudio({ width, depth, height, sets }: HallStudioProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  /** 지금 보고 있는 시점 — 드래그로 바뀌고 매 프레임 카메라에 적용합니다. */
  const viewRef = useRef({ yaw: 0, pitch: 0, fov: FOV_DEFAULT })
  const dragRef = useRef<{ id: number; x: number; y: number } | null>(null)
  const roomRef = useRef<THREE.Group | null>(null)

  const [setIndex, setSetIndex] = useState(0)
  /**
   * 사진을 다 붙였는지 — 어떤 방을 만들었는지(key)와 함께 담아 둡니다.
   * 방·사진이 바뀌면 key 가 달라져 자동으로 '준비 중' 으로 돌아갑니다.
   */
  const [phase, setPhase] = useState<{
    key: string
    state: 'ready' | 'error'
    message: string
  } | null>(null)
  /** WebGL 을 쓸 수 있는 환경인지 (한 번만 확인) */
  const [webglOk] = useState(() => {
    try {
      const canvas = document.createElement('canvas')

      return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
    } catch {
      return false
    }
  })

  /** 이번 세트의 사진 (벽 4면까지) — 주소가 바뀔 때만 새 배열이 되게 묶어 둡니다. */
  const photosKey = (sets[setIndex] ?? []).slice(0, 4).join('\n')
  const photos = useMemo(
    () => (photosKey === '' ? [] : photosKey.split('\n')),
    [photosKey],
  )
  /** 방 하나를 가리키는 열쇠 — 이게 달라지면 다시 그립니다. */
  const roomKey = `${width}|${depth}|${height}|${photosKey}`
  const settled = phase !== null && phase.key === roomKey ? phase : null
  const status: 'loading' | 'ready' | 'error' = !webglOk
    ? 'error'
    : photos.length === 0
      ? 'ready'
      : (settled?.state ?? 'loading')
  const errorText = !webglOk
    ? '이 브라우저에서는 3D 를 볼 수 없습니다. (WebGL 사용 불가)'
    : (settled?.message ?? '')

  /** 방과 카메라를 걷어냅니다. (사진 재질은 여기서 함께 정리) */
  const clearRoom = useCallback(() => {
    const scene = sceneRef.current
    const room = roomRef.current

    roomRef.current = null

    if (scene === null || room === null) return

    scene.remove(room)

    room.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return

      child.geometry.dispose()

      const materials = Array.isArray(child.material) ? child.material : [child.material]

      for (const material of materials) {
        if (material instanceof THREE.MeshBasicMaterial && material.map) material.map.dispose()

        material.dispose()
      }
    })
  }, [])

  // 렌더러 · 카메라 · 그리기 반복 (한 번만)
  useEffect(() => {
    const canvas = canvasRef.current

    if (canvas === null || !webglOk) return

    let renderer: THREE.WebGLRenderer

    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    } catch {
      // webglOk 로 미리 걸러지므로 실제로는 거의 오지 않습니다.
      return
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(FOV_DEFAULT, 1, 0.05, 500)

    // yaw(좌우) 를 먼저, pitch(위아래) 를 나중에 적용합니다.
    camera.rotation.order = 'YXZ'

    sceneRef.current = scene
    cameraRef.current = camera
    rendererRef.current = renderer

    let frame = 0

    const draw = () => {
      frame = requestAnimationFrame(draw)

      const view = viewRef.current

      if (camera.fov !== view.fov) {
        camera.fov = view.fov
        camera.updateProjectionMatrix()
      }

      camera.rotation.set(view.pitch, view.yaw, 0)
      renderer.render(scene, camera)
    }

    draw()

    const resize = () => {
      const stage = canvas.parentElement
      const stageWidth = stage === null ? canvas.clientWidth : stage.clientWidth
      const stageHeight = stage === null ? canvas.clientHeight : stage.clientHeight

      if (stageWidth === 0 || stageHeight === 0) return

      renderer.setSize(stageWidth, stageHeight, false)
      camera.aspect = stageWidth / stageHeight
      camera.updateProjectionMatrix()
    }

    resize()

    const observer = new ResizeObserver(resize)

    if (canvas.parentElement !== null) observer.observe(canvas.parentElement)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      clearRoom()
      renderer.dispose()
      sceneRef.current = null
      cameraRef.current = null
      rendererRef.current = null
    }
  }, [clearRoom, webglOk])

  // 방 만들기 — 크기나 사진 세트가 바뀌면 다시 만듭니다.
  useEffect(() => {
    const scene = sceneRef.current
    const camera = cameraRef.current

    if (scene === null || camera === null) return

    let cancelled = false

    clearRoom()
    const room = new THREE.Group()
    roomRef.current = room
    scene.add(room)

    // 바닥 · 천장 (원본 도면의 바닥재 색을 참고)
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      new THREE.MeshBasicMaterial({ color: '#4b4842' }),
    )
    floor.rotation.x = -Math.PI / 2
    room.add(floor)

    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      new THREE.MeshBasicMaterial({ color: '#f1f0ed' }),
    )
    ceiling.rotation.x = Math.PI / 2
    ceiling.position.y = height
    room.add(ceiling)

    // 벽 4면 — 사진이 없는 벽은 회색으로 둡니다.
    const walls = [
      { wallWidth: width, x: 0, z: -depth / 2, angle: 0 },
      { wallWidth: depth, x: width / 2, z: 0, angle: -Math.PI / 2 },
      { wallWidth: width, x: 0, z: depth / 2, angle: Math.PI },
      { wallWidth: depth, x: -width / 2, z: 0, angle: Math.PI / 2 },
    ]

    const meshes = walls.map((wall) => {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(wall.wallWidth, height),
        new THREE.MeshBasicMaterial({ color: '#e4e2df' }),
      )

      mesh.position.set(wall.x, height / 2, wall.z)
      mesh.rotation.y = wall.angle
      room.add(mesh)

      return mesh
    })

    // 입구 쪽에 서서 방 안을 봅니다.
    camera.position.set(0, Math.min(EYE_HEIGHT, height * 0.6), depth * 0.32)
    viewRef.current = { yaw: 0, pitch: 0, fov: FOV_DEFAULT }

    if (photos.length === 0) {
      return () => {
        cancelled = true
      }
    }

    const loader = new THREE.TextureLoader()

    loader.setCrossOrigin('anonymous')

    const load = (url: string) =>
      new Promise<THREE.Texture | null>((resolve) => {
        loader.load(
          textureUrl(url),
          (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace
            resolve(texture)
          },
          undefined,
          () => resolve(null),
        )
      })

    void Promise.all(
      photos.map(async (url, index) => ({ index, texture: await load(url) })),
    ).then((loaded) => {
      if (cancelled) {
        for (const { texture } of loaded) texture?.dispose()

        return
      }

      let applied = 0

      for (const { index, texture } of loaded) {
        const mesh = meshes[index]

        if (texture === null || mesh === undefined) continue

        const wall = walls[index]

        coverTexture(texture, wall.wallWidth, height)

        const previous = mesh.material

        mesh.material = new THREE.MeshBasicMaterial({ map: texture })

        if (previous instanceof THREE.MeshBasicMaterial) previous.dispose()

        applied++
      }

      if (applied === 0) {
        setPhase({
          key: roomKey,
          state: 'error',
          message: '사진을 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.',
        })

        return
      }

      setPhase({ key: roomKey, state: 'ready', message: '' })
    })

    return () => {
      cancelled = true
    }
  }, [clearRoom, depth, height, photos, roomKey, width])

  // 휠 — 화면이 스크롤되지 않고 확대·축소만 되게 (기본 동작을 막아야 해서 직접 붙입니다)
  useEffect(() => {
    const canvas = canvasRef.current

    if (canvas === null) return

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()

      const view = viewRef.current

      view.fov = clamp(view.fov + event.deltaY * 0.05, FOV_MIN, FOV_MAX)
    }

    canvas.addEventListener('wheel', onWheel, { passive: false })

    return () => canvas.removeEventListener('wheel', onWheel)
  }, [])

  const zoom = (amount: number) => {
    const view = viewRef.current

    view.fov = clamp(view.fov + amount, FOV_MIN, FOV_MAX)
  }

  const look = (yawAmount: number, pitchAmount: number) => {
    const view = viewRef.current

    view.yaw += yawAmount
    view.pitch = clamp(view.pitch + pitchAmount, -PITCH_LIMIT, PITCH_LIMIT)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    const step = 0.08

    if (event.key === 'ArrowLeft') look(step, 0)
    else if (event.key === 'ArrowRight') look(-step, 0)
    else if (event.key === 'ArrowUp') look(0, step)
    else if (event.key === 'ArrowDown') look(0, -step)
    else if (event.key === '+' || event.key === '=') zoom(-4)
    else if (event.key === '-' || event.key === '_') zoom(4)
    else return

    event.preventDefault()
  }

  return (
    <div className="studio">
      <canvas
        ref={canvasRef}
        className="studio__canvas"
        tabIndex={0}
        aria-label="전시장 3D 둘러보기 — 드래그하거나 방향키로 둘러볼 수 있습니다"
        onKeyDown={onKeyDown}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          dragRef.current = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
          }
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current

          if (drag === null || drag.id !== event.pointerId) return

          const dx = event.clientX - drag.x
          const dy = event.clientY - drag.y

          drag.x = event.clientX
          drag.y = event.clientY

          // 사진을 잡아 끄는 느낌 — 오른쪽으로 끌면 왼쪽을 봅니다.
          look(dx * LOOK_SENSITIVITY, dy * LOOK_SENSITIVITY)
        }}
        onPointerUp={(event) => {
          if (dragRef.current?.id === event.pointerId) dragRef.current = null
        }}
        onPointerCancel={() => {
          dragRef.current = null
        }}
      />

      {status === 'loading' && (
        <p className="studio__status">3D 를 준비하고 있습니다...</p>
      )}

      {status === 'error' && <p className="studio__status">{errorText}</p>}

      {status !== 'error' && (
        <>
          <div className="studio__zoom">
            <button
              type="button"
              className="studio__zoom_btn"
              aria-label="확대"
              onClick={() => zoom(-6)}
            >
              +
            </button>
            <button
              type="button"
              className="studio__zoom_btn"
              aria-label="축소"
              onClick={() => zoom(6)}
            >
              −
            </button>
          </div>

          {sets.length > 1 && (
            <div className="studio__sets" role="group" aria-label="사진 묶음">
              {sets.map((photos, index) => (
                <button
                  key={photos[0] ?? index}
                  type="button"
                  className={
                    index === setIndex
                      ? 'studio__set is-active'
                      : 'studio__set'
                  }
                  aria-pressed={index === setIndex}
                  onClick={() => setSetIndex(index)}
                >
                  사진 {index * 4 + 1}~{index * 4 + photos.length}
                </button>
              ))}
            </div>
          )}

          <p className="studio__hint">
            드래그해서 둘러보기 · 휠로 확대 ({WALL_LABELS} 순서)
          </p>
        </>
      )}
    </div>
  )
}
