// Display order of the fee tiers, as the gallery lists them (2026-08-12
// feedback): 평수기 · 비수기 · 성수기. The keys are frozen wire names, `peak`
// is the *regular* tier; the labels in i18n carry the truth.
export const TIERS = ["peak", "low", "high"] as const;

// Same output under every locale (pinned by the studio's i18n canary), so one
// formatter serves both languages.
const krwParts = new Intl.NumberFormat("ko", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

/**
 * `₩ 5,500,000`: the sign a space off its amount, 2026-08-29 feedback. ICU
 * sets them tight, and a fee is the number a renter reads first.
 *
 * The space is non-breaking, so a narrow cell can never leave the ₩ hanging
 * on the line above its digits; and it is placed by part rather than by a
 * replace, so a locale that ever moves the sign is not silently mangled —
 * KRW leads in both of ours, which the canary test pins.
 */
export const krw = {
  format: (value: number) =>
    krwParts
      .formatToParts(value)
      .map((part) =>
        part.type === "currency" ? `${part.value}\u00a0` : part.value,
      )
      .join(""),
};

/** Today in the gallery's own timezone, for the price tables' "이번 달"
 *  marker. KST, never the device's or UTC's date: every date rule in this
 *  project is KST, and at 08:00 on an October 1st the UTC calendar still
 *  says September, which is a different season tier. */
export function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
  }).format(new Date());
}
