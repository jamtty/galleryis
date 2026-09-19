import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import { ExhibitionList } from "../components/ExhibitionCard";
import PageHead from "../components/PageHead";
import { useExhibitions } from "../lib/exhibition";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { GUTTER, TAB_ACTIVE, TAB_IDLE } from "../ui";

// The exhibitions page, insaartcenter's 전시: the page's name centred, the
// three boards as centred word tabs under it (현재 · 예정 · 과거), and the
// grid. The third tab is the archive the origin itself cannot show: it keeps
// no past board, so this is our mirror's own accumulating record.
//
// The tab lives in the URL (?status=) so a tab can be linked, shared and
// back-buttoned; the front page's strips link straight into it.

const TABS = ["current", "upcoming", "past"] as const;
type Tab = (typeof TABS)[number];

function tabFrom(params: URLSearchParams): Tab {
  const asked = params.get("status");
  return (TABS as readonly string[]).includes(asked ?? "")
    ? (asked as Tab)
    : "current";
}

export default function ExhibitionsPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const tab = tabFrom(params);
  const query = useExhibitions(tab);
  useDocumentTitle(t("nav.exhibitions"), t("brand.name"));

  // 빈 목록일 때만 문구를 가운데(가로·세로)로 — 카드가 있으면 늘 그렇듯 위에서
  // 부터 좌측 정렬로 흐릅니다.
  const empty =
    !query.isPending && !query.isError && (query.data?.length ?? 0) === 0;

  // A client-side navigation keeps the scroll position of the page it left,
  // which is not where a page starts. Once: switching tabs stays put.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  return (
    <main>
      <PageHead
        title={t("nav.exhibitions")}
        tabs={
          // Word tabs, not pills: the underline is the active mark and
          // aria-current carries it for a screen reader. Links rather than
          // buttons so the chosen tab survives sharing and the back button.
          <nav
            aria-label={t("exhibitionsPage.tabsLabel")}
            className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2"
          >
            {TABS.map((status) => (
              <Link
                key={status}
                to={
                  status === "current"
                    ? "/exhibitions"
                    : `/exhibitions?status=${status}`
                }
                aria-current={tab === status ? "page" : undefined}
                className={tab === status ? TAB_ACTIVE : TAB_IDLE}
              >
                {t(`exhibitionsPage.${status}`)}
              </Link>
            ))}
          </nav>
        }
      />
      <div
        className={`min-h-[24rem] py-12 sm:py-16 ${GUTTER}${
          empty ? " flex flex-col justify-center" : ""
        }`}
      >
        {/* The cards are h3s (they share markup with the front page, where an
            h2 section head sits above them); this names the level between. */}
        <h2 className="sr-only">{t(`exhibitionsPage.${tab}`)}</h2>
        <ExhibitionList
          query={query}
          centerEmpty
          emptyText={tab === "past" ? t("exhibitionsPage.noPast") : undefined}
        />
      </div>
    </main>
  );
}
