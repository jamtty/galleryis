import {
  fetchJson,
  type AvailabilityResponse,
  type AvailabilityWeek,
  type BookingStatus,
} from "@galleryis/shared";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { hallNameKey } from "../lib/exhibition";
import { GUTTER, LINK, META, SCROLL_MT } from "../ui";
import ApplicationForm from "./ApplicationForm";
import SectionHead from "./SectionHead";
import { GridSkeleton } from "./Skeleton";

// The rental page's body, insaartcenter's 대관절차 then its 대관신청: the
// gallery's four steps as numbered boxes, and under them the grid rebuilt
// from the gallery's own (galleryis.com/sub032.php): weeks down the side, the
// four halls across, every cell one of 대관완료 / 심사중 / 신청가능. Picking
// a free cell opens the application.
//
// Availability is derived server-side and never stored, so the grid is always
// the truth about the bookings behind it, and a lost race comes back as a 409
// the UI surfaces before re-fetching, rather than a silent overwrite (§6).

const HALL_IDS = ["hall1", "hall2", "hall3", "hall4"] as const;
/** How much of the calendar a page of the grid shows. */
const WEEKS_PER_PAGE = 12;

// Only "available" is actionable, so only it carries weight. The three are told
// apart by border *style* as well as fill: the page is monochrome, and status
// must never rest on colour alone.
//
// `approved` and `reserved` share one tone so the two cannot drift into two
// looks for the one word they now both carry. Doubled and sunk into a deeper
// grey; the fill is dark enough that ink-soft would fall under AA, so the word
// goes back to full ink.
const TAKEN = "border-double border-line-lit bg-ink/30 text-ink";

const UNDER_REVIEW = "border-dashed border-ink-soft/50 bg-ground text-ink-soft";

const CELL_TONE: Record<BookingStatus, string> = {
  available:
    "border-solid border-line-lit bg-surface text-ink hover:border-ink hover:bg-ink hover:text-ground",
  pending: UNDER_REVIEW,
  approved: TAKEN,
  // A booking on the legacy galleryis.com order board. The wire tells it from
  // `approved` because the desk must know which weeks it can act on; this page
  // does not, so it wears the same word and the same tone. Nothing on the
  // public grid should ask a visitor to care which system holds the week.
  reserved: TAKEN,
  // An application waiting on the legacy board: our own 심사중, for the same
  // reason.
  reserved_pending: UNDER_REVIEW,
};

const STATUSES = ["available", "pending", "approved"] as const;

/**
 * The calendar's far edge: 12월 31일 of *next* year.
 *
 * A visitor in 2026 can look through 2027-12-31, one in 2027 through
 * 2028-12-31 — far enough ahead for a show still being planned, and no
 * further: 다음 used to page forever, into years the gallery has not
 * scheduled and cannot answer for.
 */
function horizon(today: Date): Date {
  return new Date(today.getFullYear() + 1, 11, 31);
}

/** The local calendar date, not the UTC one: `toISOString` names yesterday
 *  before 09:00 in KST, and would turn the horizon's own 12월 31일 into
 *  12월 30일. */
function iso(day: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

/** One page of the grid, clipped to the horizon — the page that reaches it is
 *  short by however much of it falls past 12월 31일, and is the last. */
function pageRange(pageIndex: number): {
  from: string;
  to: string;
  /** True on the page that reaches the edge: nothing left to page to. */
  last: boolean;
  /** The edge itself, for the line that says where the grid stops. */
  edge: string;
} {
  const start = new Date();
  const edge = horizon(start);
  start.setDate(start.getDate() + pageIndex * WEEKS_PER_PAGE * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + WEEKS_PER_PAGE * 7 - 1);
  const last = end >= edge;
  return {
    from: iso(start),
    to: iso(last ? edge : end),
    last,
    edge: iso(edge),
  };
}

/** "2026.08.05, 08.11", the period as the gallery writes it. */
function periodLabel(week: AvailabilityWeek): string {
  const [, sm, sd] = week.start.split("-");
  const [ey, em, ed] = week.end.split("-");
  const [sy] = week.start.split("-");
  return sy === ey
    ? `${sy}.${sm}.${sd} ~ ${em}.${ed}`
    : `${sy}.${sm}.${sd} ~ ${ey}.${em}.${ed}`;
}

/**
 * The hall the visitor arrived for, from `/rental?hall=hall3`.
 *
 * The studio links in with it: someone who has just walked 제3전시장 in 3D
 * and tapped 대관 신청 should not have to find that column again on a grid
 * of four. Read once, at mount, it is where they came from, not a control.
 */
function hallFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const asked = new URLSearchParams(window.location.search).get("hall");
  return asked && (HALL_IDS as readonly string[]).includes(asked)
    ? asked
    : null;
}

