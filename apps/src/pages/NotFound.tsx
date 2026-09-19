import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { BUTTON_OUTLINE, GUTTER } from "../ui";

/** Inside the shell, so the masthead and footer still say where you are. */
export default function NotFound() {
  const { t } = useTranslation();
  return (
    <main className={`py-24 text-center sm:py-32 ${GUTTER}`}>
      <p className="text-sm text-ink-soft tabular-nums">404</p>
      <h1 className="mt-4 font-display text-headline font-normal">
        {t("notFound.title")}
      </h1>
      <Link to="/" className={`mt-8 ${BUTTON_OUTLINE}`}>
        {t("notFound.home")}
      </Link>
    </main>
  );
}
