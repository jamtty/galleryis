import { useTranslation } from "react-i18next";
import DefRow from "../components/DefRow";
import { LINK } from "../ui";

// 갤러리 소개, the first half of 갤러리 이즈 (see pages/GalleryIs.tsx, which
// owns the page head; 오시는 길 follows them on the same page).
// insaartcenter's 소개 page: the introduction as a grey text panel beside a
// watercolour of the building, then 관람 안내 and 문의 on ruled headings.
// Every section on the page stands in the same max-w-4xl column — the
// introduction included, so the grey panel's left edge and the 관람 안내
// heading below it are one line.
//
// The introduction — introHeading and intro1~4 — is the gallery's own, newly
// written and supplied on 2026-08-28; the 관람 안내 facts are re-typeset from
// the legacy site's 관람안내 subpage (locked in a GIF there, read off and set
// as text here) and the 대표 and inquiry mail from the live parts of its
// contact page.
//
// 갤러리 이즈와 인수문고 and 갤러리 이즈 건축물 — the sub02.php text on the
// clan library the gallery is named after and on Itami Jun — stood between
// the two until 2026-08-28, when they came down: the new introduction tells
// both stories already, in the gallery's own words and in four lines.
//
// The Korean is the gallery's text with spacing and punctuation normalised;
// the English is our draft, and the page says so at its end in English only.

export default function AboutSections() {
  const { t, i18n } = useTranslation();
  const english = i18n.language === "en";

  return (
    <>
      <div className="mx-auto grid max-w-4xl lg:grid-cols-2">
        <div className="flex flex-col justify-center bg-surface-warm px-6 py-10 sm:px-10 sm:py-14">
          <h2 className="font-display text-title font-bold break-keep">
            {t("aboutPage.introHeading")}
          </h2>
          {/* A step under the 17px body, and broken on words rather than on
              syllables (2026-09-09): Korean wraps anywhere by default, which
              cut 지었습니 / 다. across two lines, and `break-keep` ends a
              line on a word instead.

              English takes another step down, to 14px. The same four
              paragraphs run 18 lines there against Korean's 14 — the draft
              is simply wordier — and at one size the English panel stood
              130px taller than the Korean, which is 130px more of the
              watercolour cropped away to meet it. At 14px it is 624 against
              578, close enough that the two languages crop the picture much
              alike (a tenth of its width against a thirtieth). Latin at 14px
              reads at about the size Hangul does at 16, and it is the floor
              this site sets for text that matters, not below it. */}
          <div
            className={`mt-6 space-y-4 leading-relaxed break-keep ${
              english ? "text-sm" : "text-[1rem]"
            }`}
          >
            <p>{t("aboutPage.intro1")}</p>
            <p>{t("aboutPage.intro2")}</p>
            <p>{t("aboutPage.intro3")}</p>
            <p>{t("aboutPage.intro4")}</p>
          </div>
        </div>
        {/* The building itself, in one picture (2026-08-28). The four
            photographs that stood here as a 2x2 grid were borrowed — three
            cut from the legacy site's own collage, the entrance from a blog
            post — and none of them was the gallery's to publish; this is
            one drawing of the corner instead.

            From `lg` up the watercolour fills its half of the row — flush
            top, bottom and outer edge with the panel beside it (2026-09-09).
            It was set whole on the page's white until then, and being a
            portrait picture in a half-width column it could never reach the
            text's height: the introduction ran ~100px past it in Korean and
            ~180px in English, so the row read as one tall block and one
            small floating plate. `object-cover` trades the little the crop
            takes — a few pixels of sky and pavement in Korean, the outer
            tenth of each side in the longer English — for two halves that
            end together in either language, whatever the text's length.
            Below `lg` the picture stands under the panel with room around
            it, whole, where nothing needs matching. */}
        <div className="flex items-center justify-center px-6 py-10 sm:px-10 sm:py-14 lg:block lg:p-0">
          <img
            src="/building-exterior.jpg"
            alt={t("aboutPage.exteriorAlt")}
            loading="lazy"
            className="max-h-[32rem] w-auto max-w-full lg:h-full lg:max-h-none lg:w-full lg:object-cover"
          />
        </div>
      </div>

      <div className="mx-auto mt-14 max-w-4xl sm:mt-20">
        <div className="grid gap-14 sm:grid-cols-2 sm:gap-10">
          <section>
            <h2 className="border-b border-line pb-3 font-display text-title font-bold">
              {t("aboutPage.visitHeading")}
            </h2>
            <dl className="mt-2">
              <DefRow label={t("aboutPage.hoursLabel")}>
                {t("aboutPage.hours")}
                <span className="mt-1 block text-ink-soft">
                  {t("aboutPage.hoursNote")}
                </span>
              </DefRow>
              <DefRow label={t("aboutPage.feeLabel")}>
                {t("aboutPage.fee")}
              </DefRow>
              <DefRow label={t("aboutPage.closedLabel")}>
                {t("aboutPage.closed")}
              </DefRow>
            </dl>
          </section>

          <section>
            <h2 className="border-b border-line pb-3 font-display text-title font-bold">
              {t("aboutPage.contactHeading")}
            </h2>
            <dl className="mt-2">
              <DefRow label={t("aboutPage.directorLabel")}>
                {t("aboutPage.director")}
              </DefRow>
              <DefRow label={t("visit.telLabel")}>
                <span className="tabular-nums">{t("visit.tel")}</span>
              </DefRow>
              <DefRow label={t("visit.emailLabel")}>
                <a href={`mailto:${t("visit.email")}`} className={LINK}>
                  {t("visit.email")}
                </a>
              </DefRow>
              <DefRow label={t("visit.addressLabel")}>
                {t("visit.address")}
              </DefRow>
            </dl>
          </section>
        </div>
      </div>
    </>
  );
}
