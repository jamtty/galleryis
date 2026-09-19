/**
 * 대관 유의사항 — the gallery's own rental terms, as an applicant has to see
 * them before ticking the box.
 *
 * Here rather than in either app's i18n bundle for three reasons:
 *
 * - **One copy.** The studio shows them under the agreement checkbox; the desk
 *   shows the gallery what an applicant agreed to. Two copies of a contract
 *   term drift, and the drift is invisible until it matters.
 * - **Versioned with the text.** `RENTAL_TERMS_VERSION` travels with the
 *   application (`terms_version` on the booking). "They agreed to the terms" is
 *   worth nothing later if the terms have since been edited and nothing
 *   recorded which wording was on screen.
 * - **Not a link.** The obvious alternative was linking to galleryis.com, and
 *   that origin's HTTPS certificate is expired — which is why the scraper talks
 *   plain HTTP to it. A terms link from an HTTPS page would either break or
 *   teach the applicant to click through a certificate warning on the one
 *   screen where trust is the whole point.
 *
 * Korean is authoritative: this is a contract precondition, and the gallery
 * wrote it. The English is a reading aid and says so — see `RENTAL_TERMS_NOTE`.
 */

export interface RentalTermsSection {
  /** "1. 대관 취소" — numbered by the gallery, not by the renderer. */
  heading: string;
  /** Sub-clauses in order. A section with one unnumbered paragraph has one. */
  items: string[];
}

/**
 * Bumped whenever a word of the text below changes, which is what makes a
 * stored `terms_version` mean something. Dated rather than serial: the desk
 * reads this in the audit trail, and a date is legible there.
 */
export const RENTAL_TERMS_VERSION = "2026-08-17";

export const RENTAL_TERMS_KO: RentalTermsSection[] = [
  {
    heading: "1. 대관 취소",
    items: [
      "대관을 통보한 후 7일 이내에 계약을 체결하지 않은 경우",
      "대관료를 정해진 날짜까지 납부하지 않은 경우",
      "금지된 사항 및 계약사항을 위반할 경우 대관이 취소될 수 있습니다.",
    ],
  },
  {
    heading: "2. 작품 반입, 반출 및 부대시설 사용",
    items: [
      "전시 준비와 정리를 위하여 전시장을 사용하는 경우도 대관일수 산정에 포함됩니다. 대관은 7일 기준으로 합니다.",
      "부대시설 사용 및 사용료 납부, 전시를 위한 실무협의(전시 시작 2주일전)가 있습니다.",
      "모든 전시장의 작품 반입 반출이 같은 날 이루어짐으로써 사전협의 하에 반입, 반출 시간이 조정될 수 있습니다.",
    ],
  },
  {
    heading: "3. 작품설치",
    items: [
      "갤러리이즈에서 사용하는 못과 나사피스로만 작품 설치가 가능하며, 대못, 타카, 본드, 글루건, 양면테이프, 청테이프, 접착 폼보드는 사용할 수 없습니다.(셀로판테이프, 압정으로 대체 사용)",
    ],
  },
  {
    heading: "4. 기타",
    items: [
      "대관 사용권을 타인에게 양도하거나 전시 기간 중 전시목적과 상이한 작품 또는 물품을 판매하는 행위는 금지되어 있습니다.",
      "전시 및 행위의 목적과 내용을 승인된 내용과 다르게 하거나, 갤러리이즈 시설과 설비를 변경, 훼손하는 행위는 금지되어있습니다.",
      "훼손 시 복구에 대한 책임은 대관자에게 있습니다.",
      "전시와 관련하여 발생하는 폐기물(포장재료 등)의 처리비용은 대관자가 부담합니다.",
    ],
  },
];

export const RENTAL_TERMS_EN: RentalTermsSection[] = [
  {
    heading: "1. Cancellation",
    items: [
      "The contract is not signed within 7 days of the rental being granted.",
      "The rental fee is not paid by the date set.",
      "A rental may be cancelled where prohibited conduct or the terms of the contract are breached.",
    ],
  },
  {
    heading: "2. Moving work in and out, and use of facilities",
    items: [
      "Days spent in the hall installing and striking the show count towards the rental period. A rental is reckoned in 7-day weeks.",
      "Use of the gallery's facilities is charged separately, and a working meeting is held two weeks before the show opens.",
      "Work moves in and out of every hall on the same day, so those times may be adjusted by prior arrangement.",
    ],
  },
  {
    heading: "3. Hanging the work",
    items: [
      "Work may be hung only with the nails and screws the gallery supplies. Masonry nails, staple guns, adhesive, glue guns, double-sided tape, duct tape and adhesive foam board may not be used. (Use cellophane tape or drawing pins instead.)",
    ],
  },
  {
    heading: "4. Other",
    items: [
      "The rental may not be transferred to anyone else, and selling work or goods unrelated to the exhibition during the period is prohibited.",
      "Departing from the approved purpose or content of the exhibition, and altering or damaging the gallery's premises or fittings, are prohibited.",
      "The renter is responsible for the cost of making good any damage.",
      "The renter bears the cost of disposing of waste arising from the exhibition (packing materials, etc.).",
    ],
  },
];

/**
 * Shown above the English rendering. The same stance the content pipeline takes
 * with its machine translations: the Korean is the document, this is help
 * reading it.
 */
export const RENTAL_TERMS_NOTE =
  "Reference translation. The Korean text is the binding one.";

/** The terms in the locale asked for, falling back to the Korean original. */
export function rentalTerms(locale: string): RentalTermsSection[] {
  return locale.startsWith("en") ? RENTAL_TERMS_EN : RENTAL_TERMS_KO;
}
