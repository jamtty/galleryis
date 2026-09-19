import type { ReactNode } from "react";

/**
 * One label/value pair on a hairline rule, 전시기간 · 2026.08.19 - 08.25.
 *
 * insaartcenter's detail table: the label bold in ink, the value beside it,
 * a hairline between rows. The `compact` variant is the footer's, where the
 * pairs sit on a dark ground without rules.
 */
export default function DefRow({
  label,
  compact = false,
  children,
}: {
  label: string;
  /** Footer sizing: narrower label column, no dividing rule, inherits colour. */
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={
        compact
          ? "flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-4"
          : "flex flex-col gap-1 border-b border-line py-4 sm:flex-row sm:gap-8"
      }
    >
      {/* The nudge lifts a text-sm label against a text-base value; the
          compact row sets both at text-sm and sits them on one baseline
          instead, so the label is not pushed 2px below its own value. */}
      <dt
        className={`text-sm font-bold sm:shrink-0 ${
          compact ? "" : "sm:w-32 sm:pt-0.5"
        }`}
      >
        {label}
      </dt>
      <dd className={compact ? "text-sm" : "text-base"}>{children}</dd>
    </div>
  );
}
