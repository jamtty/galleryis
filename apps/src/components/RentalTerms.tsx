import { RENTAL_TERMS_NOTE, rentalTerms } from "@galleryis/shared";
import { useTranslation } from "react-i18next";
import { LINK } from "../ui";

// 대관 유의사항, under the box that agrees to them.
//
// The words travel with the form rather than as a link to galleryis.com: that
// site's certificate expired years ago, the reason the scraper speaks plain
// HTTP to it, so a link from this HTTPS page would either break outright or
// teach an applicant to click through a browser security warning on the one
// screen where trust is the point. On a phone it would also cost them a
// half-filled form.
//
// Closed by default: an applicant who wants the wording opens it, and one who
// does not is not made to scroll a contract to reach the send button.

export default function RentalTerms() {
  const { t, i18n } = useTranslation();
  const sections = rentalTerms(i18n.language);

  return (
    <details className="border border-line bg-ground">
      <summary
        className={`min-h-11 cursor-pointer list-none px-4 py-3 text-sm text-ink-soft ${LINK}`}
      >
        {t("rental.termsOpen")}
      </summary>
      <div className="space-y-4 border-t border-line px-4 py-4">
        {i18n.language.startsWith("en") && (
          <p className="text-sm text-ink-soft">{RENTAL_TERMS_NOTE}</p>
        )}
        {sections.map((section) => (
          <section key={section.heading} className="space-y-1">
            <h4 className="text-sm font-medium text-ink">{section.heading}</h4>
            {section.items.map((item) => (
              <p key={item} className="text-sm leading-relaxed text-ink-soft">
                {item}
              </p>
            ))}
          </section>
        ))}
      </div>
    </details>
  );
}
