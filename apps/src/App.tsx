import { fetchJson, pick, type NoticeSummary } from "@galleryis/shared";
import { useQuery } from "@tanstack/react-query";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import BackToTop from "./components/BackToTop";
import DefRow from "./components/DefRow";
import ErrorBoundary from "./components/ErrorBoundary";
import HallStudioRoute from "./components/HallStudioRoute";
import { ExhibitionList } from "./components/ExhibitionCard";
import NowShowing from "./components/NowShowing";
import Popup from "./components/Popup";
import Wordmark from "./components/Wordmark";
import SectionHead from "./components/SectionHead";
import { RowsSkeleton } from "./components/Skeleton";
import ShutdownGate from "./components/ShutdownGate";
import SocialLinks from "./components/SocialLinks";
import { useExhibitions } from "./lib/exhibition";
import ExhibitionPage from "./pages/Exhibition";
import ExhibitionsPage from "./pages/Exhibitions";
import GalleryIsPage from "./pages/GalleryIs";
import HallsPage from "./pages/Halls";
import NoticePage from "./pages/Notice";
import NoticesPage from "./pages/Notices";
import NotFound from "./pages/NotFound";
import PrivacyPage from "./pages/Privacy";
import RentalPage from "./pages/Rental";
import { BUTTON_OUTLINE_DARK, GUTTER, META, SCROLL_MT } from "./ui";

// The main site's front page, in insaartcenter.com's order (2026-08-25),
// the reference the gallery itself named (docs/STATUS_REPORT_2026-08-16.md
// §2): this week's show as a split hero, the current grid, the upcoming
// grid, and the notices, closing on the dark footer with the address. The
// three-column door row under the hero was cut the same day: the masthead's
// tabs already are those doors. The photographs lead and the chrome is
// monochrome so nothing competes with them.
//
// The routes share the shell: the front page, one page per show, the
// exhibitions tabs, the hall guide, the rental page, the notice board and
// its posts, and 갤러리 이즈 — 갤러리 소개 and 오시는 길 read down one page
// (`/about`) since 2026-08-28, the day 관람안내, the map and the directions
// left the front page the way 대관 left it on 08-24. Every masthead tab is a
// route; `/visit` forwards to the section it named, and the front page's
// remaining `#section` ids stay as anchor targets for old links.

function LanguageToggle() {
  const { i18n } = useTranslation();
  const next = i18n.language === "ko" ? "en" : "ko";
  return (
    <button
      type="button"
      // min-h for the touch target, nowrap because "한국어" otherwise breaks
      // mid-word when the phone-width masthead runs out of room.
      className="inline-flex min-h-11 items-center text-sm whitespace-nowrap text-ink-soft transition-colors hover:text-ink"
      onClick={() => void i18n.changeLanguage(next)}
    >
      {next === "en" ? "English" : "한국어"}
    </button>
  );
}

/**
 * The legacy site's tabs, in its own order (전시 · 갤러리 이즈 · 전시장 ·
 * 대관 · 소식). Each has a page of its own and points at it; the open page's
 * tab underlines itself and carries aria-current. 오시는 길 stopped being a
 * tab on 2026-08-28 — it reads down 갤러리 이즈's own page now, and the
 * address it kept lights the same masthead tab (`also`).
 */
const NAV: readonly {
  id: "exhibitions" | "about" | "halls" | "rental" | "notices";
  to: string;
  /** A second address that lights this tab: a tab of the page it opens. */
  also?: string;
}[] = [
  { id: "exhibitions", to: "/exhibitions" },
  { id: "about", to: "/about", also: "/visit" },
  { id: "halls", to: "/halls" },
  { id: "rental", to: "/rental" },
  { id: "notices", to: "/notices" },
];

/** Three lines closed, a cross open: the phone bar's one button. */
function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    >
      {open ? (
        <path d="M6 6l12 12M18 6L6 18" />
      ) : (
        <path d="M4 7h16M4 12h16M4 17h16" />
      )}
    </svg>
  );
}

