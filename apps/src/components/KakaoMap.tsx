import { useEffect, useRef, useState } from 'react'
import { SITE } from '../data/site'

/**
 * 갤러리 이즈 위치 지도 (원본 사이트와 같은 방식).
 *
 * 카카오(다음) 지도 SDK 를 autoload=false 로 받아 daum.maps.load() 로 초기화하고,
 * 지도 상자를 지켜보다가(ResizeObserver) 크기가 잡히면 그때 만듭니다.
 * SDK 를 못 받으면 주소를 대신 보여 줍니다.
 *
 * 휠은 페이지 스크롤에 그대로 쓰이고, Ctrl(⌘) 을 누른 채 굴릴 때만 확대·축소됩니다.
 */

/** SDK 주소 */
const SDK_SRC = 'https://ssl.daumcdn.net/dmaps/map_js_init/v3.js?autoload=false'

/** 확대 단계 (1 = 가장 가까이) */
const MAP_LEVEL = 1

/** 카카오 지도 확대 단계 범위 */
const MIN_LEVEL = 1
const MAX_LEVEL = 14

/** 휠 한 번으로 볼 확대 단계 — 휠 델타를 모아서 넘으면 한 단계 움직입니다. */
const WHEEL_STEP = 30

type LatLng = unknown

type MapInstance = {
  relayout: () => void
  setCenter: (position: LatLng) => void
  getLevel: () => number
  setLevel: (level: number) => void
}

type KakaoNamespace = {
  maps: {
    load: (callback: () => void) => void
    LatLng: new (lat: number, lng: number) => LatLng
    Map: new (
      node: HTMLElement,
      options: { center: LatLng; level: number; scrollwheel?: boolean },
    ) => MapInstance
    Marker: new (options: { position: LatLng }) => { setMap: (map: MapInstance) => void }
  }
}

declare global {
  interface Window {
    kakao?: KakaoNamespace
  }
}

let sdk: Promise<KakaoNamespace> | null = null

/** SDK 는 한 번만 받아 둡니다. */
function loadSdk() {
  if (!sdk) {
    sdk = new Promise<KakaoNamespace>((resolve, reject) => {
      const script = document.createElement('script')

      script.async = true
      script.src = SDK_SRC

      script.onload = () => {
        const kakao = window.kakao

        if (!kakao) {
          reject(new Error('지도를 불러오지 못했습니다.'))

          return
        }

        kakao.maps.load(() => resolve(kakao))
      }

      script.onerror = () => reject(new Error('지도를 불러오지 못했습니다.'))

      document.head.append(script)
    })
  }

  return sdk
}

/** 지도 앱 길찾기 (원본과 같은 주소) */
const MAP_APPS = [
  {
    key: 'kakao',
    label: '카카오맵',
    href: `https://map.kakao.com/link/map/갤러리이즈,${SITE.coords.lat},${SITE.coords.lng}`,
  },
  {
    key: 'naver',
    label: '네이버',
    href: 'https://map.naver.com/p/search/%EA%B0%A4%EB%9F%AC%EB%A6%AC%20%EC%9D%B4%EC%A6%88%20%EC%9D%B8%EC%82%AC%EB%8F%99',
  },
  {
    key: 'google',
    label: '구글',
    href: `https://www.google.com/maps/search/?api=1&query=${SITE.coords.lat},${SITE.coords.lng}`,
  },
] as const

export default function KakaoMap() {
  const boxRef = useRef<HTMLDivElement>(null)
  /** 지도를 못 띄운 경우 (SDK 차단 · 네트워크 오류) */
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const box = boxRef.current

    if (!box) return

    let alive = true
    let observer: ResizeObserver | null = null
    let unwatchWheel: (() => void) | null = null

    loadSdk()
      .then((kakao) => {
        if (!alive) return

        const center = new kakao.maps.LatLng(SITE.coords.lat, SITE.coords.lng)
        let map: MapInstance | null = null
        /** 휠 델타 누적값 — 모아서 WHEEL_STEP 을 넘을 때만 한 단계 움직입니다. */
        let wheelDelta = 0

        /*
         * 지도는 기본적으로(scrollwheel: false) 휠을 받지 않으므로
         * 지도 위에서 휠을 굴려도 페이지가 그대로 스크롤됩니다.
         * Ctrl(⌘) 을 누른 채 굴릴 때만 확대·축소합니다.
         */
        const onWheel = (event: WheelEvent) => {
          if (!event.ctrlKey && !event.metaKey) return
          if (!map) return

          // 브라우저 자체의 페이지 확대를 막습니다.
          event.preventDefault()
          // 지도 SDK 쪽으로 넘겨 다른 확대가 겹치지 않게 합니다.
          event.stopPropagation()

          // 파이어폭스 등은 줄/페이지 단위로 오기 때문에 픽셀로 맞춰 줍니다.
          const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1

          wheelDelta += event.deltaY * unit

          if (Math.abs(wheelDelta) < WHEEL_STEP) return

          const current = map.getLevel()
          const next = Math.min(
            MAX_LEVEL,
            Math.max(MIN_LEVEL, current + (wheelDelta > 0 ? 1 : -1)),
          )

          wheelDelta = 0

          if (next === current) return

          // ⚠ setLevel 의 anchor 옵션에 화면 픽셀 좌표를 주면 중심이 엉뚱한 곳으로 옮겨져
          //    지도가 빈 화면이 되어 버립니다(실측 확인). 화면 중심 기준으로만 확대·축소합니다.
          map.setLevel(next)
        }

        // 지도 내부 요소보다 먼저 잫기 위해 캐쳐 단계에서 등록합니다.
        box.addEventListener('wheel', onWheel, { passive: false, capture: true })
        unwatchWheel = () =>
          box.removeEventListener('wheel', onWheel, { capture: true })

        observer = new ResizeObserver(() => {
          // 크기가 잡히기 전에는 지도를 만들지 않습니다.
          if (!box.clientWidth || !box.clientHeight) return

          if (map) {
            map.relayout()
            map.setCenter(center)

            return
          }

          box.replaceChildren()

          map = new kakao.maps.Map(box, { center, level: MAP_LEVEL, scrollwheel: false })
          new kakao.maps.Marker({ position: center }).setMap(map)
        })

        observer.observe(box)
      })
      .catch(() => {
        if (alive) setFailed(true)
      })

    return () => {
      alive = false
      unwatchWheel?.()
      observer?.disconnect()
      box.replaceChildren()
    }
  }, [])

  return (
    <div className="map">
      <div className="map__frame">
        <div ref={boxRef} className="map__canvas" data-testid="kakao-map" />

        {failed && (
          <div className="map__fallback">
            <p>{SITE.address}</p>
          </div>
        )}

        <p className="map__hint">
          <kbd>Ctrl</kbd> + 스크롤로 확대·축소
        </p>
      </div>

      <ul className="map__apps">
        {MAP_APPS.map((app) => (
          <li key={app.key}>
            <a
              href={app.href}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn--sm btn--outline"
            >
              {app.label} ↗
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
