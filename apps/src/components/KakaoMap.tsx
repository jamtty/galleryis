import { useEffect, useRef, useState } from 'react'
import { SITE } from '../data/site'

/**
 * 갤러리 이즈 위치 지도 (원본 사이트와 같은 방식).
 *
 * 카카오(다음) 지도 SDK 를 autoload=false 로 받아 daum.maps.load() 로 초기화하고,
 * 지도 상자를 지켜보다가(ResizeObserver) 크기가 잡히면 그때 만듭니다.
 * SDK 를 못 받으면 주소를 대신 보여 줍니다.
 */

/** SDK 주소 */
const SDK_SRC = 'https://ssl.daumcdn.net/dmaps/map_js_init/v3.js?autoload=false'

/** 확대 단계 (1 = 가장 가까이) */
const MAP_LEVEL = 1

type LatLng = unknown

type MapInstance = {
  relayout: () => void
  setCenter: (position: LatLng) => void
}

type KakaoNamespace = {
  maps: {
    load: (callback: () => void) => void
    LatLng: new (lat: number, lng: number) => LatLng
    Map: new (node: HTMLElement, options: { center: LatLng; level: number }) => MapInstance
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

    loadSdk()
      .then((kakao) => {
        if (!alive) return

        const center = new kakao.maps.LatLng(SITE.coords.lat, SITE.coords.lng)
        let map: MapInstance | null = null

        observer = new ResizeObserver(() => {
          // 크기가 잡히기 전에는 지도를 만들지 않습니다.
          if (!box.clientWidth || !box.clientHeight) return

          if (map) {
            map.relayout()
            map.setCenter(center)

            return
          }

          box.replaceChildren()

          map = new kakao.maps.Map(box, { center, level: MAP_LEVEL })
          new kakao.maps.Marker({ position: center }).setMap(map)
        })

        observer.observe(box)
      })
      .catch(() => {
        if (alive) setFailed(true)
      })

    return () => {
      alive = false
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
