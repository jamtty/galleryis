import {
  ApiError,
  EXHIBITION_GENRES,
  EXHIBITION_KINDS,
  findAddress,
  labelFor,
  postJson,
  RENTAL_TERMS_VERSION,
  type AvailabilityWeek,
  type BookingAttachment,
  type BookingCreated,
  type ExhibitionGenre,
  type ExhibitionKind,
} from "@galleryis/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BUTTON_FILLED, BUTTON_OUTLINE, LINK, SCROLL_MT } from "../ui";
import { hallNameKey } from "../lib/exhibition";
import AttachmentField from "./AttachmentField";
import RentalTerms from "./RentalTerms";

// 대관 신청, the gallery's own application, field for field.
//
// Every question here is one `bbs/write.php?bo_table=order` on galleryis.com
// asks, in its order and its words: 신청자 → 주소 → 희망 전시일·전시장 →
// 전시구분 → 전시장르 → 약력소개·포트폴리오 → 메모. Three things are ours:
// 전시명 and 작가명, without which the desk's queue is a list of untitled
// applications, and 작품 수, which the hang is planned from.
//
// Two of the legacy controls are deliberately not copied. Its email field is a
// local part plus a domain dropdown whose list predates gmail (with 직접입력 as
// the escape hatch), and its phone is a prefix dropdown plus two four-digit
// boxes. Both are 2008 answers to problems a single validated input solves,
// and three boxes for a phone number is more taps for an older applicant, not
// fewer.

/** "2026.09.30, 10.06", the period as the gallery writes it. */
function periodLabel(week: AvailabilityWeek): string {
  const [, sm, sd] = week.start.split("-");
  const [ey, em, ed] = week.end.split("-");
  const [sy] = week.start.split("-");
  return sy === ey
    ? `${sy}.${sm}.${sd} ~ ${em}.${ed}`
    : `${sy}.${sm}.${sd} ~ ${ey}.${em}.${ed}`;
}

const FIELD =
  "mt-1.5 min-h-11 w-full rounded-sm border border-line-lit bg-ground px-3 py-2 text-sm text-ink transition-colors focus:border-ink";
const READONLY =
  "mt-1.5 flex min-h-11 w-full items-center rounded-sm border border-dashed border-line-lit bg-surface-hi px-3 py-2 text-sm text-ink-soft";
// The field label. Plain sans at the 14px floor: an applicant reads these to
// fill the form in, and the audience skews older.
const LABEL = "block text-sm font-medium text-ink-soft";

// The star beside a required field's word. 2026-09-10: the gallery named the
// five it cannot review without — 신청자 · 이메일 · 연락처 · 전시구분 · 작가명
// — and asked for a red star beside each. accent-ink is the page's one glyph
// colour ("every job that involves a glyph or an indicator", the brand
// guidelines), and an indicator is what this is. Hidden from the
// accessibility tree: `required` on the control is what a screen reader
// hears, and a "star" read out after every word is noise, not information.
function Star() {
  return (
    <span aria-hidden className="ml-1 text-accent-ink">
      *
    </span>
  );
}

