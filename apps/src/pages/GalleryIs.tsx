import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";
import PageHead from "../components/PageHead";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { GUTTER } from "../ui";
import AboutSections from "./About";
import VisitSections from "./Visit";

// 갤러리 이즈 (2026-08-28): the gallery itself, one door on the masthead and
// one page behind it. 갤러리 소개 and 오시는 길 were two tabs telling one
// story — who the gallery is, and where it is — so 오시는 길 now simply
// follows 갤러리 소개 down the page, under a ruled heading like every other
// section, with no tab row between them.
//
// `/visit` and the old `/#visit` still work: both land on the `visit` section
// (App forwards them to `/about#visit`), which is the address the studio's
// masthead and every kept link have.

export default function GalleryIsPage() {
  const { t, i18n } = useTranslation();
  // The page is named after the gallery, so the tab takes the site's other
  // name rather than saying 갤러리 이즈 twice.
  useDocumentTitle(t("galleryPage.title"), t("brand.latin"));
  const { hash } = useLocation();
  const draft = i18n.language === "en";

  // A client-side navigation keeps the scroll position of the page it left,
  // which is not where a page starts — unless the address names a section,
  // as `/visit` does.
  useEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView();
      return;
    }
    window.scrollTo({ top: 0 });
  }, [hash]);

  return (
    <main>
      <PageHead title={t("galleryPage.title")} />
      <article className={`py-10 sm:py-14 ${GUTTER}`}>
        <AboutSections />
        <div className="mx-auto max-w-4xl">
          <VisitSections />
          {draft && (
            <p className="mt-12 text-sm text-ink-soft">{t("aboutPage.note")}</p>
          )}
        </div>
      </article>
    </main>
  );
}
