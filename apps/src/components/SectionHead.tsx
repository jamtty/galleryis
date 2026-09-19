import type { ReactNode } from "react";

/**
 * A section's heading on a hairline rule, insaartcenter's 현재 전시 /
 * 전체보기 → head: the title bold at the left, whatever the section offers
 * beside it at the right (a "view all" link, this week's dates), and one
 * rule under both, the full width of the section. The rule is the same grey
 * hairline the plain ruled h2s carry (전시 개요, 약력, 관람 안내), so no two
 * heads on a page are underlined at different weights.
 */
export default function SectionHead({
  title,
  children,
}: {
  title: string;
  /** Optional right-hand link or note. */
  children?: ReactNode;
}) {
  return (
    <header className="reveal mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-line pb-3 sm:mb-10">
      {/* Nothing else lives inside the h2: its accessible name is the
          section's name and only that. */}
      <h2 className="font-display text-title font-bold">{title}</h2>
      {children}
    </header>
  );
}
