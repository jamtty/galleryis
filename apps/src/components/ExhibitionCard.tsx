import { motion } from "framer-motion";
import type { ExhibitionSummary } from "@galleryis/shared";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { hallLabel, showTitle, useExhibitions } from "../lib/exhibition";
import { PosterGridSkeleton } from "./Skeleton";

// The poster card and the grid around it, shared by the front page's two
// strips and the /exhibitions tabs page. insaartcenter's card: the picture
// on white with no frame, then the title bold, the dates, and where it
// hangs, one line each.

export function ExhibitionCard({
  exhibition,
  index,
}: {
  exhibition: ExhibitionSummary;
  index: number;
}) {
  const { t } = useTranslation();
  const image = exhibition.images?.[0];
  const title = showTitle(exhibition);
  const hall = hallLabel(exhibition, t);
  return (
    <article
      className="animate-rise"
      style={{ animationDelay: `${index * 90}ms` }}
    >
      {/* The whole card is the link, as the legacy poster is: the show's own
          page is behind it. `group` lives on the link so the frame and the
          title answer the same hover. */}
      <Link to={`/exhibitions/${exhibition.id}`} className="group block">
        {/* A square field. What the gallery publishes for a show is whatever
            the artist sent, the ones on the wire run from 0.7 to 1.45 aspect
            in the same week, and a square is the one shape that letterboxes
            all of them modestly and symmetrically. On white the letterbox is
            invisible, which is exactly insaartcenter's look. object-contain,
            not cover: a crop takes the title off a poster (measured,
            호모사피엔스 lost its first syllable at 1:1 cover). */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex aspect-square items-center justify-center overflow-hidden bg-surface"
        >
          {image && (
            <img
              src={image}
              alt=""
              // The first card is the page's LCP, load it eagerly.
              loading={index === 0 ? "eager" : "lazy"}
              fetchPriority={index === 0 ? "high" : undefined}
              className="h-full w-full object-contain"
            />
          )}
        </motion.div>
        <div className="mt-5">
          {/* The show's own name, Korean in both locales — see showTitle.
              `lang` so a screen reader on the English page switches voice. */}
          <h3
            lang="ko"
            className="font-display text-lg leading-snug font-bold break-keep decoration-1 underline-offset-4 group-hover:underline"
          >
            {title}
          </h3>
          {/* No artist line: the origin files the show under a name that
              is already in the title (리 정 → 리 정 개인전), so under the
              poster it only read as the same words twice. */}
          <p className="mt-2 text-base tabular-nums">
            {exhibition.period_text}
          </p>
          {hall && <p className="mt-1 text-base text-ink-soft">{hall}</p>}
        </div>
      </Link>
    </article>
  );
}

/** The pending / error / empty / grid branches, shared by every listing. */
export function ExhibitionList({
  query,
  emptyText,
  centerEmpty = false,
}: {
  query: ReturnType<typeof useExhibitions>;
  emptyText?: string;
  /** 빈 목록 문구를 가운데로 — 전시 목록 페이지는 제목·탭이 가운데라 거기서만 켭니다. */
  centerEmpty?: boolean;
}) {
  const { t } = useTranslation();
  // The API answers with an array, but a page that renders whatever it is
  // handed should not fall over if that ever stops being true.
  const items = query.data ?? [];
  if (query.isPending) return <PosterGridSkeleton />;
  if (query.isError)
    return <p className="text-base text-accent-ink">{t("loadError")}</p>;
  if (items.length === 0)
    return (
      <p
        className={`text-base text-ink-soft${centerEmpty ? " text-center" : ""}`}
      >
        {emptyText ?? t("noExhibitions")}
      </p>
    );
  return (
    // Four across on a wide screen: one hall, one show, one column. On a
    // phone two across keeps the poster the size of the screen's own width.
    <div className="grid grid-cols-2 gap-x-5 gap-y-12 sm:gap-x-8 lg:grid-cols-4 lg:gap-x-10">
      {items.map((exhibition, index) => (
        <ExhibitionCard
          key={exhibition.id}
          exhibition={exhibition}
          index={index}
        />
      ))}
    </div>
  );
}
