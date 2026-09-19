import { useTranslation } from "react-i18next";
import DefRow from "../components/DefRow";
import SocialLinks from "../components/SocialLinks";
import VisitMap from "../components/VisitMap";
import { SCROLL_MT } from "../ui";

// 오시는 길, the second half of 갤러리 이즈 (see pages/GalleryIs.tsx): the map
// and the gallery's own written directions, continuing the column 갤러리 소개
// ends on. The block was the front page's `#visit`, became a page of its own
// on 2026-08-28 the way 대관 left the landing on 08-24, and joined 갤러리 소개
// hours later — one story about the gallery, read in one scroll.
//
// What that merge dropped was duplication, not content: the panel of
// address · 전화 · 이메일 · 관람시간 beside the building's photographs said
// what 관람 안내 and 문의 say a screen higher, over the same four photographs.
// The section keeps the id `visit`, so `/visit` and the old `/#visit` still
// land on it.
//
// 팩스 left the list on 2026-09-09: a fax number is not a direction, and it
// stood between the car-free warning and 소식 answering a question nobody
// walking here asks. The footer still carries it, once, with the phone and
// the mail.

export default function VisitSections() {
  const { t } = useTranslation();

  return (
    <section id="visit" className={`mt-14 ${SCROLL_MT}`}>
      <h2 className="border-b border-line pb-3 font-display text-title font-bold">
        {t("visit.title")}
      </h2>
      <div className="reveal mt-6">
        <VisitMap />
      </div>
      {/* The gallery's own directions, in its own words. The map above shows
          where the gallery is; these say how to get to it, which is a
          different question and the one a map answers worst. */}
      <dl className="reveal mt-10 border-t border-ink">
        <DefRow label={t("visit.subwayLabel")}>{t("visit.subway")}</DefRow>
        <DefRow label={t("visit.busLabel")}>{t("visit.bus")}</DefRow>
        <DefRow label={t("visit.noteLabel")}>{t("visit.carFree")}</DefRow>
        <DefRow label={t("visit.followLabel")}>
          <SocialLinks withLabels />
        </DefRow>
      </dl>
    </section>
  );
}
