import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import { ExhibitionList } from "../components/ExhibitionCard";
import PageHead from "../components/PageHead";
import { useExhibitionSearch, useExhibitions } from "../lib/exhibition";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { GUTTER, TAB_ACTIVE, TAB_IDLE } from "../ui";

// The exhibitions page, insaartcenter's 전시: the page's name centred, the
// three boards as centred word tabs under it (현재 · 예정 · 과거), and the
// grid. The third tab is the archive the origin itself cannot show: it keeps
// no past board, so this is our mirror's own accumulating record.
//
// The tab lives in the URL (?status=) so a tab can be linked, shared and
// back-buttoned; the front page's strips link straight into it. The header's
// search lands here too (`?keyword=`, 2026-10-02) — one grid, one card, and a
// result is a listing like any other.

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
  // 헤더 검색이 들어오는 자리 (2026-10-02): `/exhibitions?keyword=…`.
  const keyword = (params.get("keyword") ?? "").trim();
  const searching = keyword !== "";
  // 두 질의를 늘 부릅니다 (훅은 조건부로 못 부릅니다) — 검색어가 없으면 검색
  // 질의는 `enabled: false` 라 요청도 나가지 않습니다.
  const tabQuery = useExhibitions(tab);
  const searchQuery = useExhibitionSearch(keyword);
  const query = searching ? searchQuery : tabQuery;
  const heading = t("search.resultFor", { keyword });
  useDocumentTitle(searching ? heading : t("nav.exhibitions"), t("brand.name"));

  // 빈 목록일 때만 문구를 가운데(가로·세로)로 — 카드가 있으면 늘 그렇듯 위에서
  // 부터 좌측 정렬로 흐릅니다.
  const empty =
    !query.isPending && !query.isError && (query.data?.length ?? 0) === 0;

  // A client-side navigation keeps the scroll position of the page it left,
  // which is not where a page starts. Once: switching tabs stays put, and a new
  // search word brings the grid back to the top of the list.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [keyword]);

  return (
    <main>
      <PageHead
        title={t("nav.exhibitions")}
        tabs={
          searching ? (
            // 검색 중에는 분류 탭 대신 돌아가는 한 줄입니다 — 검색은 현재·예정·
            // 지난을 한 번에 훑기 때문에 어느 탭도 켜져 있지 않습니다.
            <Link to="/exhibitions" className={TAB_IDLE}>
              {t("search.all")}
            </Link>
          ) : (
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
          )
        }
      />
      <div
        className={`min-h-[24rem] py-12 sm:py-16 ${GUTTER}${
          empty ? " flex flex-col justify-center" : ""
        }`}
      >
        {/* The cards are h3s (they share markup with the front page, where an
            h2 section head sits above them); this names the level between —
            검색에서는 검색어가 그 이름입니다. */}
        <h2 className="sr-only">
          {searching ? heading : t(`exhibitionsPage.${tab}`)}
        </h2>
        {searching && (
          <p className="mb-8 text-center text-base text-ink-soft">{heading}</p>
        )}
        <ExhibitionList
          query={query}
          centerEmpty
          emptyText={
            searching
              ? t("search.empty")
              : tab === "past"
                ? t("exhibitionsPage.noPast")
                : undefined
          }
        />
      </div>
    </main>
  );
}
