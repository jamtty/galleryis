import { SITE_NAME, WORDMARK_PATH, WORDMARK_VIEWBOX } from "@galleryis/shared";

/**
 * GALLERY IS — the gallery's own English wordmark, and at the moment the whole
 * lockup. The `is`-in-a-footprint mark that used to stand beside it is gone:
 * the gallery is drawing a new logo, and a placeholder mark in the masthead
 * would only have to be unlearned (docs/brand-guidelines.md §3).
 *
 * Mirrors apps/studio's and apps/admin's component of the same name; the
 * letters themselves live once, in `packages/shared`, traced from the supplied
 * artwork by `uv run scripts/make_wordmark.py`.
 *
 * One `currentColor` path, so the same file goes ink on the masthead and white
 * in the footer without a second asset. Height is the caller's to set — the
 * viewBox carries the 12.7:1 proportion, so `w-auto` follows.
 *
 * Labelled rather than hidden: unlike the old mark this is not decoration
 * beside the name, it *is* the name, so it carries the accessible one.
 */
export default function Wordmark({
  className = "h-5",
  title = SITE_NAME,
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox={WORDMARK_VIEWBOX}
      role="img"
      aria-label={title}
      className={`${className} w-auto shrink-0`}
    >
      <path d={WORDMARK_PATH} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}
