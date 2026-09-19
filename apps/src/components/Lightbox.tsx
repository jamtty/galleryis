import { useEffect, useRef, useState, type TouchEvent } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

// The picture popup on a show's page, galleryhyundai.com's Selected Works
// viewer: the whole viewport goes white, one photograph sits contained in
// the middle with the show's name and its place in the set under it, an
// arrow to either side, and a × at the top right. The arrows stop at the
// ends rather than wrapping, as theirs do.
//
// Where theirs hides the arrows on a phone and leaves swiping, ours keeps
// them and moves the pair under the caption: the audience here skews older
// and a control you can see beats one you must guess. Swiping works too.

const SWIPE_MIN_PX = 40;

export default function Lightbox({
  images,
  index,
  title,
  onClose,
  onIndexChange,
}: {
  images: string[];
  /** Which of `images` is up. */
  index: number;
  /** The show's name, printed under every picture. */
  title: string;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}) {
  const { t } = useTranslation();
  const total = images.length;
  const src = images[index];
  const hasPrev = index > 0;
  const hasNext = index < total - 1;
  const root = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  // Which picture has finished arriving: the current one fades in when
  // this matches `src`, and a picture that has been shown once stays known.
  const [loaded, setLoaded] = useState<string | null>(null);

  // Take focus on open, hold the page still, and hand both back on close.
  useEffect(() => {
    const opener = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    close.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, []);

  // An arrow that has just gone disabled under the keyboard's focus would
  // drop it onto the body, and Tab would leave the dialog; catch it.
  useEffect(() => {
    const active = document.activeElement;
    if (
      !(active instanceof HTMLElement) ||
      !root.current?.contains(active) ||
      (active instanceof HTMLButtonElement && active.disabled)
    )
      close.current?.focus();
  }, [index]);

  // The neighbours are the next thing asked for; have them ready.
  useEffect(() => {
    for (const neighbour of [images[index - 1], images[index + 1]]) {
      if (neighbour) new Image().src = neighbour;
    }
  }, [images, index]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowRight" && hasNext) onIndexChange(index + 1);
      else if (event.key === "ArrowLeft" && hasPrev) onIndexChange(index - 1);
      else if (event.key === "Tab") trapTab(event, root.current);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, hasPrev, hasNext, onClose, onIndexChange]);

  const onTouchStart = (event: TouchEvent) => {
    const point = event.touches[0];
    touch.current = point ? { x: point.clientX, y: point.clientY } : null;
  };
  const onTouchEnd = (event: TouchEvent) => {
    const start = touch.current;
    const point = event.changedTouches[0];
    touch.current = null;
    if (!start || !point) return;
    const dx = point.clientX - start.x;
    const dy = point.clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0 && hasNext) onIndexChange(index + 1);
    if (dx > 0 && hasPrev) onIndexChange(index - 1);
  };

  const label = t("exhibition.photo", { title, n: index + 1 });
  const arrow =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border border-ink bg-ground text-ink transition-colors hover:bg-ink hover:text-ground disabled:cursor-default disabled:opacity-30 disabled:hover:bg-ground disabled:hover:text-ink md:absolute md:top-1/2 md:-translate-y-1/2";

  return createPortal(
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      // A click on the white around the picture closes, as theirs does; on
      // the picture, its caption or a control it does not.
      onClick={(event) => {
        if (!(event.target as Element).closest("img, figcaption, button"))
          onClose();
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      // Below `md` the content may stand taller than the screen (a tall
      // picture over a two-line title) and the box scrolls; from `md` it is
      // centred in a padded frame with the arrows in the margins.
      className="animate-fade fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain bg-ground md:items-center md:px-24 md:py-10 lg:px-40"
    >
      <button
        ref={close}
        type="button"
        onClick={onClose}
        aria-label={t("lightbox.close")}
        className="absolute top-2 right-2 z-10 flex h-11 w-11 items-center justify-center text-ink transition-opacity hover:opacity-60 md:top-6 md:right-6"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className="h-7 w-7 md:h-8 md:w-8"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
        >
          <path d="M5 5l14 14M19 5L5 19" />
        </svg>
      </button>

      <figure className="my-auto flex w-full flex-col items-center gap-5 pt-16 pb-10 md:w-auto md:max-w-full md:py-0">
        <img
          src={src}
          alt={label}
          onLoad={() => setLoaded(src)}
          // The whole width on a phone at no more than half the screen, so
          // the caption and arrows stay in view under it; its own size on a
          // desk, capped to leave room for the caption.
          className={`block h-auto max-h-[50dvh] w-full object-contain transition-opacity duration-300 md:max-h-[calc(100dvh-160px)] md:w-auto md:max-w-full ${
            loaded === src ? "opacity-100" : "opacity-0"
          }`}
        />
        <figcaption className="flex flex-col items-center gap-1 px-5 text-center">
          <p className="text-lg break-keep">{title}</p>
          <p className="text-base text-ink-soft tabular-nums">
            {index + 1} / {total}
          </p>
        </figcaption>
        {/* One pair of arrows: a row under the caption on a phone, and from
            `md` the row dissolves (`contents`) and each arrow is pinned to
            its own margin of the white frame. */}
        <div className="flex items-center gap-6 md:contents">
          <button
            type="button"
            onClick={() => onIndexChange(index - 1)}
            disabled={!hasPrev}
            aria-label={t("lightbox.prev")}
            className={`${arrow} md:left-6 lg:left-[100px]`}
          >
            <ArrowIcon direction="left" />
          </button>
          <button
            type="button"
            onClick={() => onIndexChange(index + 1)}
            disabled={!hasNext}
            aria-label={t("lightbox.next")}
            className={`${arrow} md:right-6 lg:right-[100px]`}
          >
            <ArrowIcon direction="right" />
          </button>
        </div>
      </figure>
    </div>,
    document.body,
  );
}

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={`h-5 w-5 ${direction === "left" ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/** Keep Tab inside the dialog: off the last control it wraps to the first. */
function trapTab(event: KeyboardEvent, root: HTMLElement | null) {
  if (!root) return;
  const controls = [
    ...root.querySelectorAll<HTMLElement>("button:not(:disabled)"),
  ];
  if (controls.length === 0) return;
  const first = controls[0];
  const last = controls[controls.length - 1];
  const active = document.activeElement;
  const inside = active instanceof Node && root.contains(active);
  if (
    event.shiftKey ? active === first || !inside : active === last || !inside
  ) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  }
}
