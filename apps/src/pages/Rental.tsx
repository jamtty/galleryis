import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import PageHead from "../components/PageHead";
import Rental from "../components/Rental";
import { useDocumentTitle } from "../lib/useDocumentTitle";

// 대관 신청's own page (2026-08-24): the availability grid and the application
// form, moved off the landing so the front page stays a door. The page head
// is insaartcenter's; the section carries the steps, the grid and the form.
export default function RentalPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("hero.apply"), t("brand.name"));

  // A client-side navigation keeps the scroll position of the page it left,
  // which is not where a page starts.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  return (
    <main>
      <PageHead title={t("nav.rental")} />
      <Rental />
    </main>
  );
}
