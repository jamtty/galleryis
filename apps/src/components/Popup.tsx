import { fetchJson, pick, type PopupResponse } from "@galleryis/shared";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

// 팝업 — the gallery's announcement over the front page, drawn as the small
// window galleryis.com opens: a title bar with the 제목 and its own ✕, the
// picture under it (the whole of it a link), and the legacy popup's two
// controls along the foot.
//
// **It is a window drawn in the page, not a browser window.** `window.open`
// without a click is exactly what every popup blocker stops: the visitor would
// get a "팝업이 차단되었습니다" bar where the announcement should be, and on a
// phone a permitted popup is a whole new tab rather than a small window. Drawn
// here it always appears, for everyone.
//
// Three more decisions worth stating:
//
// 1. It **fails closed**, the opposite of the shutdown curtain. A call that
//    errors, a picture that 404s, and no popup at all are the same thing here:
//    nothing over the page. A curtain is a promise; a popup is an extra.
// 2. It opens only once the picture has actually arrived. The words are inside
//    the image, so an empty frame says nothing at all, and a frame that resizes
//    when the picture lands is worse than one that was never there.
// 3. 닫기 lasts **one page view**: every fresh arrival at the front page opens
//    it again, as the legacy popup does. The one thing written down is the day
//    tick (localStorage), keyed on the popup's id **and** its last edit, so a
//    new picture on the same popup is a new announcement and shows again.
//    Nothing about who has seen what leaves the browser.
//
// Being a window rather than a modal, it takes nothing hostage: no scrim, no
// scroll lock, the page under it stays live, and on a desktop it can be
// dragged out of the way by its title bar.

const DAY_MS = 24 * 60 * 60 * 1000;

/** Where the window opens: clear of the masthead, at the left, as the
 *  gallery's own popups sit. On a phone it spans the screen's width. */
function firstSpot(): { x: number; y: number } {
  const narrow = window.innerWidth < 640;
  return narrow ? { x: 8, y: 72 } : { x: 40, y: 104 };
}

/** Dragging is for a mouse. On a touch screen the title bar has to stay a
 *  place you can scroll the page from. */
function draggable(): boolean {
  return window.matchMedia?.("(pointer: fine)")?.matches ?? true;
}

const clamp = (value: number, limit: number) =>
  Math.max(0, Math.min(value, Math.max(0, limit)));

/** 「하루 동안 이 창을 다시 열지 않음」, as `<key>|<epoch ms>`. The only thing
 *  the popup remembers past the page it was closed on. */
const FOR_A_DAY = "galleryis.popup.hidden";

/** Storage can be absent or throw outright (private windows, blocked site
 *  data). Nothing here may keep the page from drawing.
 *
 *  Reached through `window` rather than as a bare global: under Node 25 the
 *  runtime has a `localStorage` of its own that shadows the page's. */
function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // A visitor whose browser refuses storage sees the popup again. Fine.
  }
}

function dismissed(key: string): boolean {
  // 확인용 주소 `?popup=1` — 닫음 기록을 무시하고 무조건 다시 띄웁니다.
  // (팝업이 안 보인다는 신고가 오면 먼저 이 주소로 열어 보게 합니다)
  if (new URLSearchParams(window.location.search).get("popup") === "1") {
    return false;
  }

  const [hidden, until] = (read(FOR_A_DAY) ?? "").split("|");
  return hidden === key && Number(until) > Date.now();
}

/**
 * The path to open inside the app, or null for an address away from here.
 *
 * The desk takes `/notices/desk-…` and a full address alike, and the gallery
 * is as likely to paste this site's own URL as to type the path, so a link
 * back to our own pages stays inside the app either way.
 */
function ourPath(link: string): string | null {
  if (link.startsWith("/")) return link;
  try {
    const url = new URL(link);
    if (url.origin === window.location.origin)
      return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    // Not an address we can read; treated as one going elsewhere.
  }
  return null;
}

