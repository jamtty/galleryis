import {
  ApiError,
  fetchJson,
  pick,
  type ExhibitionDetail,
} from "@galleryis/shared";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import Bio from "../components/Bio";
import DefRow from "../components/DefRow";
import Lightbox from "../components/Lightbox";
import PageHead from "../components/PageHead";
import RichText from "../components/RichText";
import SectionHead from "../components/SectionHead";
import { ArticleSkeleton } from "../components/Skeleton";
import {
  bioSections,
  hallLabel,
  paragraphs,
  showArtist,
  showTitle,
} from "../lib/exhibition";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { GUTTER, LINK } from "../ui";

// One show's page, insaartcenter's 전시 detail: under the page's centred
// name, the photographs at the left and the show's facts as a table at the
// right (전시명 · 작가 · 전시기간 · 전시장소), then 전시 개요 and 약력 under
// their own ruled headings.
//
// The photographs are the page. The first image is whatever the gallery put
// first, nearly always the poster, at its own proportions and centred in its
// column; the rest follow under a 전시 작품 head in galleryhyundai.com's
// Selected Works grid, four 4:5 grey frames across (two on a phone), each
// picture inset and contained. No carousel: the legacy slider hid seven of
// eight pictures behind arrows, and the audience here skews older. Any
// picture, the poster too, opens in the Lightbox at its place in the set.

