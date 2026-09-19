import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

// Loading states as content-shaped placeholders rather than a line of text.
//
// A skeleton previews the layout the data is about to fill, which reads as
// faster than a spinner and never shoves the page when the content lands
// (the placeholder is already the content's size). Each composition here
// mirrors one real layout on the site, so the swap is a fill, not a jump.
// The shapes are decorative; the wrapper is the one thing a screen reader
// hears, as a status with the same words the page used to print.

function Box({ className }: { className: string }) {
  return <div aria-hidden className={`skeleton ${className}`} />;
}

/** The status wrapper every composition shares. */
function Status({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">{t("loading")}</span>
      {children}
    </div>
  );
}

/** A run of text lines, the last one shorter, as a paragraph sets. */
function Lines({
  count = 3,
  className = "",
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div aria-hidden className={`space-y-3 ${className}`}>
      {Array.from({ length: count }, (_, i) => (
        <Box
          key={i}
          className={`h-4 rounded-sm ${i === count - 1 ? "w-2/3" : "w-full"}`}
        />
      ))}
    </div>
  );
}

/** The landing hero: words at the left, the poster field at the right. */
export function HeroSkeleton() {
  return (
    <Status>
      <div aria-hidden className="grid lg:grid-cols-2">
        <div className="flex flex-col justify-center gap-5 px-5 py-12 sm:px-8 lg:px-14 lg:py-16">
          <Box className="h-5 w-40 rounded-sm" />
          <Box className="h-12 w-4/5 rounded-sm sm:h-14" />
          <Box className="h-5 w-1/3 rounded-sm" />
          <Box className="h-5 w-1/2 rounded-sm" />
          <Box className="mt-3 h-11 w-32 rounded-full" />
        </div>
        <div className="grid min-h-[20rem] place-items-center bg-surface-hi p-6 sm:min-h-[26rem] sm:p-10 lg:min-h-[36rem] lg:p-14">
          {/* A white card on the grey field, the poster's own silhouette. */}
          <Box className="aspect-[4/5] h-[18rem] max-w-full bg-surface lg:h-[26rem]" />
        </div>
      </div>
    </Status>
  );
}

/** The poster grid: a square per card, then title, dates, hall. */
export function PosterGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <Status>
      <div
        aria-hidden
        className="grid grid-cols-2 gap-x-5 gap-y-12 sm:gap-x-8 lg:grid-cols-4 lg:gap-x-10"
      >
        {Array.from({ length: count }, (_, i) => (
          <div key={i}>
            <Box className="aspect-square w-full" />
            <Box className="mt-5 h-5 w-3/4 rounded-sm" />
            <Box className="mt-3 h-4 w-1/2 rounded-sm" />
            <Box className="mt-2 h-4 w-1/3 rounded-sm" />
          </div>
        ))}
      </div>
    </Status>
  );
}

/** The notice board: one title and one date per hairline row. */
export function RowsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <Status>
      <div aria-hidden>
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-6 border-b border-line py-5"
          >
            <Box
              className={`h-4 rounded-sm ${i % 3 === 1 ? "w-1/2" : "w-2/3"}`}
            />
            <Box className="h-4 w-20 shrink-0 rounded-sm" />
          </div>
        ))}
      </div>
    </Status>
  );
}

/** A detail page: the picture at the left, the fact table at the right, the body under. */
export function ArticleSkeleton() {
  return (
    <Status>
      <div aria-hidden>
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <Box className="aspect-[4/5] w-full max-w-xl" />
          <div>
            <Box className="h-8 w-3/4 rounded-sm" />
            <div className="mt-5 border-t-2 border-ink">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="flex gap-8 border-b border-line py-4">
                  <Box className="h-4 w-20 shrink-0 rounded-sm" />
                  <Box className="h-4 w-1/2 rounded-sm" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mx-auto mt-14 max-w-4xl">
          <Box className="h-7 w-32 rounded-sm" />
          <Lines count={5} className="mt-6" />
        </div>
      </div>
    </Status>
  );
}

/** A notice's page: the ruled head, then the body. */
export function NoticeSkeleton() {
  return (
    <Status>
      <div aria-hidden className="max-w-4xl">
        <div className="border-t-2 border-ink">
          <div className="flex flex-wrap items-center justify-between gap-6 border-b border-line py-5">
            <Box className="h-7 w-2/3 rounded-sm" />
            <Box className="h-4 w-32 rounded-sm" />
          </div>
        </div>
        <Lines count={6} className="mt-8" />
      </div>
    </Status>
  );
}

/** The halls page: storey, plan sheet, spec table, per hall. */
export function HallsSkeleton({ count = 2 }: { count?: number }) {
  return (
    <Status>
      <div aria-hidden>
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            className="grid gap-8 border-t border-line py-12 first:border-t-0 first:pt-0 lg:grid-cols-[4rem_1fr_1fr] lg:gap-10"
          >
            <Box className="h-8 w-10 rounded-sm" />
            <Box className="aspect-[4/3] w-full" />
            <div>
              <Box className="h-7 w-40 rounded-sm" />
              <div className="mt-4 border-t border-ink">
                {Array.from({ length: 5 }, (_, j) => (
                  <div key={j} className="flex border-b border-line">
                    <Box className="h-12 w-24 shrink-0 rounded-none sm:w-32" />
                    <div className="flex flex-1 items-center px-5">
                      <Box className="h-4 w-1/2 rounded-sm" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Status>
  );
}

/** The rental grid: weeks down, four halls across. */
export function GridSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Status>
      <div aria-hidden className="overflow-hidden">
        <div className="grid min-w-[34rem] grid-cols-[10rem_repeat(4,1fr)] gap-x-3 border-y border-t-ink border-b-line py-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Box key={i} className="h-4 w-20 rounded-sm" />
          ))}
        </div>
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            className="grid min-w-[34rem] grid-cols-[10rem_repeat(4,1fr)] items-center gap-x-3 border-b border-line py-1.5"
          >
            <Box className="h-4 w-28 rounded-sm" />
            {Array.from({ length: 4 }, (_, j) => (
              <Box key={j} className="h-11 rounded-sm" />
            ))}
          </div>
        ))}
      </div>
    </Status>
  );
}
