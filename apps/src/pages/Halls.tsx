import { fetchJson, pick } from "@galleryis/shared";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";
import PageHead from "../components/PageHead";
import { HallsSkeleton } from "../components/Skeleton";
import { krw, TIERS } from "../lib/pricing";
import { useDocumentTitle } from "../lib/useDocumentTitle";
// 우리 백엔드에 맞춘 전시장 정보 (도면·조감도 주소 포함)
import type { SiteHall } from "../shared/backend";
import {
  BUTTON_OUTLINE,
  CHIP_OFF,
  GUTTER,
  LINK,
  SCROLL_MT,
  TABLE,
  TABLE_LABEL,
  TABLE_VALUE,
} from "../ui";

// 전시장 안내, insaartcenter's 대관 · 전시장안내 page: the floors as chips
// under the page's name, then one block per hall, the storey as a large
// label at the left, the photographs beside it, and the hall's facts as a
// table with grey label cells at the right, the fees under it, and the two
// doors out: walking it in 3D, and applying for it with the hall preselected.
//
// The photo row is a plain scroll strip, not a carousel: the legacy slider
// hid eight of nine pictures behind arrows, and the audience here skews
// older. Every photograph is on the page, the row scrolls sideways where it
// must, and nothing needs to be discovered.

export default function HallsPage() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const halls = useQuery({
    queryKey: ["halls"],
    queryFn: () => fetchJson<SiteHall[]>("/api/halls"),
  });
  useDocumentTitle(t("hallsPage.title"), t("brand.name"));
  const items = halls.data ?? [];

  // A client-side navigation keeps the scroll position of the page it left,
  // which is not where a page starts. Only without a hash: a hash means the
  // visitor asked for a specific hall, handled below.
  useEffect(() => {
    if (!window.location.hash) window.scrollTo({ top: 0 });
  }, []);

  // Arriving with a hash (#hall3, from the chips or a shared link) scrolls
  // to that hall once the list has answered and the sections exist.
  useEffect(() => {
    if (!location.hash || items.length === 0) return;
    document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, [location.key, location.hash, items.length]);

  return (
    <main>
      <PageHead
        title={t("hallsPage.title")}
        tabs={
          items.length > 0 ? (
            // The four halls as chips, insaartcenter's floor filter, each a
            // full 44px target. They jump rather than filter: four halls fit
            // one page, and a filter would hide three of them.
            //
            // A grid, not a wrapping flex row: chips sized by their own words
            // came out a ragged staircase, 제1전시장 narrower than 제4전시장 and
            // every English name wider again, with an orphan on a second row.
            // Equal columns fix both — `w-max` keeps the block the width of
            // its chips, centred rather than stretched across the page, until
            // a narrow screen caps it.
            //
            // Four columns from `md`, not `sm`: at 640px four English chips
            // are pinched narrower than "1F · Exhibition Hall 1" and the name
            // wraps. The same reason trims the chips' padding under `lg`,
            // where a capped column can land a hair short of its own text.
            <nav
              aria-label={t("hallsPage.title")}
              className="grid w-max max-w-full auto-rows-fr grid-cols-2 gap-2 pb-8 md:grid-cols-4 sm:pb-10"
            >
              {items.map((hall) => (
                <a
                  key={hall.id}
                  href={`#${hall.id}`}
                  className={`${CHIP_OFF} justify-center text-center max-lg:px-3`}
                >
                  {hall.floor} · {pick(hall, "name", i18n.language)}
                </a>
              ))}
            </nav>
          ) : undefined
        }
      />

      {/* Reserved to a screen's height while the halls load: the sections
          arriving must not shove what a visitor is already reading. */}
      <div className={`min-h-screen py-10 sm:py-14 ${GUTTER}`}>
        {halls.isPending && <HallsSkeleton />}
        {halls.isError && (
          <p className="text-base text-accent-ink">{t("loadError")}</p>
        )}

        {halls.isSuccess &&
          items.map((hall, hallIndex) => {
            const name = pick(hall, "name", i18n.language);
            const photos = hall.photos ?? [];
            return (
              <section
                key={hall.id}
                id={hall.id}
                className={`${SCROLL_MT} border-t border-line py-12 first:border-t-0 first:pt-0 sm:py-16`}
              >
                <div className="grid gap-8 lg:grid-cols-[4rem_1fr_1fr] lg:gap-10">
                  {/* The storey, insaartcenter's large "B1F" at the block's
                      left edge. */}
                  <p className="font-display text-2xl font-bold text-ink lg:text-3xl">
                    {hall.floor}
                  </p>

                  {/* The gallery's own sheet for the hall, plan beside a
                      bird's-eye render, at the block's centre, insaartcenter's
                      plan box; a static file cut by
                      `scripts/make_hall_sheets.py`, not a mirrored photo. The
                      photographs run in a strip under the block. */}
                  {/* 관리자에서 올린 도면·조감도가 있으면 그것을, 없으면 원본
                      사이트의 고정 파일을 씁니다. */}
                  <img
                    src={hall.sheet_url ?? `/hall-sheets/${hall.id}.jpg`}
                    alt={t("hallsPage.sheetAlt", { hall: name })}
                    loading={hallIndex === 0 ? "eager" : "lazy"}
                    fetchPriority={hallIndex === 0 ? "high" : undefined}
                    className="aspect-[4/3] w-full border border-line bg-surface object-contain"
                  />

                  <div>
                    <h2 className="font-display text-title font-bold">
                      {name}
                    </h2>
                    {/* insaartcenter's spec table: grey label cells, one
                        hairline per row. Area and ceiling are the facts a
                        renter decides on, with the page-wide disclaimer at
                        the end. */}
                    <dl className={`mt-4 ${TABLE}`}>
                      <dt className={TABLE_LABEL}>{t("hallsPage.floor")}</dt>
                      <dd className={TABLE_VALUE}>{hall.floor}</dd>
                      <dt className={TABLE_LABEL}>{t("hallsPage.size")}</dt>
                      <dd className={`${TABLE_VALUE} tabular-nums`}>
                        {t("halls.specs", {
                          area: hall.area_m2,
                          pyeong: hall.pyeong,
                          ceiling: hall.ceiling_cm,
                        })}
                      </dd>
                      {/* The three seasonal fees, each with the months it
                          covers written out. A fragment, not a row box: the
                          pairs are the table grid's own children. */}
                      {TIERS.map((tier) => (
                        <Fragment key={tier}>
                          <dt className={TABLE_LABEL}>
                            {t(`rental.pricing.seasons.${tier}`)}
                          </dt>
                          <dd
                            className={`${TABLE_VALUE} flex flex-wrap items-baseline gap-x-4 gap-y-1`}
                          >
                            <span className="tabular-nums">
                              {krw.format(hall.pricing[tier])}
                            </span>
                            {/* The months own the right edge, so all three
                                runs end on one column. */}
                            <span className="ml-auto text-sm text-ink-soft">
                              {t(`rental.pricing.months.${tier}`)}
                            </span>
                          </dd>
                        </Fragment>
                      ))}
                    </dl>
                    <p className="mt-3 text-sm text-ink-soft">
                      {t("rental.pricing.perWeek")}
                    </p>

                    <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3">
                      {/* 원본은 별도 VR 앱(/studio)으로 갔지만, 우리는 같은 앱
                          안의 화면(/halls/{key}/studio)으로 들어갑니다. */}
                      <Link
                        to={`/halls/${hall.id}/studio`}
                        className={BUTTON_OUTLINE}
                      >
                        {t("hallsPage.walk3d")}
                      </Link>
                      <Link
                        to={`/rental?hall=${hall.id}`}
                        className={BUTTON_OUTLINE}
                      >
                        {t("hallsPage.apply")}
                      </Link>
                      {/* The gallery's own plan of this hall, served from the
                          site so `download` is honoured: the label promises a
                          file, and a cross-origin href only opens the picture
                          full-screen with nowhere to go back to. */}
                      <a
                        href={hall.plan_url ?? `/floorplans/${hall.id}.jpg`}
                        download={t("hallsPage.floorplanFile", { hall: name })}
                        className={`inline-flex min-h-11 items-center text-sm ${LINK}`}
                      >
                        {t("hallsPage.floorplan")}
                      </a>
                    </div>
                  </div>
                </div>

                {photos.length > 0 && (
                  // tabIndex: a scroll region with no focusable children is
                  // unreachable by keyboard in Safari; the group role and
                  // label tell a screen reader what the stop is.
                  <div
                    tabIndex={0}
                    role="group"
                    aria-label={name}
                    className="mt-8 flex snap-x gap-3 overflow-x-auto pb-2 lg:ml-[calc(4rem+2.5rem)]"
                  >
                    {photos.map((src, index) => (
                      <img
                        key={src}
                        src={src}
                        alt={t("hallsPage.photoAlt", {
                          hall: name,
                          n: index + 1,
                        })}
                        loading="lazy"
                        className="aspect-[4/3] h-44 shrink-0 snap-start border border-line bg-surface object-cover sm:h-56"
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}

        {halls.isSuccess && items.length > 0 && (
          // Dimensions carry the approximation disclaimer wherever they
          // appear, brand guidelines §4, same as the studio.
          <p className="mt-6 max-w-xl text-sm leading-relaxed text-ink-soft">
            {t("halls.disclaimer")}
          </p>
        )}
      </div>
    </main>
  );
}