function Section({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8 border-t border-line pt-6 first:mt-6">
      <h4 className="text-sm font-bold text-ink">{heading}</h4>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function ApplicationForm({
  hallId,
  week,
  onDone,
  onCancel,
}: {
  hallId: string;
  week: AvailabilityWeek;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [postcode, setPostcode] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [addressManual, setAddressManual] = useState(false);
  const [finding, setFinding] = useState(false);

  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [kind, setKind] = useState<ExhibitionKind>("solo");
  const [artistCount, setArtistCount] = useState("");
  const [workCount, setWorkCount] = useState("");
  const [genre, setGenre] = useState<ExhibitionGenre | "">("");
  const [genreOther, setGenreOther] = useState("");

  const [bio, setBio] = useState<BookingAttachment[]>([]);
  const [portfolio, setPortfolio] = useState<BookingAttachment[]>([]);

  const [agreed, setAgreed] = useState(false);

  // Whether either field still has a file in the air. Kept per field rather
  // than as one flag so a 약력소개 that finishes first cannot clear a 포트폴리오
  // still going up.
  const [uploading, setUploading] = useState({ bio: false, portfolio: false });
  const busy = uploading.bio || uploading.portfolio;
  // Stable, or the child's effect re-runs on every render of this form.
  const bioBusy = useCallback(
    (is: boolean) => setUploading((prior) => ({ ...prior, bio: is })),
    [],
  );
  const portfolioBusy = useCallback(
    (is: boolean) => setUploading((prior) => ({ ...prior, portfolio: is })),
    [],
  );

  const used = [...bio, ...portfolio].reduce((sum, file) => sum + file.size, 0);
  const number = (value: string) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  };

  const apply = useMutation({
    mutationFn: () =>
      postJson<BookingCreated>("/api/bookings", {
        hall_id: hallId,
        week_start: week.start,
        applicant: { name, email, phone, postcode, address1, address2 },
        exhibition: {
          title,
          artist,
          kind,
          artist_count: kind === "group" ? number(artistCount) : undefined,
          work_count: number(workCount),
          genre: genre || undefined,
          genre_other: genre === "other" ? genreOther : "",
        },
        attachments: [...bio, ...portfolio],
        terms_version: RENTAL_TERMS_VERSION,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["availability"] });
      onDone();
    },
    onError: () => {
      // Whether the week was taken mid-form or the request simply failed, the
      // grid behind this form may now be stale.
      void queryClient.invalidateQueries({ queryKey: ["availability"] });
    },
  });

  const taken = apply.error instanceof ApiError && apply.error.status === 409;
  // The gallery cannot review an application that does not say who is asking
  // and who is showing: the starred five (2026-09-10), of which these are the
  // four an applicant types — 전시구분, the fifth, opens on 개인전 and is
  // never blank, so it cannot hold the button. Everything else it can
  // telephone about, 전시명 included: a show is often still unnamed when the
  // week is asked for. Nor one sent mid-upload: `attachments` above carries
  // only the files that have already landed, so sending now files an
  // application without the portfolio it is about and leaves those bytes in
  // the bucket unclaimed, with nothing on the desk's copy to say any were
  // meant to be there. Grayed out without a word, the way it already grays
  // for a missing 작가명 — one more "not ready yet" rather than a new thing
  // to read.
  // The gallery cannot review an application that does not say who is asking
  // and who is showing: the starred set under the form's own legend, plus the
  // facts the gallery's records need — 주소(계약서 발송) · 전시장르 · 작품 수.
  // (backend/api/rentals/booking_input.php 가 같은 값을 검사합니다)
  const canSubmit = Boolean(
    agreed &&
      name &&
      email &&
      phone &&
      artist &&
      postcode &&
      address1 &&
      address2 &&
      genre &&
      (genre !== "other" || genreOther) &&
      workCount &&
      (kind !== "group" || artistCount) &&
      !apply.isPending &&
      !busy,
  );

  async function search() {
    setFinding(true);
    try {
      const found = await findAddress();
      if (found) {
        setPostcode(found.postcode);
        setAddress1(found.address);
        setAddressManual(false);
      }
    } catch {
      // A third-party script being down must never be the reason someone
      // cannot finish an application: the fields become typable instead.
      setAddressManual(true);
    } finally {
      setFinding(false);
    }
  }

  // The form opens below a grid that is twelve rows tall, so the cell just
  // tapped is often the only thing on screen and the form is nowhere. Bring
  // it up when it appears, and again when a second cell re-targets it: the
  // element is the same, only the hall and week change. Smoothly, unless the
  // visitor has asked their OS for less motion.
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    formRef.current?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "start",
    });
  }, [hallId, week.start]);

  // 기타 takes the slot beside 전시장르 for its own words, which sends 작품 수
  // down a row. It is the same question either way — written once so the
  // 20호 line cannot be dropped from one of the two places it appears.
  const workCountField = (
    <label className={LABEL}>
      {t("rental.workCount")}
      <Star />
      <input
        type="number"
        min={1}
        max={999}
        inputMode="numeric"
        value={workCount}
        onChange={(e) => setWorkCount(e.target.value)}
        className={FIELD}
      />
      <span className="mt-1 block text-sm font-normal">
        {t("rental.workCountHint")}
      </span>
    </label>
  );

  return (
    <form
      ref={formRef}
      className={`${SCROLL_MT} mt-8 animate-rise border border-line bg-surface p-5 sm:p-8`}
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) apply.mutate();
      }}
    >
      {/* The eyebrow reads as one thing with the hall name under it, so it
          takes the same ink rather than the softer label grey. */}
      <p className="text-sm font-bold text-ink">{t("rental.applyLabel")}</p>
      <h3 className="mt-4 font-display text-title font-bold">
        {t(hallNameKey(hallId))}
        <span className="mt-1 block text-ink-soft tabular-nums">
          {periodLabel(week)}
        </span>
      </h3>
      {/* What the star means, said once, before the first one appears. */}
      <p className="mt-3 text-sm text-ink-soft">{t("rental.requiredNote")}</p>

      {/* ---------------------------- 신청자 ---------------------------- */}
      <Section heading={t("rental.applicantSection")}>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className={LABEL}>
            {t("rental.name")}
            <Star />
            <input
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={FIELD}
            />
          </label>
          <label className={LABEL}>
            {t("rental.email")}
            <Star />
            <input
              required
              type="email"
              maxLength={160}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={FIELD}
            />
          </label>
          <label className={LABEL}>
            {t("rental.phone")}
            <Star />
            <input
              required
              type="tel"
              maxLength={40}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={FIELD}
            />
          </label>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-[9rem_auto]">
          <label className={LABEL}>
            {t("rental.postcode")}
            <Star />
            {addressManual ? (
              <input
                maxLength={10}
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
                className={FIELD}
              />
            ) : (
              <span className={READONLY}>{postcode || ""}</span>
            )}
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void search()}
              disabled={finding}
              className={`${BUTTON_OUTLINE} bg-surface disabled:cursor-not-allowed disabled:opacity-40`}
            >
              {finding
                ? t("rental.addressSearching")
                : t("rental.addressSearch")}
            </button>
          </div>
        </div>

        <label className={`${LABEL} mt-4`}>
          {t("rental.address1")}
          <Star />
          {addressManual ? (
            <input
              maxLength={200}
              value={address1}
              onChange={(e) => setAddress1(e.target.value)}
              className={FIELD}
            />
          ) : (
            <span className={READONLY}>{address1 || ""}</span>
          )}
        </label>
        <label className={`${LABEL} mt-4`}>
          {t("rental.address2")}
          <Star />
          <input
            required
            maxLength={200}
            value={address2}
            onChange={(e) => setAddress2(e.target.value)}
            className={FIELD}
          />
        </label>
        {addressManual && (
          <p role="status" className="mt-2 text-sm text-accent-ink">
            {t("rental.addressUnavailable")}
          </p>
        )}
      </Section>

      {/* ---------------------------- 전시 ---------------------------- */}
      <Section heading={t("rental.exhibitionSection")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <span className={LABEL}>{t("rental.wishPeriod")}</span>
            <span className={READONLY}>{periodLabel(week)}</span>
          </div>
          <div>
            <span className={LABEL}>{t("rental.hall")}</span>
            <span className={READONLY}>{t(hallNameKey(hallId))}</span>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className={LABEL}>
            {t("rental.title")}
            <input
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={FIELD}
            />
          </label>
          <label className={LABEL}>
            {t("rental.artist")}
            <Star />
            <input
              required
              maxLength={120}
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              className={FIELD}
            />
            <span className="mt-1 block text-sm font-normal">
              {t("rental.artistHint")}
            </span>
          </label>
        </div>

        <fieldset className="mt-5">
          <legend className={LABEL}>
            {t("rental.kind")}
            <Star />
          </legend>
          {/* The gallery's third word, 석·박사 청구전, is long: three pills
              each carrying a radio dot need ~347px, so the row broke onto a
              second line on every phone. The dot goes and the chosen pill is
              filled ink instead — the same "this is the one you picked" the
              table above uses — which brings the row to ~260px and fits it
              from 360px up without taking a pixel off the 14px words or the
              44px targets. */}
          <div className="mt-2 flex flex-wrap gap-2">
            {EXHIBITION_KINDS.map((choice) => (
              <label
                key={choice.value}
                className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border px-3 text-sm transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink sm:px-4 ${
                  kind === choice.value
                    ? "border-ink bg-ink font-medium text-ground"
                    : "border-line-lit text-ink-soft hover:border-ink hover:text-ink"
                }`}
              >
                {/* Real radio, kept for the keyboard and the screen reader;
                    only its dot is gone. `required` is for the reader too:
                    one pill is always chosen, so it never blocks anything,
                    but it says what the star beside the legend says. */}
                <input
                  type="radio"
                  required
                  name="exhibition-kind"
                  value={choice.value}
                  checked={kind === choice.value}
                  onChange={() => setKind(choice.value)}
                  className="sr-only"
                />
                {labelFor(choice, i18n.language)}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className={LABEL}>
            {t("rental.genre")}
            <Star />
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value as ExhibitionGenre | "")}
              className={FIELD}
            >
              <option value="">{t("rental.genrePick")}</option>
              {EXHIBITION_GENRES.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {labelFor(choice, i18n.language)}
                </option>
              ))}
            </select>
          </label>
          {/* 기타 opens a box, exactly as `se1` → `se2` does on the old form. */}
          {genre === "other" ? (
            <label className={LABEL}>
              {t("rental.genreOther")}
              <input
                maxLength={80}
                value={genreOther}
                onChange={(e) => setGenreOther(e.target.value)}
                className={FIELD}
              />
            </label>
          ) : (
            workCountField
          )}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {genre === "other" && workCountField}
          {/* Only a group show has a number of artists to give, which is the
              one place the old form's radio actually changes the questions. */}
          {kind === "group" && (
            <label className={LABEL}>
              {t("rental.artistCount")}
              <Star />
              <input
                type="number"
                min={1}
                max={999}
                inputMode="numeric"
                value={artistCount}
                onChange={(e) => setArtistCount(e.target.value)}
                className={FIELD}
              />
            </label>
          )}
        </div>
      </Section>

      {/* ---------------------------- 첨부 ---------------------------- */}
      <Section heading={t("rental.filesSection")}>
        <AttachmentField
          kind="bio"
          files={bio}
          onChange={setBio}
          totalBytes={used}
          onBusyChange={bioBusy}
        />
        <div className="mt-6">
          <AttachmentField
            kind="portfolio"
            files={portfolio}
            onChange={setPortfolio}
            totalBytes={used}
            onBusyChange={portfolioBusy}
          />
        </div>
      </Section>

      <div className="mt-8">
        <RentalTerms />
        <label className="mt-5 flex items-start gap-2.5 text-sm leading-relaxed text-ink-soft">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 accent-ink"
          />
          <span>{t("rental.agree")}</span>
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={!canSubmit}
          className={`${BUTTON_FILLED} disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-ink`}
        >
          {apply.isPending ? t("rental.submitting") : t("rental.submit")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={`min-h-11 text-sm text-ink-soft ${LINK}`}
        >
          {t("rental.cancel")}
        </button>
      </div>

      <div role="status" className="mt-3">
        {apply.isError && (
          <p className="text-sm text-accent-ink">
            {taken ? t("rental.taken") : t("rental.failed")}
          </p>
        )}
      </div>
      <p className="mt-4 border-t border-line pt-4 text-sm leading-relaxed text-ink-soft">
        {t("rental.privacy")}
      </p>
    </form>
  );
}