/**
 * 신청서를 열어 달라고 넘어온 전시장·주 (`/rental?hall=hall3&week=2026-10-07`).
 *
 * 관리자 대관 일정에서 "대관신청"을 누르면 이 모양으로 넘어옵니다. 사장님은 빈
 * 칸을 보고 눌렀으니, 같은 칸을 다시 찾아 누르게 하지 않고 신청서를 바로 엽니다.
 */
function applyFromUrl(): { hallId: string; weekStart: string } | null {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const hall = params.get("hall");
  const week = params.get("week");

  if (!hall || !week) return null;
  if (!(HALL_IDS as readonly string[]).includes(hall)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return null;

  return { hallId: hall, weekStart: week };
}

/** 그 주가 들어 있는 표 페이지 (표는 오늘부터 12주씩 끊습니다). */
function pageForWeek(weekStart: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(`${weekStart}T00:00:00`);
  if (Number.isNaN(start.getTime())) return 0;

  const weeks = Math.floor(
    (start.getTime() - today.getTime()) /
      86_400_000 /
      (WEEKS_PER_PAGE * 7),
  );

  return Math.max(0, weeks);
}

export default function Rental() {
  const { t } = useTranslation();
  // 관리자 대관 일정에서 넘어온 경우: 그 주가 있는 페이지부터 열고, 자료가 오면 신청서를 엽니다.
  const [wanted] = useState(applyFromUrl);
  const [page, setPage] = useState(() =>
    wanted ? pageForWeek(wanted.weekStart) : 0,
  );
  const [arrivedFor] = useState(hallFromUrl);
  const [picked, setPicked] = useState<{
    hallId: string;
    week: AvailabilityWeek;
  } | null>(null);
  const [applied, setApplied] = useState<string | null>(null);
  /** 넘어온 주의 신청서를 이미 열어 봤는지 (닫은 뒤에 다시 열지 않게) */
  const [opened, setOpened] = useState(false);

  const range = pageRange(page);
  const availability = useQuery({
    queryKey: ["availability", range.from, range.to],
    queryFn: () =>
      fetchJson<AvailabilityResponse>(
        `/api/availability?from=${range.from}&to=${range.to}`,
      ),
  });
  const weeks = availability.data?.weeks ?? [];

  // 넘어온 주의 신청서를 한 번 열어 줍니다.
  // (effect 에서 setState 하면 oxlint react(set-state-in-effect) 경고가 나서 렌더 중에 맞춥니다)
  if (!opened && wanted && weeks.length > 0) {
    const week = weeks.find((item) => item.start === wanted.weekStart);

    if (week) {
      setOpened(true);

      // 그사이 다른 분이 가져갔을 수 있습니다 — 빈 칸일 때만 엽니다.
      if ((week.halls[wanted.hallId] ?? "available") === "available") {
        setPicked({ hallId: wanted.hallId, week });
      }
    }
  }

  /** 넘어온 주의 신청서가 열리면 그 자리로 옮겨 줍니다. (표 아래라 안 보이면 안 열린 것처럼 보입니다) */
  const applyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!opened || !wanted) return;

    applyRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [opened, wanted]);

  return (
    // Its own page since 2026-08-24: the studio's hall cards and the halls
    // page link in as /rental?hall=X; the old /?hall=X#rental still forwards.
    <section id="rental" className={`${SCROLL_MT} py-12 sm:py-16 ${GUTTER}`}>
      {/* The gallery's own terms, in its own order, as insaartcenter boxes
          its 대관절차: these four *are* a sequence, the week, the review,
          the contract, the install, so the numerals stay. */}
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(["unit", "review", "contract", "install"] as const).map((step, i) => (
          <li key={step} className="border border-ink px-6 py-7 sm:px-7">
            <p className="font-display text-2xl font-bold tabular-nums">
              {String(i + 1).padStart(2, "0")}
            </p>
            <h3 className="mt-6 text-lg font-bold">
              {t(`rental.stepTitles.${step}`)}
            </h3>
            <p className="mt-2 text-base leading-relaxed text-ink-soft">
              {t(`rental.steps.${step}`)}
            </p>
          </li>
        ))}
      </ol>

      <div className="mt-16 sm:mt-20">
        <SectionHead title={t("rental.heading")} />
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-soft">
          {STATUSES.map((status) => (
            <li key={status} className="flex items-center gap-2">
              <span
                aria-hidden
                className={`inline-block h-3 w-3 rounded-sm border ${CELL_TONE[status]}`}
              />
              {t(`rental.status.${status}`)}
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className={`min-h-11 px-2 text-ink-soft ${LINK} disabled:cursor-not-allowed disabled:opacity-40`}
          >
            ← {t("rental.earlier")}
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={range.last}
            className={`min-h-11 px-2 text-ink-soft ${LINK} disabled:cursor-not-allowed disabled:opacity-40`}
          >
            {t("rental.later")} →
          </button>
        </div>
      </div>

      {availability.isPending && <GridSkeleton />}
      {availability.isError && (
        <p className="text-base text-accent-ink">{t("loadError")}</p>
      )}

      {availability.isSuccess && weeks.length > 0 && (
        // The grid is wide on a phone; let it scroll in its own track rather
        // than pushing the page sideways. The period column stays pinned while
        // the halls scroll under it, a cell without its week is meaningless.
        // border-separate, not collapse: collapsed borders stay put when a
        // sticky cell moves, and the pinned column would shed its rules.
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] border-separate border-spacing-0 text-sm">
            <caption className="sr-only">{t("rental.heading")}</caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-10 border-y border-line bg-ground py-3 pr-4 text-left text-sm font-bold"
                >
                  {t("rental.period")}
                </th>
                {HALL_IDS.map((hall) => (
                  <th
                    scope="col"
                    key={hall}
                    aria-current={hall === arrivedFor ? "true" : undefined}
                    className={`border-y border-t-line px-1.5 py-3 text-sm ${
                      hall === arrivedFor
                        ? "border-b-2 border-b-ink font-bold text-ink"
                        : "border-b-line font-bold text-ink"
                    }`}
                  >
                    {t(`halls.${hall}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week) => (
                <tr key={week.start}>
                  <th
                    scope="row"
                    className={`sticky left-0 z-10 border-b border-line bg-ground py-2 pr-4 text-left ${META} font-normal text-ink-soft`}
                  >
                    {periodLabel(week)}
                  </th>
                  {HALL_IDS.map((hall) => {
                    const status = week.halls[hall] ?? "available";
                    const free = status === "available";
                    const selected =
                      picked?.hallId === hall &&
                      picked.week.start === week.start;
                    return (
                      <td
                        key={hall}
                        className="border-b border-line px-1.5 py-1.5 text-center"
                      >
                        <button
                          type="button"
                          disabled={!free}
                          aria-pressed={selected}
                          onClick={() => {
                            setApplied(null);
                            setPicked({ hallId: hall, week });
                          }}
                          className={`min-h-11 w-full rounded-sm border px-2 py-2 text-sm transition-colors ${CELL_TONE[status]} ${
                            free ? "cursor-pointer" : "cursor-not-allowed"
                          } ${selected ? "border-ink bg-ink text-ground" : ""}`}
                        >
                          {t(`rental.status.${status}`)}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {availability.isSuccess && weeks.length > 0 && (
        // The table is min-w-[34rem] inside px-5 gutters, so below ~37rem of
        // viewport it overflows its track, only there does the hint earn its
        // line. Halls 3 and 4 are off-screen on a phone and nothing else says
        // so.
        <p className="mt-3 text-sm text-ink-soft min-[37rem]:hidden">
          {t("rental.scrollHint")}
        </p>
      )}

      {range.last && (
        // The grid has run out, and a blank 다음 button explains nothing.
        // Say where it stops, in the date itself.
        <p className="mt-3 text-sm text-ink-soft">
          {t("rental.capped", { year: range.edge.slice(0, 4) })}
        </p>
      )}
      <div role="status">
        {applied && (
          <p className="mt-8 animate-rise border-l-2 border-ink bg-surface-hi p-5 text-base leading-relaxed">
            {t("rental.received", { what: applied })}
          </p>
        )}
      </div>

      {picked && (
        <div ref={applyRef} className={SCROLL_MT}>
          <ApplicationForm
            hallId={picked.hallId}
            week={picked.week}
            onCancel={() => setPicked(null)}
            onDone={() => {
              setApplied(
                `${t(hallNameKey(picked.hallId))} · ${periodLabel(picked.week)}`,
              );
              setPicked(null);
            }}
          />
        </div>
      )}
    </section>
  );
}
