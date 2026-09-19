// The gallery's own application vocabulary, read off its own form.
//
// Every list here is what `bbs/write.php?bo_table=order` on galleryis.com asks
// for, in the gallery's own words and its own order. That matters more than it
// looks: an applicant who has filled the old form once is looking for the words
// they saw there, and the desk reads applications in the vocabulary it has used
// for years. "단체전" is not a translation of "그룹전" — it is a different word
// for the same thing, and the gallery did not choose it.
//
// Wire keys are English and frozen; the Korean is a label. Same rule the
// pricing tiers follow, and for the same reason: a key that can be renamed is a
// key that will be renamed, and every stored application would have to move.

/** 전시구분 — how the show is classified. The legacy field is `wr_5`. */
export const EXHIBITION_KINDS = [
  { value: "solo", ko: "개인전", en: "Solo" },
  { value: "group", ko: "그룹전", en: "Group" },
  // The gallery's own third category, and the one nobody guesses: a degree
  // show submitted for a master's or doctorate.
  { value: "degree", ko: "석·박사 청구전", en: "Degree show" },
] as const;

export type ExhibitionKind = (typeof EXHIBITION_KINDS)[number]["value"];

/** 전시장르 — the legacy `se1` select, with `기타` opening a free-text box. */
export const EXHIBITION_GENRES = [
  { value: "western", ko: "서양화", en: "Western painting" },
  { value: "korean", ko: "한국화", en: "Korean painting" },
  { value: "sculpture", ko: "조각", en: "Sculpture" },
  { value: "print", ko: "판화", en: "Printmaking" },
  { value: "photo", ko: "사진", en: "Photography" },
  { value: "craft", ko: "공예", en: "Craft" },
  { value: "media", ko: "미디어", en: "Media" },
  { value: "other", ko: "기타", en: "Other" },
] as const;

export type ExhibitionGenre = (typeof EXHIBITION_GENRES)[number]["value"];

/** Pick the label for a locale without every caller writing the ternary. */
export function labelFor(
  entry: { ko: string; en: string },
  language: string,
): string {
  return language.startsWith("en") ? entry.en : entry.ko;
}

/**
 * 약력소개 and 포트폴리오, with the gallery's own limits raised to what the
 * transport actually allows.
 *
 * The legacy form states 8 images, 4 MB each and 33 MB in total on its own
 * page, and the file counts and the type lists here are still its. The byte
 * caps are not: 4 MB is a 2008 number, and one photograph off a current phone
 * clears it. Raising a cap cannot break the gallery's promise — an applicant
 * who read "4 MB" is never turned away by a form that takes 10 — so the only
 * question was what the path can carry, and these are the answer:
 *
 * - **32 MiB** is Cloud Run's hard cap on an HTTP/1 request, and files go up
 *   one per request, so that is the ceiling for any single file.
 * - **60 seconds** is Firebase Hosting's timeout on the request in front of
 *   it, and that binds first: 10 MB is ~40 s on a weak 2 Mbps uplink, 20 MB
 *   would not land at all. This is why the caps sit where they do rather than
 *   at the ceiling, and why `AttachmentField` sends one file at a time —
 *   eight at once share the uplink and all eight time out together.
 *
 * These are the client's copy of the rules. The server enforces its own before
 * a byte is stored — this exists so a 90 MB portfolio is refused on the device
 * that chose it rather than after it has been carried across the network.
 */
export const ATTACHMENT_LIMITS = {
  bio: {
    maxFiles: 3,
    maxBytes: 15 * 1024 * 1024,
    /** hwp is the one that matters — it is what Korean CVs arrive in. */
    extensions: [
      "hwp",
      "hwpx",
      "txt",
      "ppt",
      "pptx",
      "doc",
      "docx",
      "xls",
      "xlsx",
      "pdf",
    ],
  },
  portfolio: {
    maxFiles: 8,
    maxBytes: 10 * 1024 * 1024,
    extensions: ["jpg", "jpeg", "png", "gif"],
  },
  /**
   * Across both kinds. A backstop rather than a budget an applicant has to
   * plan against: eight full 10 MB images and a 15 MB CV come to 95, so it
   * binds on nothing anyone would actually send.
   */
  maxTotalBytes: 100 * 1024 * 1024,
} as const;

export type AttachmentKind = keyof Omit<
  typeof ATTACHMENT_LIMITS,
  "maxTotalBytes"
>;

/** One stored file on an application. The bytes live in a private bucket. */
export interface BookingAttachment {
  /** Opaque id the API minted; the object name is never handed to a browser. */
  id: string;
  kind: AttachmentKind;
  /** The applicant's own filename, kept so the desk sees what they sent. */
  name: string;
  size: number;
  content_type: string;
}

/** Whether a filename's extension is one this kind of slot accepts. */
export function extensionAllowed(kind: AttachmentKind, name: string): boolean {
  const dot = name.lastIndexOf(".");
  if (dot < 0) return false;
  const ext = name.slice(dot + 1).toLowerCase();
  return (ATTACHMENT_LIMITS[kind].extensions as readonly string[]).includes(
    ext,
  );
}

/**
 * "3.1 MB" — sizes as the form and the desk show them.
 *
 * KB below a megabyte, because a 248 KB CV reading as "0.2 MB" tells the
 * applicant nothing about whether it is near the limit. One decimal up to
 * 10 MB, where it separates 3.1 from 3.9, and none above it, where it does not.
 */
export function formatBytes(bytes: number): string {
  // Nothing attached reads "0 KB", not "1 KB": the counter starts at zero and
  // rounding a real 300-byte file up to 1 KB is the only case the floor is for.
  if (bytes <= 0) return "0 KB";
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.max(1, Math.round(kb))} KB`;
  const mb = kb / 1024;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}