function Masthead() {
  const { t } = useTranslation();
  const location = useLocation();
  const { pathname } = location;
  // The phone menu. From `lg` up the tabs are always inline and this state
  // is inert: the button and the scrim are lg:hidden, the nav lg:flex.
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  // Any navigation closes it: a tab tapped, the lockup, back pressed. Keyed
  // on the location, since the same tab tapped twice is two navigations.
  useEffect(() => {
    setOpen(false);
  }, [location.key]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      menuButton.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <>
      {/* Under the open menu the page dims and a tap anywhere on it closes
          the menu. A sibling of the header, not a child, so the scrim sits
          below the bar in the stacking order and never tints it. */}
      {open && (
        <div
          aria-hidden
          className="fixed inset-0 z-30 bg-ink/25 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      {/* insaartcenter's bar: white, 5rem tall, the wordmark at the left and
          the tabs bold at the right, one hairline under it. Solid, not
          frosted: the page under it is a run of photographs. Below `lg` it
          is one row of 4rem, the tabs folded behind the ≡ button: inline
          they need ~1000px, and between `md` and there the lockup wrapped
          mid-word and 오시는 길 ran into the language button. */}
      <header className="sticky top-0 z-40 border-b border-line bg-ground">
        <div
          className={`flex min-h-16 items-center justify-between gap-x-8 lg:min-h-20 ${GUTTER}`}
        >
          {/* The lockup is the way home, the web's oldest convention and the
              legacy site's own (logo.gif opens /). The gallery's wordmark and
              nothing else: the mark that used to lead it is gone until the new
              logo arrives, and the letters carry the name on their own.
              It scrolls the page to the top as it goes: the landing is the one
              page that does not do that on arrival — it lets the browser
              restore where a visitor was when they come back from a show — and
              pressed from the landing itself the navigation is same-path and
              would otherwise move nothing at all. */}
          <Link
            to="/"
            className="flex min-h-11 shrink-0 items-center"
            onClick={() => window.scrollTo({ top: 0 })}
          >
            <Wordmark className="h-4 text-ink sm:h-5" title={t("brand.name")} />
          </Link>
          {/* Primary navigation, bold at reading size, the insaartcenter
              bar's own weight. On a phone it is the panel the ≡ button
              drops under the bar: the five tabs stacked as full-width rows,
              scrolling inside itself if the screen is shorter than they are. */}
          <nav
            id="site-menu"
            aria-label={t("nav.label")}
            className={`${open ? "flex" : "hidden"} absolute inset-x-0 top-full max-h-[calc(100dvh-4rem)] flex-col divide-y divide-line overflow-y-auto border-b border-line bg-ground lg:static lg:flex lg:max-h-none lg:flex-row lg:items-center lg:gap-x-8 lg:divide-y-0 lg:overflow-visible lg:border-b-0`}
          >
            {NAV.map(({ id, to, also }) => {
              // /exhibitions/:id keeps the 전시 tab lit, and /notices/:id 소식;
              // /visit, a section of 갤러리 이즈, keeps 갤러리 이즈 lit.
              const active =
                pathname === to ||
                pathname === also ||
                pathname.startsWith(`${to}/`);
              return (
                <Link
                  key={id}
                  to={to}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-14 items-center px-5 text-lg font-bold text-ink transition-colors sm:px-8 lg:inline-flex lg:min-h-20 lg:shrink-0 lg:border-b-2 lg:px-0 lg:pt-0.5 ${
                    active
                      ? "bg-surface-hi lg:border-ink lg:bg-transparent"
                      : "lg:border-transparent lg:hover:border-ink/40"
                  }`}
                >
                  {t(`nav.${id}`)}
                </Link>
              );
            })}
          </nav>
          <div className="flex shrink-0 items-center gap-x-3">
            <LanguageToggle />
            {/* Icon only; the word is its accessible name. 44px square,
                the touch target, bleeding into the gutter so the icon
                itself sits on the page's right edge. */}
            <button
              type="button"
              ref={menuButton}
              aria-label={open ? t("nav.close") : t("nav.menu")}
              aria-expanded={open}
              aria-controls="site-menu"
              onClick={() => setOpen((value) => !value)}
              className="-mr-2.5 inline-flex h-11 w-11 items-center justify-center text-ink lg:hidden"
            >
              <MenuIcon open={open} />
            </button>
          </div>
        </div>
      </header>
    </>
  );
}

/**
 * This week's four shows as the grid. The hero shows them one at a time;
 * this is all four at once, one hall, one show, one column. Each card
 * carries its own dates, so the heading takes none.
 */
function ThisWeek({ query }: { query: ReturnType<typeof useExhibitions> }) {
  const { t } = useTranslation();
  return (
    <section
      id="exhibitions"
      className={`${SCROLL_MT} pt-14 pb-16 sm:pt-20 sm:pb-24 ${GUTTER}`}
    >
      <SectionHead title={t("nowShowing")}>
        <Link
          to="/exhibitions"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium"
        >
          {t("viewAll")}
          <span aria-hidden>→</span>
        </Link>
      </SectionHead>
      <ExhibitionList query={query} />
    </section>
  );
}

function Upcoming() {
  const { t } = useTranslation();
  const query = useExhibitions("upcoming");
  return (
    <section className={`pb-16 sm:pb-24 ${GUTTER}`}>
      <SectionHead title={t("upcoming")}>
        <Link
          to="/exhibitions?status=upcoming"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium"
        >
          {t("viewAll")}
          <span aria-hidden>→</span>
        </Link>
      </SectionHead>
      <ExhibitionList query={query} emptyText={t("noUpcoming")} />
    </section>
  );
}

function NoticeSection() {
  const { t, i18n } = useTranslation();
  const notices = useQuery({
    queryKey: ["notices"],
    queryFn: () => fetchJson<NoticeSummary[]>("/api/notices"),
  });
  const items = notices.data ?? [];
  return (
    <section
      id="notices"
      className={`${SCROLL_MT} pt-4 pb-16 sm:pb-24 ${GUTTER}`}
    >
      <SectionHead title={t("notices")}>
        <Link
          to="/notices"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium"
        >
          {t("viewAll")}
          <span aria-hidden>→</span>
        </Link>
      </SectionHead>
      {notices.isPending && <RowsSkeleton count={4} />}
      {notices.isError && (
        <p className="text-base text-accent-ink">{t("loadError")}</p>
      )}
      {notices.isSuccess &&
        (items.length === 0 ? (
          <p className="text-base text-ink-soft">{t("noNotices")}</p>
        ) : (
          // The legacy board's shape: title, date, one per rule. Every row
          // opens the notice's own page.
          <ul className="reveal">
            {items.slice(0, 4).map((notice) => (
              <li key={notice.id}>
                <Link
                  to={`/notices/${notice.id}`}
                  className="group flex flex-wrap items-baseline gap-x-5 gap-y-1 border-b border-line py-4"
                >
                  {notice.pinned && (
                    <span className="shrink-0 text-sm font-bold">
                      {t("pinnedBadge")}
                    </span>
                  )}
                  <span className="flex-1 text-base decoration-1 underline-offset-4 group-hover:underline">
                    {pick(notice, "title", i18n.language)}
                  </span>
                  <span className={`shrink-0 ${META} text-ink-soft`}>
                    {notice.published_at}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}

function Footer() {
  const { t } = useTranslation();
  return (
    // insaartcenter's footer: ink ground, the wordmark in white, the
    // gallery's facts in one run of bold labels, the channels at the right.
    <footer className={`bg-ink pt-12 pb-10 text-ground ${GUTTER}`}>
      <div className="flex flex-col items-start gap-8 sm:flex-row sm:items-center sm:justify-between">
        {/* The same letters as the masthead, taking the footer's tone: one
            `currentColor` path, so going white here costs no second asset. */}
        <Wordmark className="h-5 sm:h-6" title={t("brand.name")} />
        <SocialLinks tone="dark" />
      </div>
      {/* The legacy footer's own facts. On galleryis.com they live inside a
          single GIF, which means they are unreadable to a screen reader, unset
          at any other size, and untranslatable, so the one thing worth
          carrying across is the content, not the picture of it. */}
      <dl className="mt-10 flex flex-col gap-x-8 gap-y-2 text-ground-soft sm:flex-row sm:flex-wrap">
        {/* 관람시간 leads: it is what someone reads the footer for, and the
            legacy GIF never carried it at all. Days and clock and nothing
            else, set like the numbers beside it; the Tuesday changeover and
            the rest of the 관람안내 facts are 갤러리 소개's to tell. */}
        <DefRow compact label={t("footer.hoursLabel")}>
          <span className="tabular-nums">{t("footer.hours")}</span>
        </DefRow>
        <DefRow compact label={t("footer.addressLabel")}>
          {t("visit.address")}
        </DefRow>
        <DefRow compact label={t("footer.telLabel")}>
          <span className="tabular-nums">{t("visit.tel")}</span>
        </DefRow>
        <DefRow compact label={t("footer.faxLabel")}>
          <span className="tabular-nums">{t("visit.fax")}</span>
        </DefRow>
        <DefRow compact label={t("footer.emailLabel")}>
          <a
            href={`mailto:${t("visit.email")}`}
            className="underline decoration-ground-soft underline-offset-4 transition-colors hover:text-ground"
          >
            {t("visit.email")}
          </a>
        </DefRow>
      </dl>
      {/* The way to the map and the directions. The footer is where a first
          visit looks for the address, and the address alone does not say
          which tab (갤러리 이즈) the directions are under. */}
      <Link to="/about#visit" className={`mt-8 ${BUTTON_OUTLINE_DARK}`}>
        {t("visit.title")}
        <span aria-hidden>→</span>
      </Link>
      {/* The bottom-right corner stays empty: the floating ↑ lives there. */}
      <div className="mt-8 flex flex-col gap-1 border-t border-ground/20 pt-6 pr-20">
        {/* 개인정보처리방침 on every page, in bold and in full white against
            the muted lines around it: the way Korean sites set it, and what
            the 개인정보보호위원회's guidance asks, that it stand apart from
            the notices beside it. */}
        <Link
          to="/privacy"
          className="inline-flex min-h-11 items-center self-start text-sm font-bold text-ground underline-offset-4 hover:underline"
        >
          {t("privacyPage.title")}
        </Link>
        <p className={`${META} text-ground-soft`}>{t("footer.copyright")}</p>
        {/* Maker's mark, quiet by design, see docs/brand-guidelines.md §7. */}
        <a
          href="https://moonai.co.kr"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex min-h-11 items-center gap-2 self-start text-sm text-ground-soft transition-colors hover:text-ground"
        >
          <img
            src="/moonai.png"
            alt=""
            className="h-4 w-4 rounded object-cover opacity-80"
          />
          {t("brand.builtBy")}
        </a>
      </div>
    </footer>
  );
}

/**
 * The front page. Its sections are the masthead's anchors; arriving here with
 * a hash, from a tab on a show's page, or a tab clicked on this page, which
 * the router turns into a pushState rather than the browser's own jump,
 * scrolls to that section. Keyed on the location, not the hash, so the same
 * tab clicked twice jumps twice.
 */
function Home() {
  const location = useLocation();
  const navigate = useNavigate();
  const current = useExhibitions("current");  useEffect(() => {
    if (!location.hash) return;
    // Two sections have left this page for pages of their own: the rental
    // grid on 2026-08-24 and 오시는 길 on 08-28. The deployed studio still
    // says `/?hall=X#rental` and `/#visit`, and so does every link anyone
    // has kept. Honour the old addresses by forwarding them, query string
    // and all.
    const moved: Record<string, string> = {
      "#rental": "/rental",
      "#visit": "/about#visit",
    };
    const to = moved[location.hash];
    if (to) {
      // 대관's deep link carries `?hall=`; 오시는 길's target is a hash.
      navigate(to.includes("#") ? to : `${to}${location.search}`, {
        replace: true,
      });
      return;
    }
    document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, [location.key, location.hash, location.search, navigate]);
  return (
    <main>
      <NowShowing query={current} />
      <ThisWeek query={current} />
      <Upcoming />
      <NoticeSection />
      {/* The gallery's announcement over the page, as galleryis.com opens one.
          Here and nowhere else: someone following a link to a show or to 대관
          has come for that page, and arrives at it with nothing in the way. */}
      <Popup />
    </main>
  );
}

/** 예전 대관 신청서 주소 → 대관 페이지로 (전시장 선택은 그대로 들려 보냅니다). */
function LegacyRentalApply() {
  const { search } = useLocation();
  return <Navigate to={`/rental${search}`} replace />;
}

// 관리자 화면은 따로 실어 둡니다 — 관리자 CSS(약 80KB)가 공개 사이트 번들에
// 들어가지 않고, 관리자 청크가 실행되는 순간 스타일이 붙어 첫 화면부터
// 제대로 그려집니다. (F5 때 로고가 크게 보였다 작아지던 깜빡임의 원인)
const AdminApp = lazy(() => import("./AdminApp"));

/** 관리자 묶음을 받는 동안의 화면 — CSS 없이도 어색하지 않게 인라인 스타일로.
 *  (관리자 CSS 의 글꼴 크기 기준은 rem 이라, rem 을 쓰면 기준이 바뀔 때 흔들립니다) */
function AdminBoot() {
  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        minHeight: "100dvh",
        font: "500 14px/1.6 Pretendard, dotum, sans-serif",
        color: "#6b7280",
      }}
    >
      관리자 화면을 여는 중입니다…
    </div>
  );
}

export default function App() {
  const { pathname } = useLocation();
  // 관리자 화면은 공개 사이트의 헤더·푸터와 다른 스타일시트를 씁니다.
  // (원래 구조를 그대로 두기 위해 라우트를 섞지 않고 여기서 갈라 줍니다)
  if (pathname.startsWith("/admin")) {
    return (
      <Suspense fallback={<AdminBoot />}>
        <AdminApp />
      </Suspense>
    );
  }

  // 3D 둘러보기는 원본처럼 **한 화면 전체**를 씁니다 — 자체 하단 바(이름·규격·
  // 도면·대관 신청)를 들고 있어서 사이트 머리글·바닥글 안에 넣지 않습니다.
  if (/^\/halls\/[^/]+\/studio/.test(pathname)) return <HallStudioRoute />;

  return (
    // The boundary sits outside even the gate: a crash anywhere below is
    // caught and answered with a written screen in the visitor's language,
    // never a blank page (§6 error-handling baseline).
    <ErrorBoundary>
      {/* When the gallery throws the emergency switch, the curtain replaces
          the page rather than sitting on top of it. */}
      <ShutdownGate>
        <div className="min-h-screen bg-ground text-ink">
          {/* One measure for the whole page: masthead, sections and footer
              share the same gutters, so the wordmark sits directly above the
              headline. */}
          <div className="mx-auto max-w-[110rem]">
            <Masthead />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/exhibitions" element={<ExhibitionsPage />} />
              <Route path="/exhibitions/:id" element={<ExhibitionPage />} />
              <Route path="/halls" element={<HallsPage />} />
              {/* 전시장 3D 둘러보기 — 우리 방식(규모 + 사진)으로 만든 화면 */}
              <Route path="/halls/:key/studio" element={<HallStudioRoute />} />
              <Route path="/rental" element={<RentalPage />} />
              {/* 대관 신청서가 /rental 안으로 들어오기 전의 주소입니다.
                  (?hall= 을 그대로 들려 보냅니다) */}
              <Route path="/rental/apply" element={<LegacyRentalApply />} />
              <Route path="/about" element={<GalleryIsPage />} />
              {/* 오시는 길 reads down the same page since 2026-08-28; its own
                  address keeps working and lands on the section. */}
              <Route
                path="/visit"
                element={<Navigate to="/about#visit" replace />}
              />
              <Route path="/notices" element={<NoticesPage />} />
              <Route path="/notices/:id" element={<NoticePage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <Footer />
          </div>
          <BackToTop />
        </div>
      </ShutdownGate>
    </ErrorBoundary>
  );
}
