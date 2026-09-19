import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * insaartcenter's floating ↑, bottom right: a white disc with a shadow that
 * appears once the page has scrolled a screen, and takes the reader back to
 * the top. A 48px target, and hidden rather than disabled while at the top so
 * it never covers the footer's links for nothing.
 */
export default function BackToTop() {
  const { t } = useTranslation();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > window.innerHeight * 0.8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <button
      type="button"
      aria-label={t("backToTop")}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`fixed right-5 bottom-5 z-30 grid h-12 w-12 place-items-center rounded-full border border-line bg-surface text-ink shadow-[0_2px_12px_rgba(0,0,0,0.12)] transition-[opacity,transform,background-color] duration-300 hover:bg-ink hover:text-ground sm:right-8 sm:bottom-8 ${
        shown ? "opacity-100" : "pointer-events-none translate-y-2 opacity-0"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}