export default function Popup() {
  const { t, i18n } = useTranslation();
  const { data } = useQuery({
    queryKey: ["popup"],
    queryFn: () => fetchJson<PopupResponse>("/api/popup"),
    retry: false,
    staleTime: 5 * 60_000,
  });
  const popup = data?.popup ?? null;
  const key = popup ? `${popup.id}:${popup.updated_at ?? ""}` : "";

  const [shut, setShut] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [forADay, setForADay] = useState(false);
  const [spot, setSpot] = useState(firstSpot);
  const frame = useRef<HTMLDivElement>(null);
  /** Where in the title bar it was taken hold of, while a drag is on. */
  const grab = useRef<{ dx: number; dy: number } | null>(null);
  const titleId = useId();

  // Storage is read here rather than during the render, so the render stays a
  // function of state and a second popup in the same visit is judged afresh.
  useEffect(() => {
    if (key && dismissed(key)) setShut(key);
  }, [key]);

  const open = Boolean(popup) && loaded && shut !== key;

  const close = () => {
    if (!key) return;
    // Kept in this component's own state and nowhere else, so the next front
    // page opens it again. Only the tick is written down.
    if (forADay) write(FOR_A_DAY, `${key}|${Date.now() + DAY_MS}`);
    setShut(key);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, forADay, key]);

  // The drag itself. The listeners are on the window, not the title bar, so a
  // pointer that outruns the window keeps moving it, and letting go anywhere
  // ends it. Kept inside the viewport: a window dragged off the screen would
  // be gone with no way to bring it back.
  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (!grab.current) return;
      const box = frame.current;
      setSpot({
        x: clamp(
          event.clientX - grab.current.dx,
          window.innerWidth - (box?.offsetWidth ?? 0),
        ),
        y: clamp(
          event.clientY - grab.current.dy,
          window.innerHeight - (box?.offsetHeight ?? 0),
        ),
      });
    };
    const drop = () => {
      grab.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", drop);
    window.addEventListener("pointercancel", drop);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", drop);
      window.removeEventListener("pointercancel", drop);
    };
  }, []);

  if (!popup) return null;

  const title = pick(popup, "title", i18n.language);
  const path = popup.link_url ? ourPath(popup.link_url) : null;
  // The picture is the whole of the link, as it is on galleryis.com, and it
  // is what the announcement says: its own words are inside the image, so the
  // title carries them for a screen reader.
  const picture = (
    <img
      src={popup.image_url}
      alt={title}
      onLoad={() => setLoaded(true)}
      // Its own size, never blown up past it, and never taller than the
      // screen: a gallery announcement is usually one tall poster, and half
      // of it above the fold is half an announcement.
      className="mx-auto block h-auto max-h-[62dvh] w-auto max-w-full"
    />
  );

  return createPortal(
    <div
      ref={frame}
      // Hidden until the picture is there, so nothing flashes and nothing
      // lands in the tab order early.
      hidden={!open}
      role="dialog"
      // No aria-modal: this is a window over a page that stays usable, and
      // claiming otherwise would tell a screen reader the page had gone.
      aria-labelledby={titleId}
      style={{ left: spot.x, top: spot.y }}
      // A phone gets the window's full width less 8px either side. `100%`, not
      // `100vw`: vw counts the scrollbar and the window would stick out past
      // the page's right edge by exactly that much.
      className="fixed z-50 flex max-h-[calc(100dvh-5rem)] w-[calc(100%-1rem)] flex-col overflow-hidden rounded-sm border border-line bg-ground shadow-[0_16px_48px_rgba(20,19,16,0.28)] sm:w-fit sm:max-w-xl"
    >
      {/* The title bar: the window's name, the handle it is moved by, and
          the ✕ that closes it. */}
      <div
        data-testid="popup-titlebar"
        onPointerDown={(event) => {
          if (!draggable()) return;
          grab.current = {
            dx: event.clientX - spot.x,
            dy: event.clientY - spot.y,
          };
        }}
        className="flex items-center gap-2 border-b border-line bg-surface-hi px-3 py-2 select-none sm:cursor-grab sm:touch-none sm:active:cursor-grabbing"
      >
        <h2
          id={titleId}
          // The title follows the locale, and falls back to the Korean when
          // there is no English half; the hint is for that case, so that a
          // screen reader on the English page switches voice for it.
          lang={title === popup.title_ko ? "ko" : undefined}
          className="min-w-0 flex-1 truncate text-sm font-bold text-ink"
        >
          {title}
        </h2>
        <button
          type="button"
          onClick={close}
          aria-label={t("popup.closeWindow")}
          className="-mr-1.5 inline-flex h-9 w-9 shrink-0 items-center justify-center text-ink transition-opacity hover:opacity-60"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
          >
            <path d="M5 5l14 14M19 5L5 19" />
          </svg>
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {popup.link_url ? (
          path ? (
            <Link to={path} onClick={close}>
              {picture}
            </Link>
          ) : (
            <a
              href={popup.link_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={close}
            >
              {picture}
            </a>
          )
        ) : (
          picture
        )}
      </div>
      {/* The legacy popup's own foot: the day box at the left, 창닫기 at the
          right. Both are 44px targets on a phone. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 border-t border-line px-3">
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={forADay}
            onChange={(event) => setForADay(event.target.checked)}
            className="h-4 w-4 accent-ink"
          />
          {t("popup.hideForADay")}
        </label>
        <button
          type="button"
          onClick={close}
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink transition-opacity hover:opacity-60"
        >
          {t("popup.close")}
          <span aria-hidden>✕</span>
        </button>
      </div>
    </div>,
    document.body,
  );
}
