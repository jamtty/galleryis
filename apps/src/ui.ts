// The page's shared class recipes.
//
// One definition each, imported. v4 (2026-08-25) retunes every recipe to
// insaartcenter.com's language: one sans family, bold headings, black
// hairline rules, white pill buttons, and hover that goes to ink rather than
// to a second colour.

/** One gutter for the whole page: demo strip, masthead, every section, footer. */
export const GUTTER = "px-5 sm:px-8 lg:px-14";

/**
 * Anchor landing offset. The masthead is one row: 5rem from `lg` up, 4rem
 * below it, where the tabs sit behind the menu button.
 */
export const SCROLL_MT = "scroll-mt-20 lg:scroll-mt-24";

/** The quiet link language: hairline underline, ink on hover. */
export const LINK =
  "underline decoration-line-lit underline-offset-4 transition-colors hover:text-ink hover:decoration-ink";

/**
 * The label voice, 주소, 전화, the eyebrow over a form, a column head.
 * Plain sans at the 14px floor, muted; no tracking, no uppercase, the
 * insaartcenter page has neither.
 */
export const LABEL = "text-sm text-ink-soft";

/** The metadata voice, dates, dimensions, prices, counts. Pretendard digits, tabular. */
export const META = "text-sm tabular-nums";

const BUTTON_CORE =
  "group inline-flex min-h-11 items-center justify-center gap-2 rounded-full text-sm font-medium transition-colors";
const BUTTON_BASE = `${BUTTON_CORE} px-6`;

/** The primary action. One per view. */
export const BUTTON_FILLED = `${BUTTON_BASE} bg-ink text-ground hover:bg-ink/80`;

/** insaartcenter's pill: white, one ink hairline, fills on hover. */
const OUTLINE_SKIN =
  "border border-ink bg-surface text-ink hover:bg-ink hover:text-ground";
export const BUTTON_OUTLINE = `${BUTTON_BASE} ${OUTLINE_SKIN}`;

/**
 * The outline pill with a narrower waist on a phone — for a row of pills that
 * has to stay one row, where 24px of gutter on each of three buttons is the
 * difference between fitting a 360px screen and wrapping (VisitMap's map-app
 * links). The padding is a separate word rather than a `px-4` written over
 * `px-6`: with no tailwind-merge here, two conflicting utilities in one class
 * list are settled by the stylesheet's order, not the attribute's.
 */
export const BUTTON_OUTLINE_TIGHT = `${BUTTON_CORE} px-4 sm:px-6 ${OUTLINE_SKIN}`;

/** The same pill on the footer's ink ground: the social rings' dark tone. */
export const BUTTON_OUTLINE_DARK = `${BUTTON_BASE} border border-ground-soft text-ground hover:border-ground hover:bg-ground hover:text-ink`;

/**
 * A word tab in a centred row (현재 · 예정 · 과거). Active carries a 2px ink
 * underline and full ink; the rest are muted and darken on hover.
 */
export const TAB_BASE =
  "inline-flex min-h-11 items-center border-b-2 px-1 text-base font-medium transition-colors";
export const TAB_ACTIVE = `${TAB_BASE} border-ink text-ink`;
export const TAB_IDLE = `${TAB_BASE} border-transparent text-ink-soft hover:text-ink`;

/**
 * A filter chip (전체 · 1F · 2F …): a small bordered square, filled when on.
 */
export const CHIP_BASE =
  "inline-flex min-h-11 items-center rounded-sm border px-4 text-sm transition-colors";
export const CHIP_ON = `${CHIP_BASE} border-ink bg-ink text-ground`;
export const CHIP_OFF = `${CHIP_BASE} border-line-lit bg-surface text-ink hover:border-ink`;

/**
 * A spec table, insaartcenter's 대관 tables: grey label field at the left,
 * the fact beside it, one hairline per row.
 *
 * The dt/dd pairs are the grid's own children — no row wrapper — so every
 * label shares one column and the grey edge runs straight down whatever the
 * words are. Per-row flex boxes cannot: each sizes itself, which left the
 * column ragged between 위치 and 평수기, and worse in English. The column is
 * as wide as its widest label, floored at the 8rem the Korean table has
 * always been — 6rem on a phone, where the width is worth more to the fact
 * than to the field around a two-syllable word.
 */
export const TABLE =
  "grid grid-cols-[minmax(6rem,max-content)_1fr] border-t border-ink sm:grid-cols-[minmax(8rem,max-content)_1fr]";
/**
 * The label cell: grey field, bold ink, the word in the middle of it both
 * ways, so a row whose value wraps to two lines keeps its label centred.
 */
export const TABLE_LABEL =
  "flex items-center justify-center border-b border-line bg-surface-hi px-4 py-3 text-center text-sm font-bold sm:px-5";
export const TABLE_VALUE = "border-b border-line px-4 py-3 text-base sm:px-5";
