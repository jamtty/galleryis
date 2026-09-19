import type { ReactNode } from "react";
import { GUTTER } from "../ui";

/**
 * A sub-page's opening, insaartcenter's: the page's name centred and set
 * light at headline size, an optional row of centred word tabs under it, and
 * one hairline the full width of the page closing the block. The tabs are
 * the caller's (links or buttons), styled with TAB_ACTIVE / TAB_IDLE.
 */
export default function PageHead({
  title,
  tabs,
  lede,
  kicker = false,
}: {
  title: string;
  /** A centred tab row: a <nav> of links, or a <div> of chips. */
  tabs?: ReactNode;
  /** One line under the title, for pages without tabs. */
  lede?: string;
  /**
   * On a detail page the h1 is the show or the notice itself; the page's
   * name above it is then a plain line, not a second h1.
   */
  kicker?: boolean;
}) {
  return (
    <div className="border-b border-line">
      <div className={`pt-12 text-center sm:pt-16 ${GUTTER}`}>
        {kicker ? (
          <p className="font-display text-headline font-normal">{title}</p>
        ) : (
          <h1 className="font-display text-headline font-normal">{title}</h1>
        )}
        {lede && (
          <p className="mx-auto mt-4 max-w-2xl text-base text-ink-soft">
            {lede}
          </p>
        )}
        <div
          className={
            tabs ? "mt-8 flex justify-center sm:mt-10" : "pb-8 sm:pb-10"
          }
        >
          {tabs}
        </div>
      </div>
    </div>
  );
}
