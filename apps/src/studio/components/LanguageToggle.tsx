import { useTranslation } from "react-i18next";

export default function LanguageToggle() {
  const { t, i18n } = useTranslation();
  const active = i18n.language === "en" ? "en" : "ko";
  const next = active === "ko" ? "en" : "ko";
  return (
    <div className="inline-flex items-center gap-3 text-sm text-ink-soft">
      <span aria-hidden className={active === "ko" ? "text-ink" : undefined}>
        KO
      </span>
      <button
        type="button"
        aria-label={t(next === "en" ? "language.english" : "language.korean")}
        onClick={() => void i18n.changeLanguage(next)}
        className="relative h-4 w-8 rounded-full bg-ink/15 transition-colors hover:bg-ink/30"
      >
        <span
          className="absolute top-0.5 size-3 rounded-full bg-ink transition-[left] duration-300"
          style={{ left: active === "en" ? "1.125rem" : "0.125rem" }}
        />
      </button>
      <span aria-hidden className={active === "en" ? "text-ink" : undefined}>
        EN
      </span>
    </div>
  );
}
