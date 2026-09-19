import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { hallLabel, showTitle, useExhibitions } from "../lib/exhibition";
import { HeroSkeleton } from "./Skeleton";
import { BUTTON_OUTLINE, GUTTER } from "../ui";

// The landing's opening, insaartcenter's own: one show at a time as a split
// hero, the words on the left (where it hangs, the title, the artist, the
// dates) and the poster large on a grey field to the right, with a row of
// dots under the words to page through this week's four. The rotation is
// slow, 4.5 s, the legacy galleryis.com main visual's own 속도조절 value.
// Hovering or focusing pauses it; touching the pager stops it for good, the
// visitor has taken the wheel; prefers-reduced-motion turns it off entirely.
// The grid of four follows further down the page.

const ROTATE_MS = 4500;

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function Arrow({ direction }: { direction: "prev" | "next" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {direction === "prev" ? (
        <path d="M15 5l-7 7 7 7" />
      ) : (
        <path d="M9 5l7 7-7 7" />
      )}
    </svg>
  );
}

export default function NowShowing({
  query,
}: {
  query: ReturnType<typeof useExhibitions>;
}) {
  const { t } = useTranslation();
  const items = query.data ?? [];
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // Set the first time the visitor works the pager themselves: a rotation
  // that yanks the poster away right after they chose it reads as broken.
  const [manual, setManual] = useState(false);
  const count = items.length;

  useEffect(() => {
    if (count < 2 || paused || manual || prefersReducedMotion()) return;
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % count),
      ROTATE_MS,
    );
    return () => window.clearInterval(id);
  }, [count, paused, manual]);

  if (query.isPending) {
    return (
      <section
        id="hero"
        aria-label={t("nowShowing")}
        className="border-b border-line"
      >
        <HeroSkeleton />
      </section>
    );
  }

  const status = query.isError
    ? t("loadError")
    : count === 0
      ? t("noExhibitions")
      : null;

  if (status) {
    return (
      <section
        id="hero"
        aria-label={t("nowShowing")}
        className={`border-b border-line py-20 ${GUTTER}`}
      >
        <p
          className={`text-base ${query.isError ? "text-accent-ink" : "text-ink-soft"}`}
        >
          {status}
        </p>
      </section>
    );
  }

  const current = items[index % count];
  const title = showTitle(current);
  const hall = hallLabel(current, t);
  const image = current.images?.[0];
  const href = `/exhibitions/${current.id}`;
  const pick_ = (i: number) => {
    setManual(true);
    setIndex(((i % count) + count) % count);
  };
  const pagerButton =
    "grid h-11 w-11 place-items-center rounded-full border border-line-lit text-ink transition-colors hover:border-ink hover:bg-ink hover:text-ground";

  return (
    <section
      id="hero"
      aria-label={t("nowShowing")}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      className="grid border-b border-line lg:grid-cols-2"
    >
      {/* The words. The eyebrow is where the show hangs, insaartcenter's
          "B1F 제1전시장"; the title is the page's h1, the biggest thing on it. */}
      <div
        className={`flex flex-col justify-between py-12 lg:py-16 lg:pr-16 ${GUTTER}`}
      >
        {/* Paging swaps the element; the rise keyframe (globally off under
            prefers-reduced-motion) makes the swap read as a change rather
            than a glitch, and the new words are on the page at once. */}
        <div key={current.id} className="my-auto animate-rise">
          <p className="text-base text-ink-soft">
            {t("nowShowing")}
            {hall && (
              <>
                <span aria-hidden> · </span>
                {hall}
              </>
            )}
          </p>
          {/* The show's own name, Korean in both locales — see showTitle.
              `lang` so a screen reader on the English page switches voice. */}
          <h1
            lang="ko"
            className="mt-4 font-display text-display font-bold break-keep"
          >
            <Link to={href} className="transition-colors hover:text-ink-soft">
              {title}
            </Link>
          </h1>
          {/* No artist line, as on the card: the origin files the show
              under a name that is already in the title (리 정 → 리 정
              개인전), so under it the name only read twice. */}
          <p className="mt-4 text-base text-ink-soft tabular-nums">
            {current.period_text}
          </p>
          <Link to={href} className={`mt-8 ${BUTTON_OUTLINE}`}>
            {t("exhibition.detail")}
          </Link>
        </div>

        {count > 1 && (
          <div className="mt-12 flex flex-wrap items-center gap-x-5 gap-y-3 lg:mt-16">
            {/* insaartcenter's dots, each with a 44px hit area around it. */}
            <div className="flex items-center">
              {items.map((exhibition, i) => (
                <button
                  key={exhibition.id}
                  type="button"
                  onClick={() => pick_(i)}
                  aria-label={t("nowShowingGoto", { n: i + 1 })}
                  aria-current={i === index ? "true" : undefined}
                  className="group grid h-11 w-7 place-items-center"
                >
                  <span
                    aria-hidden
                    className={`block h-2.5 w-2.5 rounded-full transition-colors ${
                      i === index ? "bg-ink" : "bg-ink/25 group-hover:bg-ink/60"
                    }`}
                  />
                </button>
              ))}
            </div>
            <p className="text-sm text-ink-soft tabular-nums">
              {index + 1} / {count}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => pick_(index - 1)}
                aria-label={t("nowShowingPrev")}
                className={pagerButton}
              >
                <Arrow direction="prev" />
              </button>
              <button
                type="button"
                onClick={() => pick_(index + 1)}
                aria-label={t("nowShowingNext")}
                className={pagerButton}
              >
                <Arrow direction="next" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* The poster, on the grey field. object-contain, never cover: the
          posters run from 0.7 to 2.9 aspect in one week and a crop takes the
          title off one of them. The field takes the letterboxing instead. A
          second link to the same page, hidden from the tab order so the
          keyboard gets one stop per show. */}
      <Link
        to={href}
        tabIndex={-1}
        aria-hidden
        className="grid min-h-[20rem] place-items-center bg-surface-hi p-6 sm:min-h-[26rem] sm:p-10 lg:min-h-[36rem] lg:p-14"
      >
        <AnimatePresence mode="wait" initial={false}>
          {image && (
            <motion.img
              key={current.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              src={image}
              alt=""
              loading="eager"
              fetchPriority="high"
              className="max-h-[24rem] w-auto max-w-full object-contain lg:max-h-[32rem]"
            />
          )}
        </AnimatePresence>
      </Link>

      {/* The other posters, fetched now so paging is instant: display-none
          images still download unless they are lazy. */}
      <div hidden>
        {items.map(
          (exhibition, i) =>
            i !== index &&
            exhibition.images?.[0] && (
              <img key={exhibition.id} src={exhibition.images[0]} alt="" />
            ),
        )}
      </div>
    </section>
  );
}