export default function ExhibitionPage() {
  const { id = "" } = useParams();
  const { t, i18n } = useTranslation();
  const query = useQuery({
    queryKey: ["exhibition", id],
    queryFn: () =>
      fetchJson<ExhibitionDetail>(`/api/exhibitions/${encodeURIComponent(id)}`),
  });

  // A client-side navigation keeps the scroll position of the page it left,
  // the middle of the poster grid, which is not where a page starts.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [id]);

  // Which picture the Lightbox has up, by its place in `images`; null when
  // it is closed.
  const [open, setOpen] = useState<number | null>(null);

  const show = query.data;
  const title = show ? showTitle(show) : null;
  useDocumentTitle(title, t("brand.name"));

  const back = (
    <Link
      to="/exhibitions"
      className={`inline-flex min-h-11 items-center gap-2 text-sm ${LINK}`}
    >
      <span aria-hidden>←</span>
      {t("exhibition.back")}
    </Link>
  );

  if (query.isPending)
    return (
      <main>
        <PageHead title={t("nav.exhibitions")} kicker />
        <div className={`py-10 sm:py-14 ${GUTTER}`}>
          {back}
          <div className="mt-8 sm:mt-10">
            <ArticleSkeleton />
          </div>
        </div>
      </main>
    );

  if (query.isError) {
    const missing =
      query.error instanceof ApiError && query.error.status === 404;
    return (
      <main>
        <PageHead title={t("nav.exhibitions")} />
        <div className={`py-10 ${GUTTER}`}>
          {back}
          <h2 className="mt-10 font-display text-title font-bold">
            {missing ? t("exhibition.notFound") : t("loadError")}
          </h2>
        </div>
      </main>
    );
  }

  const exhibition = show!;
  const artist = showArtist(exhibition);
  const hall = hallLabel(exhibition, t);
  // A post written on the desk carries its 전시개요 and 약력 as rich text,
  // sanitised by the API, and that is what it wants printed; a mirrored post
  // has only the plain text, read the way the origin's shape asks for.
  const overviewHtml = pick(exhibition, "overview_html", i18n.language);
  const bioHtml = pick(exhibition, "bio_html", i18n.language);
  const overview = overviewHtml
    ? []
    : paragraphs(pick(exhibition, "overview", i18n.language));
  // 약력 is a CV and gets read as one; the Korean rides along as the shape
  // to fall back on when a machine-translated bio arrives without its groups.
  const bio = bioHtml
    ? []
    : bioSections(pick(exhibition, "bio", i18n.language), exhibition.bio_ko);
  const images = exhibition.images ?? [];
  const [lead, ...rest] = images;
  const machine =
    i18n.language === "en" && exhibition.translation === "machine";

  return (
    <main>
      <PageHead title={t("nav.exhibitions")} kicker />
      <div className={`py-10 sm:py-14 ${GUTTER}`}>
        {back}
        <article className="animate-rise mt-8 sm:mt-10">
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
            {lead && (
              <div className="flex items-start justify-center">
                <button
                  type="button"
                  onClick={() => setOpen(0)}
                  className="cursor-zoom-in"
                >
                  <img
                    src={lead}
                    alt={t("exhibition.photo", { title, n: 1 })}
                    // Its own proportions, capped by the viewport's height so
                    // a portrait poster is not three screens tall, and centred
                    // in the column so a narrow one does not hang off the left
                    // edge of a half-empty row.
                    className="max-h-[80vh] w-auto max-w-full object-contain"
                    fetchPriority="high"
                  />
                </button>
              </div>
            )}
            <header>
              {/* The show's own name, Korean in both locales — see showTitle.
                  `lang` so a screen reader on the English page switches
                  voice. */}
              <h1
                lang="ko"
                className="font-display text-title font-bold break-keep"
              >
                {title}
              </h1>
              {/* insaartcenter's spec table: a 2px ink rule on top, one
                  bold label and one value per hairline row. 작가명 is
                  printed as the gallery filed it, even when that is the
                  show's own name, as the legacy view does — and in Korean
                  under either locale, since a name is not ours to restate
                  (see showArtist). */}
              <dl className="mt-5 border-t-2 border-ink">
                {artist && (
                  <DefRow label={t("exhibition.artist")}>
                    <span lang="ko">{artist}</span>
                  </DefRow>
                )}
                {exhibition.period_text && (
                  <DefRow label={t("exhibition.period")}>
                    <span className="tabular-nums">
                      {exhibition.period_text}
                    </span>
                  </DefRow>
                )}
                {hall && <DefRow label={t("exhibition.hall")}>{hall}</DefRow>}
              </dl>
            </header>
          </div>

          {rest.length > 0 && (
            <section className="mt-14 sm:mt-20">
              <SectionHead title={t("exhibition.works")} />
              {/* galleryhyundai.com's grid: four across at 20px, two at 10px
                  on a phone, every frame 560:700 on their #f6f6f6. Their
                  pictures carry their own white margins; ours arrive cropped
                  to the work, so the frame insets them itself. Contain, not
                  cover: what the gallery files for one show runs from a wide
                  install shot to a tall figure, and nothing gets cropped. */}
              <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4 lg:gap-5">
                {rest.map((src, index) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setOpen(index + 1)}
                    className="flex aspect-[4/5] cursor-zoom-in items-center justify-center overflow-hidden bg-surface-hi p-4 transition-colors hover:bg-line sm:p-6"
                  >
                    <img
                      src={src}
                      alt={t("exhibition.photo", { title, n: index + 2 })}
                      loading="lazy"
                      className="h-full w-full object-contain"
                    />
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* 전시 개요 and 약력 sit where 전시 작품 sits: flush to the
              article's left edge, their heading rules running the section's
              full width. Only the prose keeps a measure, so a line of Korean
              does not run the width of a desktop. */}
          <div className="mt-14 sm:mt-20">
            {(overviewHtml || overview.length > 0) && (
              <section>
                <h2 className="border-b border-line pb-3 font-display text-title font-bold">
                  {t("exhibition.overview")}
                </h2>
                {overviewHtml ? (
                  <RichText html={overviewHtml} className="mt-6 max-w-4xl" />
                ) : (
                  <div className="mt-6 max-w-4xl space-y-4 text-base leading-relaxed">
                    {overview.map((paragraph, index) => (
                      <p key={index} className="whitespace-pre-line">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                )}
              </section>
            )}

            {(bioHtml || bio.length > 0) && (
              <section className="mt-14">
                <h2 className="border-b border-line pb-3 font-display text-title font-bold">
                  {t("exhibition.bio")}
                </h2>
                {bioHtml ? (
                  <RichText html={bioHtml} className="mt-6 max-w-4xl" />
                ) : (
                  <Bio groups={bio} />
                )}
              </section>
            )}

            {machine && (
              <p className="mt-10 max-w-4xl text-sm text-ink-soft">
                {t("exhibition.machine")}
              </p>
            )}
          </div>
        </article>
      </div>
      {open !== null && (
        <Lightbox
          images={images}
          index={open}
          title={title ?? ""}
          onClose={() => setOpen(null)}
          onIndexChange={setOpen}
        />
      )}
    </main>
  );
}
