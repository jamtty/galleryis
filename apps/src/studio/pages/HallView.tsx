import {
  fetchJson,
  pick,
  type Hall,
} from "@galleryis/shared";
import { useQuery } from "@tanstack/react-query";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import LanguageToggle from "../components/LanguageToggle";
import Loader from "../components/Loader";
import WorksPanel from "../components/WorksPanel";
import { MAX_WORKS } from "../lib/artworkImage";
import { useWorksStore } from "../store/works";

// Nested lazy: three.js loads only when WebGL is actually available, and the
// jsdom tests (no WebGL) never import it at all.
const HallScene = lazy(() => import("../scenes/HallScene"));

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-ground px-6 text-center text-ink">
      <div className="space-y-5">{children}</div>
    </main>
  );
}

function PhotoFallback({ hall }: { hall: Hall }) {
  const { t, i18n } = useTranslation();
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-4 px-5 pt-10 pb-40 sm:px-8">
        <p className="text-sm text-ink-soft">{t("webglFallback")}</p>
        {(hall.photos ?? []).map((src, index) => (
          <img
            key={src}
            src={src}
            alt={`${pick(hall, "name", i18n.language)} ${index + 1}`}
            loading="lazy"
            className="w-full border border-line"
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Publish the sticky bar's measured height as `--hall-footer`.
 *
 * The panels float above it, and both used to reserve a flat `bottom-16`,
 * 4 rem, which is what the bar is on a desktop. On a phone it wraps to two or
 * three rows (name, specs, two pills, two disclaimers) and stands at ~148 px,
 * so the panels overlapped it and swallowed the taps meant for 대관 신청. The
 * numbers differ again in English, and again in landscape, which is why this
 * measures rather than picks a bigger constant.
 */
function useFooterHeight() {
  const [node, setNode] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!node) return;
    const root = node.closest<HTMLElement>("[data-hall-root]") ?? node;
    const publish = () =>
      root.style.setProperty("--hall-footer", `${node.offsetHeight}px`);
    publish();
    // Wrapping changes with width, locale and orientation; a resize observer
    // catches all three without a listener per cause.
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(publish);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return useCallback((el: HTMLElement | null) => setNode(el), []);
}

function StickyBar({
  hall,
  worksOpen,
  onWorksToggle,
  applying,
}: {
  hall: Hall;
  worksOpen: boolean;
  // Null on the no-WebGL fallback, where nothing can be hung.
  onWorksToggle: (() => void) | null;
  // False in review mode: the gallery is looking, not booking.
  applying: boolean;
}) {
  const { t, i18n } = useTranslation();
  const worksCount = useWorksStore((state) => state.works.length);
  const measure = useFooterHeight();
  // The bottom padding clears the iPhone home indicator, which sits over this
  // bar whenever Safari's own chrome is hidden.
  return (
    <footer
      ref={measure}
      className="absolute inset-x-0 bottom-0 border-t border-line bg-ground/90 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur"
    >
      <div className="mx-auto flex max-w-4xl flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          {/* Out to 전시장 안내 on the main site, scrolled to this hall's own
              block: choosing a hall is that page's job, and the studio has no
              picker of its own. A plain anchor, not a router Link, like 대관
              신청 and 도면 보기 below — /halls is outside this app's basename. */}
          <a
            href={`/halls#${hall.id}`}
            className="text-sm text-ink-soft underline decoration-ink/25 underline-offset-4 transition-colors hover:text-ink hover:decoration-ink"
          >
            ← {t("hallView.back")}
          </a>
          <h1 className="font-display text-lg font-bold">
            {pick(hall, "name", i18n.language)}
          </h1>
          <span className="text-sm text-ink-soft tabular-nums">
            {t("hallView.specs", {
              area: hall.area_m2,
              pyeong: hall.pyeong,
              ceiling: hall.ceiling_cm,
            })}
          </span>
          {/* The drawing this room was traced from, one tap away, the model
              should be checkable against the gallery's own plan. A path, not
              a host, like the application link below: the studio is served
              under the main site, which holds the plans. */}
          <a
            href={`/floorplans/${hall.id}.jpg`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-ink-soft underline decoration-ink/25 underline-offset-4 transition-colors hover:text-ink"
          >
            {t("hallView.floorplan")}
          </a>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          {onWorksToggle && (
            <button
              type="button"
              onClick={onWorksToggle}
              aria-expanded={worksOpen}
              // The panel unmounts when closed; a dangling id reference is
              // worse than none, so only point at it while it exists.
              aria-controls={worksOpen ? "works-panel" : undefined}
              className="min-h-8 rounded-full bg-ink px-4 py-1 text-sm font-medium text-ground shadow-sm transition-colors hover:bg-ink-soft"
            >
              {/* "0/15" reads as a status readout; with nothing hung yet the
                  button should say what it is for instead. */}
              {worksCount === 0
                ? t("works.add")
                : t("works.counter", { n: worksCount, max: MAX_WORKS })}
            </button>
          )}
          {/* The outline sibling of the works pill: two filled persimmon
              pills in one bar would fight for the same attention. */}
          {/* Out to the gallery's own application, this hall already
              chosen. The studio used to carry a form of its own; one
              application form, on the site that owns applications, is one
              set of fields to keep true to what the gallery asks. A path,
              not a host: the studio is served under the main site at
              /studio/, and the form is one origin away. */}
          {applying && (
            <a
              href={`/rental?hall=${hall.id}`}
              target="_blank"
              rel="noreferrer"
              className="min-h-8 rounded-full border border-line-lit bg-surface px-4 py-1 text-sm font-medium text-ink transition-colors hover:border-ink hover:text-ink"
            >
              {t("reserve.open")}
            </a>
          )}
          <p className="text-xs text-ink-soft">{t("hallView.disclaimer")}</p>
        </div>
      </div>
    </footer>
  );
}
/**
 * A hall's 3D preview, `/studio/halls/:id`.
 *
 * 여기까지 원본(studio) 코드를 그대로 옮겼고, 원본 서버가 있어야 동작하는
 * 두 가지는 걷어냈습니다 — ① AI 도우미(AssistPanel·음성·assist API)
 * ② 제출한 배치를 링크로 되짚는 리뷰 모드(`?layout=`·studio-sessions API).
 */
export default function HallView() {
  // 우리 라우트는 `/halls/:key/studio` 라 파라미터 이름이 key 입니다.
  const { key: id = "" } = useParams();
  const { t } = useTranslation();
  const webgl = useMemo(supportsWebGL, []);
  const hall = useQuery({
    queryKey: ["hall", id],
    queryFn: () => fetchJson<Hall>(`/api/halls/${id}`),
  });
  const [worksOpen, setWorksOpen] = useState(false);

  // Arm the placement store for this hall (clears any other hall's layout).
  const hallData = hall.data;
  useEffect(() => {
    if (webgl && hallData) {
      useWorksStore.getState().setHall(hallData, "edit");
    }
  }, [hallData, webgl]);

  if (hall.isPending) {
    return (
      <Centered>
        <Loader label={t("hallView.loading")} />
      </Centered>
    );
  }
  if (hall.isError) {
    // 없는 전시장(404)과 못 불러온 경우를 나눠 말합니다.
    const missing = (hall.error as { status?: number }).status === 404;

    return (
      <Centered>
        <p className="text-sm text-ink-soft">
          {missing ? t("hallView.notFound") : t("hallView.error")}
        </p>
        <a
          href="/halls"
          className="inline-block text-sm text-ink underline decoration-line-lit underline-offset-4 transition-colors hover:decoration-ink"
        >
          {t("hallView.back")}
        </a>
      </Centered>
    );
  }
  return (
    <div
      data-hall-root
      className="relative h-dvh overflow-hidden bg-ground text-ink [--hall-footer:4rem]"
    >
      {webgl ? (
        <Suspense
          fallback={
            <div className="grid h-full place-items-center">
              <Loader label={t("hallView.loading")} />
            </div>
          }
        >
          <HallScene
            hall={hall.data}
            onAddWorks={() => setWorksOpen(true)}
            interactionLocked={false}
          />
        </Suspense>
      ) : (
        <PhotoFallback hall={hall.data} />
      )}
      {webgl && (
        <WorksPanel open={worksOpen} onClose={() => setWorksOpen(false)} />
      )}
      {/* The gallery praised the one-button KO/EN switch, and it used to
          vanish the moment you entered a hall, the picker had it, the hall
          didn't. Top-left, clear of the mode pill's top-right corner. */}
      <div className="absolute top-4 left-4 z-10 rounded-full bg-ground/85 px-3 py-1.5 shadow-sm backdrop-blur">
        <LanguageToggle />
      </div>
      <StickyBar
        hall={hall.data}
        worksOpen={worksOpen}
        onWorksToggle={webgl ? () => setWorksOpen(!worksOpen) : null}
        applying
      />
    </div>
  );
}
