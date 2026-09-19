import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BUTTON_OUTLINE_TIGHT } from "../ui";

// The map on 찾아오시는 길, a Kakao map, embedded, the way 마루아트센터 and the
// gallery's own 오시는길 page (galleryis.com/sub02_co3.php) both do it.
//
// It carries no appkey, and that is not an oversight. Kakao's 지도 퍼가기 embed
// the one on maruartcenter.co.kr, loads its map library from
// ssl.daumcdn.net/dmaps/map_js_init/v3.js, the legacy Daum endpoint, which
// serves keyless to any origin. The modern dapi.kakao.com/v2/maps/sdk.js route
// needs a Kakao Developers app whose registered domains must include the site
// serving the page, which is why the gallery's own key (bound to galleryis.com)
// could never have worked on galleryis.web.app. This route needs nothing: no
// developer app, no domain registration, no key to rotate, no deploy variable.
//
// What it costs: v3.js is Kakao's older endpoint. It is what every 지도 퍼가기
// embed on the Korean web runs on today, so it is not going quietly, but if it
// ever does, the swap is this file's loader plus an appkey constant, and the
// address rows under the map keep the section standing meanwhile.

/** The marker, from the legacy page's own kakao.maps.LatLng call. */
const CENTER = { lat: 37.5747722975425, lng: 126.984148806271 };

/**
 * Kakao counts levels downwards, 1 is as far in as the map goes, and that is
 * where the legacy page opens too. The building fills the frame; 안국역 and the
 * length of 인사동길 are off screen, which the rows of directions under the map
 * answer better than a map does anyway.
 */
const ZOOM_LEVEL = 1;

const MAP_API =
  "https://ssl.daumcdn.net/dmaps/map_js_init/v3.js?autoload=false";

/**
 * Deep links out to the three map apps a visitor here might have. Labelled
 * with the brand alone (카카오맵 · 네이버 · 구글) so all three share one row on
 * a phone: under the map, 지도 on each of them is a word the map already said,
 * and it was 54px of Korean — more in English — against 320px of screen.
 */
const MAP_APPS = [
  {
    key: "kakao",
    href: `https://map.kakao.com/link/map/갤러리이즈,${CENTER.lat},${CENTER.lng}`,
  },
  {
    key: "naver",
    href: `https://map.naver.com/p/search/${encodeURIComponent("갤러리 이즈 인사동")}`,
  },
  {
    key: "google",
    href: `https://www.google.com/maps/search/?api=1&query=${CENTER.lat},${CENTER.lng}`,
  },
] as const;

interface KakaoMarker {
  setMap(map: KakaoMap): void;
}
interface KakaoMap {
  /** Re-measures the container. Kakao's own remedy for a resized map node. */
  relayout(): void;
  setCenter(position: KakaoLatLng): void;
}
type KakaoLatLng = object;

interface KakaoNamespace {
  maps: {
    load(onReady: () => void): void;
    LatLng: new (lat: number, lng: number) => KakaoLatLng;
    Map: new (
      container: HTMLElement,
      options: { center: KakaoLatLng; level: number },
    ) => KakaoMap;
    Marker: new (options: { position: KakaoLatLng }) => KakaoMarker;
  };
}

declare global {
  interface Window {
    kakao?: KakaoNamespace;
  }
}

/**
 * Inject the library once per document and resolve when `kakao.maps` is usable.
 * `autoload=false` then an explicit `maps.load()` is the endpoint's own
 * contract, the same two steps the 퍼가기 loader takes.
 *
 * v3.js defines `window.daum` and `window.kakao` as the same object (checked:
 * `daum.maps === kakao.maps`). `daum` is the pre-merger name the 퍼가기 loader
 * still writes against; new code takes the `kakao` alias, which is the one
 * every current Kakao doc uses and the one a reader will recognise.
 */
let mapApi: Promise<KakaoNamespace> | undefined;
function loadMapApi(): Promise<KakaoNamespace> {
  mapApi ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.src = MAP_API;
    script.onload = () => {
      const kakao = window.kakao;
      if (!kakao) {
        reject(new Error("Kakao map API loaded without a kakao global"));
        return;
      }
      kakao.maps.load(() => resolve(kakao));
    };
    script.onerror = () => reject(new Error("Kakao map API failed to load"));
    document.head.append(script);
  });
  return mapApi;
}

export default function VisitMap() {
  const { t } = useTranslation();
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    let observer: ResizeObserver | undefined;
    loadMapApi()
      .then((kakao) => {
        if (!live || !container.current) return;
        const node = container.current;
        const center = new kakao.maps.LatLng(CENTER.lat, CENTER.lng);
        let map: KakaoMap | undefined;

        // The map is built from inside the observer rather than from here, and
        // that is the whole trick. Kakao measures the node once at
        // construction and holds that geometry: build it while the stylesheet
        // is still in flight, which is exactly when this promise resolves,
        // and the map spends the rest of its life centred on wherever the
        // gallery was in a node of the wrong size, which put 광화문 in the
        // frame and the marker off the edge on a phone. ResizeObserver
        // callbacks run after layout, so the first one is the earliest moment
        // the node's real size is knowable, and every later one is a rotation
        // or a fold opening.
        observer = new ResizeObserver(() => {
          if (!node.clientWidth || !node.clientHeight) return;
          if (!map) {
            // Kakao's Map has no destroy() and appends into the node, so a
            // re-run would stack a second map over the first. Owning the
            // node's contents on both sides makes re-running harmless.
            node.replaceChildren();
            map = new kakao.maps.Map(node, { center, level: ZOOM_LEVEL });
            new kakao.maps.Marker({ position: center }).setMap(map);
            return;
          }
          // A resized map keeps its top-left corner rather than its centre,
          // which walks the gallery off the edge when a phone rotates.
          map.relayout();
          map.setCenter(center);
        });
        observer.observe(node);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
      observer?.disconnect();
      container.current?.replaceChildren();
    };
  }, []);

  return (
    <div>
      <div className="relative h-[380px] w-full overflow-hidden border border-line bg-surface sm:h-[450px]">
        <div
          ref={container}
          data-testid="kakao-map"
          className="absolute inset-0"
        />
        {/* A blocked script must not leave a grey rectangle where a map was
            promised. The address is the answer the map was going to give. */}
        {failed && (
          <div className="absolute inset-0 grid place-items-center bg-surface px-6 text-center">
            <p className="text-sm leading-relaxed text-ink-soft">
              {t("visit.address")}
            </p>
          </div>
        )}
      </div>
      {/* One row on a phone: 288px of the 320px a 360px screen leaves, and
          300px in English. `flex-wrap` is the floor under that, not the plan —
          a narrower screen than any current phone still folds rather than
          overflowing. */}
      <ul className="mt-4 flex flex-wrap gap-2 sm:gap-3">
        {MAP_APPS.map((app) => (
          <li key={app.key}>
            <a
              href={app.href}
              target="_blank"
              rel="noopener noreferrer"
              className={BUTTON_OUTLINE_TIGHT}
            >
              {t(`visit.mapApps.${app.key}`)} ↗
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
