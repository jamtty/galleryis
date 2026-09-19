export const SITE_NAME = "Gallery IS";

import { siteGet, sitePost } from "./backend";

// GALLERY IS, traced from the gallery's own wordmark by
// `uv run scripts/make_wordmark.py`. There is no mark to go with it: the new
// logo is still being drawn, and until it arrives the wordmark is the lockup.
export * from "./wordmark";
export * from "./postcode";
export * from "./rentalForm";
// Re-exported above for consumers; imported here because the booking types
// below are written in terms of them.
import type {
  BookingAttachment,
  ExhibitionGenre,
  ExhibitionKind,
} from "./rentalForm";
export * from "./rentalTerms";

export interface HealthResponse {
  status: string;
}

export type ExhibitionStatus = "current" | "upcoming" | "past" | "unknown";

export interface ExhibitionSummary {
  id: string;
  status: ExhibitionStatus;
  title_ko: string;
  title_en: string | null;
  artist_ko: string | null;
  artist_en: string | null;
  overview_ko: string | null;
  overview_en: string | null;
  translation: "machine" | "missing" | null;
  hall_id: string | null;
  /** The gallery's own 전시장소 words — "제 1, 2 전시장 (1F, 2F)" for a show
   *  across two floors, which has no single hall_id. */
  hall_text: string | null;
  period_text: string | null;
  start_date: string | null;
  end_date: string | null;
  images: string[] | null;
}

/** `GET /api/exhibitions/{id}` — the listing's fields plus the 약 력 block. */
export interface ExhibitionDetail extends ExhibitionSummary {
  bio_ko: string | null;
  bio_en: string | null;
  /**
   * The rich text a post written on the desk carries, sanitised by the API
   * and rendered as it stands; null on a mirrored post, whose 전시개요 and
   * 약력 are the plain `overview_*` / `bio_*` above. A page prefers the html
   * when it is there.
   */
  overview_html_ko: string | null;
  overview_html_en: string | null;
  bio_html_ko: string | null;
  bio_html_en: string | null;
}

export interface NoticeAttachment {
  url: string;
  filename: string;
}

export interface NoticeSummary {
  id: string;
  title_ko: string;
  title_en: string | null;
  body_ko: string | null;
  body_en: string | null;
  translation: "machine" | "missing" | null;
  pinned: boolean | null;
  published_at: string | null;
  views: number | null;
  attachments: NoticeAttachment[] | null;
  images: string[] | null;
  /** The legacy form's 링크 #1 / #2. Only a desk post carries them. */
  links: string[] | null;
}

/** `GET /api/notices/{id}` — the same fields the list already carries; the
 *  alias exists so a detail page names what it is reading. */
export type NoticeDetail = NoticeSummary;

/* ---- The desk's own posts (`/api/admin/exhibitions`, `/api/admin/notices`) -- */

/** Where a post came from: written on the desk, or mirrored from the
 *  legacy site. Only a desk post is editable here. */
export type PostOrigin = "desk" | "galleryis.com";

/** The origin's two exhibition boards as one choice on a desk post. */
export type ExhibitionStage = "upcoming" | "current";

/**
 * The 전시정보 write form, field for field the legacy
 * `bbs/write.php?bo_table=gallery`: 전시회명 · 전시기간 · 전시장소 · 작가명 ·
 * 전시개요 · 약력 · 파일첨부. The two prose fields are the editor's HTML; the
 * API sanitises them. The legacy form's 출력여부 boxes and URL row are left
 * out on purpose: a section prints when its field has text, and no post
 * has ever carried a URL.
 */
export interface ExhibitionBody {
  /** Which of the origin's two boards the show stands on: 예정 전시 or 현재
   *  전시. `current` promotes a show early, as moving a post onto the
   *  gallery board does; the dates still promote it on opening day, and the
   *  end date retires it whatever this says. */
  stage: ExhibitionStage;
  title: string;
  start_date: string;
  end_date: string;
  hall_text: string;
  artist: string;
  overview_html: string;
  bio_html: string;
  /** Public URLs from `POST /api/admin/media`, in order; the first is the poster. */
  images: string[];
}

/** One line of the desk's 전시 list. */
export interface AdminExhibitionRow {
  id: string;
  origin: PostOrigin;
  editable: boolean;
  status: ExhibitionStatus;
  /** Null on a mirrored post, which is moved where it lives. */
  stage: ExhibitionStage | null;
  title_ko: string;
  artist_ko: string | null;
  hall_id: string | null;
  hall_text: string | null;
  period_text: string | null;
  start_date: string | null;
  end_date: string | null;
  thumbnail: string | null;
  /** The galleryis.com page, on a mirrored post. */
  source_url: string | null;
  created_by: string | null;
  updated_at: string | null;
}

/** One post as the editor holds it: the form's own keys, ready to load. */
export interface AdminExhibition extends ExhibitionBody {
  id: string;
  origin: PostOrigin;
  editable: boolean;
  status: ExhibitionStatus;
  translation: "machine" | "missing" | null;
  source_url: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_by: string | null;
  updated_at: string | null;
}

/** A file on a notice, as the form holds it. */
export interface NoticeFile {
  filename: string;
  url: string;
}

/**
 * The 공지사항 write form, field for field the legacy
 * `bbs/write.php?bo_table=notice`: 옵션(공지) · 제목 · 내용 · 링크 #1 · 링크 #2 ·
 * 파일첨부. The body is plain text, as the legacy textarea is.
 */
export interface NoticeBody {
  title: string;
  body: string;
  pinned: boolean;
  links: string[];
  files: NoticeFile[];
}

export interface AdminNoticeRow {
  id: string;
  origin: PostOrigin;
  editable: boolean;
  title_ko: string;
  pinned: boolean;
  published_at: string | null;
  views: number | null;
  file_count: number;
  source_url: string | null;
  created_by: string | null;
  updated_at: string | null;
}

export interface AdminNotice extends NoticeBody {
  id: string;
  origin: PostOrigin;
  editable: boolean;
  published_at: string | null;
  translation: "machine" | "missing" | null;
  source_url: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_by: string | null;
  updated_at: string | null;
}

/**
 * 팝업: the picture the front page opens with, as `GET /api/popup` answers.
 *
 * One at a time, and the API is what enforces it — switching one on at the
 * desk switches any other off — so this is a single popup or nothing.
 */
export interface FrontPagePopup {
  id: string;
  title_ko: string;
  title_en: string | null;
  image_url: string;
  link_url: string | null;
  /** When it was last edited. The browser keys 「하루 동안 이 창을 다시 열지
   *  않음」 on it, so a new picture on the same popup shows again. */
  updated_at: string | null;
}

export interface PopupResponse {
  popup: FrontPagePopup | null;
}

/** The desk's popup sheet: 제목 · 그림 · 링크 · 사이트에 보이기. */
export interface PopupBody {
  title: string;
  image_url: string;
  /** Blank means the picture is not a link. `http(s)://…`, or a path of ours. */
  link_url: string;
  active: boolean;
}

export interface AdminPopupRow {
  id: string;
  title_ko: string;
  image_url: string;
  link_url: string | null;
  active: boolean;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface AdminPopup {
  id: string;
  title: string;
  image_url: string;
  link_url: string | null;
  active: boolean;
  translation: "machine" | "missing" | null;
  created_by: string | null;
  created_at: string | null;
  updated_by: string | null;
  updated_at: string | null;
}

/** What `POST /api/admin/media` answers: where the file now is. */
export interface UploadedMedia {
  url: string;
  filename: string;
  size: number;
  content_type: string;
  kind: "image" | "document";
}

/** What one read of the legacy rental schedule did to its mirror. */
export interface SyncScheduleCounts {
  /** Weeks the schedule page printed, held or not. 0 means nothing changed. */
  weeks: number;
  /** Hall-weeks it showed as 대관완료 or 심사중. */
  held: number;
  created: number;
  updated: number;
  unchanged: number;
  archived: number;
}

export interface SyncRun {
  run_id: string;
  status: "ok" | "aborted" | "busy";
  trigger: string;
  finished_at: string;
  created: number;
  updated: number;
  unchanged: number;
  archived: number;
  fetches: number;
  /** Null (or absent, on runs before 2026-09-14) when the run did not read
   *  the schedule. */
  schedule?: SyncScheduleCounts | null;
}

export interface SyncStatusResponse {
  last_run: SyncRun | null;
}

/**
 * The emergency curtain, as `/api/site-status` reports it.
 *
 * `shutdown` says the main site and the studio should draw the 점검 screen
 * instead of themselves. It is a curtain over the two front ends and nothing
 * more — the API keeps serving every endpoint while it is on.
 */
export interface SiteStatus {
  shutdown: boolean;
  updated_at: string | null;
}

/** How often an open tab re-asks whether the curtain has come down. */
export const SITE_STATUS_POLL_MS = 60_000;

/** Weekly, VAT-inclusive KRW per seasonal tier. The keys are frozen wire
 *  names that predate the gallery's own naming and must never be read as
 *  English: `peak` is 평수기 (the *regular* tier — Mar–Jun, Sep, Dec), `low`
 *  is 비수기 (Jan, Feb, Jul, Aug), and `high` is 성수기 (the true peak —
 *  Oct, Nov, the most expensive on every hall). Renaming them means
 *  migrating Firestore docs and every PWA-cached bundle at once — display
 *  labels live in i18n instead. */
export interface HallPricing {
  peak: number; // 평수기 — Mar–Jun, Sep, Dec
  low: number; // 비수기 — Jan, Feb, Jul, Aug
  high: number; // 성수기 — Oct, Nov
}

/** The seasonal tier an ISO date's month falls in (§1) — the gallery's own
 *  classification, one place for every price table and reserve sheet. */
export function tierForMonth(iso: string): keyof HallPricing {
  const month = Number(iso.slice(5, 7));
  if ([3, 4, 5, 6, 9, 12].includes(month)) return "peak";
  if ([10, 11].includes(month)) return "high";
  return "low";
}

export interface FootprintVertex {
  x: number; // metres
  z: number; // metres
}

/** The hall's entrance, on a footprint edge — the studio renders a real opening
 *  there and no artwork may be hung across it. */
export interface HallDoor {
  wall_index: number; // CCW footprint edge carrying the opening
  offset_m: number; // along that edge, edge start → opening centre
  width_cm: number; // clear opening
  height_cm: number;
}

/** A glazed span on a footprint edge — hall 1's street shopfront. Cut out of the
 *  wall like a door, and likewise a no-hang span: nothing hangs on glass. */
export interface HallWindow {
  wall_index: number; // CCW footprint edge carrying the glazing
  offset_m: number; // along that edge, edge start → glazing centre
  width_m: number;
  sill_cm: number; // floor → glass bottom (0 = down to the floor track)
  head_cm: number; // floor → glass top
}

/** The floor finish, read off each hall's own photos and isometric. */
export interface HallFloor {
  color: string; // "#rrggbb", the tile body
  tile_cm: number | null; // square module; null = jointless sheet finish
  gloss: number; // 0–1, mapped to material roughness
}

/** The reception counter, as a box aligned to the footprint axes (exact for all
 *  four halls, whose desks stand parallel to the west wall at x=0). */
export interface HallDesk {
  center: FootprintVertex; // metres
  width_m: number; // along x
  depth_m: number; // along z
  height_cm: number;
}

/** A fire extinguisher standing on the floor against a wall. Read off the
 *  halls' own photographs — the plans are leasing sheets and mark no fire
 *  equipment — so treat the position as approximate, like the footprints. */
export interface HallExtinguisher {
  wall_index: number; // CCW footprint edge it stands against
  offset_m: number; // along that edge, edge start → extinguisher centre
}

/** In-browser artwork placement, the §5 `studio_layouts` artwork vocabulary —
 *  v1 keeps it entirely client-side; the image itself never leaves the device. */
export interface ArtworkPlacement {
  wall_index: number; // CCW footprint edge, as on HallDoor
  offset_m: number; // along that edge, edge start → artwork horizontal centre
  elevation_cm: number; // floor → artwork centre
  width_cm: number;
  height_cm: number;
}

export interface Hall {
  id: string; // hall1–hall4
  floor: string; // "1F" | "2F" | "3F" | "B1"
  name_ko: string;
  name_en: string;
  area_m2: number;
  pyeong: number;
  ceiling_cm: number;
  pricing: HallPricing;
  photos: string[] | null;
  footprint: FootprintVertex[]; // CCW-intended polygon, metres
  // Null until the hall doc is re-seeded by `backfill --halls`.
  door: HallDoor | null;
  desk: HallDesk | null;
  // Empty on every hall but the ground-floor corner unit.
  windows: HallWindow[] | null;
  // `floor` is already the storey ("1F"), hence the longer name.
  floor_finish: HallFloor | null;
  extinguishers: HallExtinguisher[] | null;
}

/**
 * A cell in the rental grid. Derived per §5 — "available" is never stored.
 *
 * `reserved` and `reserved_pending` are the legacy galleryis.com order board's
 * 대관완료 and 심사중, mirrored hourly into Firestore (`legacy_bookings`) the
 * way its 전시정보 is. Precedence is reserved > reserved_pending > approved >
 * pending > available: the old site wins every cell it holds.
 *
 * The distinction is for the desk, not for visitors: the public grid prints
 * 대관완료 for `approved` and `reserved` and 심사중 for `pending` and
 * `reserved_pending`, and the desk alone marks the legacy weeks with an
 * asterisk (`대관완료*`, `심사중*`, see `apps/admin/src/lib/schedule.ts`)
 * because they are the taken weeks it cannot act on. 예약완료 was `reserved`'s
 * own word until 2026-09-09, dropped as a second vocabulary to learn for a
 * distinction that only matters once the cell is opened. Keep them apart on
 * the wire — collapsing them here would tell the desk it can release a week
 * that lives on someone else's system.
 */
export type BookingStatus =
  "available" | "pending" | "approved" | "reserved" | "reserved_pending";

/** How old the legacy-site mirror is; see `app/origin_availability.py`.
 *  Mirrored weeks hold their cells whatever this says. */
export type SourceFreshness = "live" | "stale" | "unavailable" | "disabled";

/** One Wednesday→Tuesday rental week, with each hall's state that week. */
export interface AvailabilityWeek {
  start: string; // a Wednesday, YYYY-MM-DD
  end: string; // the following Tuesday
  halls: Record<string, BookingStatus>;
}

export interface AvailabilityResponse {
  weeks: AvailabilityWeek[];
  /** The range hit the two-year cap the gallery's own grid uses. */
  truncated: boolean;
  /** How current the legacy-site schedule half is. `disabled` is not a fault
   *  — the grid should not apologise for it. */
  origin: SourceFreshness;
  origin_checked_at: string | null;
}

export interface BookingApplicant {
  name: string;
  email: string;
  phone: string;
  /** Where the gallery posts the contract, as the gallery's own form takes it:
   *  a postcode and a base address filled by the 우편번호 lookup, and the rest
   *  typed. Optional on the wire — an application missing it is still
   *  reviewable, and the desk has a phone. */
  postcode?: string;
  address1?: string;
  address2?: string;
  /** What applications filed before the form split the address carried. Read
   *  by the desk when the three fields above are absent; never written. */
  address?: string;
}

/**
 * What is actually going in the hall. The gallery cannot review an application
 * without this — a name and a week say who wants the room, not what for.
 */
export interface BookingExhibition {
  title: string;
  /** The artist, or the lead name for a group show. */
  artist: string;
  kind: ExhibitionKind;
  /** How many artists are showing. Only meaningful for a group show. */
  artist_count?: number;
  /** Roughly how many works are coming — the hang is planned off this. */
  work_count?: number;
  /** One of the gallery's own eight, or "other". */
  genre?: ExhibitionGenre;
  /** What they typed when they picked 기타. */
  genre_other?: string;
}

export interface BookingRequest {
  hall_id: string;
  week_start: string;
  applicant: BookingApplicant;
  /**
   * The 메모. Since 2026-09-09 the applicant's own form no longer asks for one
   * — the field stays on the wire because the desk writes it on a 대리 신청
   * and because applications filed before then still carry theirs.
   */
  statement?: string;
  exhibition?: BookingExhibition;
  /**
   * Which wording of 대관 유의사항 was on screen when the box was ticked. See
   * `RENTAL_TERMS_VERSION` — an agreement to terms nobody recorded is not one.
   */
  terms_version?: string;
  /** 약력소개 documents and 포트폴리오 images, already stored by
   *  `POST /api/bookings/attachments` and referenced here by id. */
  attachments?: BookingAttachment[];
}

/**
 * 대리 신청 — one week taken at the desk for someone who telephoned or walked
 * in. `POST /api/admin/bookings`.
 *
 * Three fields rather than the public body: since 2026-08-28 the
 * desk form asks the applicant nothing. Staff on the telephone were retyping
 * an address and a genre they had to ask for twice, into a form whose only
 * real job was to stop the week being sold again — so what is left is the
 * week, a free-text 메모, and the one decision only the desk can make: into
 * the queue as 심사중, or straight onto the grid as 대관완료 because the week
 * was agreed at the counter. The rest of the application is collected the way
 * it always was, on the applicant's own form.
 *
 * `terms_version` is absent for the same reason it always was — 유의사항 동의
 * is the applicant's own tick, and nobody can make it for them.
 */
export interface DeskBookingRequest extends Pick<
  BookingRequest,
  "hall_id" | "week_start"
> {
  /** Required here, unlike on the public body: it is the whole 대리 신청. */
  statement: string;
  status: "pending" | "approved";
}

export interface BookingCreated {
  id: string;
  hall_id: string;
  week_start: string;
  week_end: string;
  status: BookingStatus;
  session_id: string | null;
}

/**
 * A hanging plan on its way to the gallery: which wall each work is on, how
 * far along it, how high, and how many centimetres across. No pixels, no
 * filenames.
 */
export interface StudioSession {
  session_id: string;
  hall_id: string;
  works: ArtworkPlacement[];
}

/**
 * Where a wall stands relative to the way in — never a compass bearing.
 *
 * The footprints are traced from floor plans whose axes are flipped, and a
 * mirrored room still looks plausible from above, so "north" would be a silent
 * lie. "Left" here means left as seen standing in the doorway looking in, and
 * the assistant's reply says so out loud.
 */
export type WallRole =
  | "entrance"
  | "facing_entrance"
  | "left_of_entrance"
  | "right_of_entrance"
  | "other";

/** One wall as the assistant sees it: how long, how much of it can be hung on. */
export interface StudioAssistWall {
  wall_index: number;
  length_m: number;
  /** The widest clear span once the door, glazing and desk are cut out. */
  hangable_m: number;
  /**
   * The widest gap still free, after the works already hung are cut out too.
   *
   * The one number a visitor asks about that the model cannot derive: it needs
   * interval arithmetic over the blocked zones *and* every hung work, and
   * `gemini-3.1-flash-lite` doing arithmetic is where it is quietly wrong.
   * Computed by `freeSpanOn` so the answer is either right or absent.
   */
  free_span_m: number;
  role: WallRole;
  /** True for the wall with the largest `hangable_m` in the hall. */
  longest: boolean;
  has_window: boolean;
  has_desk: boolean;
}

/**
 * One turn of the conversation, as the browser keeps it.
 *
 * Flat `{role, text}` rather than model content parts: the server rebuilds the
 * messages array, so there is no shape in which a browser can hand the model a
 * system prompt or a fabricated tool result.
 *
 * Assistant turns carry the **reply text only, never the ops**. The ops already
 * manifested in the hall state, which is re-sent fresh every turn; storing them
 * twice lets a stale op contradict the current geometry with nothing to say
 * which is true.
 */
export interface StudioAssistTurn {
  role: "user" | "assistant";
  text: string;
}

/**
 * One hung work, as the assistant sees it: a number and a rectangle.
 *
 * Deliberately **not** the panel's `Work`. There is no `name` and no `id`
 * here: a filename is the artist's, and it has no business on the wire. The model refers to works by their 1-based
 * position in the panel, which is why the panel now shows that number.
 */
export interface StudioAssistWork extends ArtworkPlacement {
  index: number;
  orientation: "landscape" | "portrait" | "square";
}

export interface StudioAssistRequest {
  locale: string;
  message: string;
  /**
   * What was said before this, oldest first — bounded tight, because this
   * request also carries the whole hall.
   */
  history: StudioAssistTurn[];
  hall_id: string;
  ceiling_cm: number;
  walls: StudioAssistWall[];
  works: StudioAssistWork[];
  selected_index: number | null;
}

/**
 * One step of a plan. `remove` is deliberately absent: deleting a work also
 * deletes its image from this device, and no misheard sentence should be able
 * to do that.
 */
export type StudioAssistOpKind = "select" | "resize" | "move" | "arrange";

/**
 * Every field but `op` is optional, and every number is a *proposal*. The
 * studio re-resolves all of them through `placement.ts`, so nothing here can
 * put a work through a doorway or past a corner.
 */
export interface StudioAssistOp {
  op: StudioAssistOpKind;
  /** 1-based, matching `StudioAssistWork.index`. */
  index?: number | null;
  /** The long side, whichever that is for this work's aspect. */
  long_side_cm?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;
  /** The 호 series, resolved against the photograph's own aspect. */
  ho?: number | null;
  wall_index?: number | null;
  /** Null asks the studio to choose the spot. */
  offset_m?: number | null;
  elevation_cm?: number | null;
  /**
   * Relative nudges, for "조금 더 위로" and its kind.
   *
   * Resolved against the work's *current* value in the browser and then handed
   * to the same `updateSize`/`moveTo` an absolute goes through, so a delta that
   * lands past a corner is clamped exactly as an absolute would be. They exist
   * so the model never has to compute `152 + 10` — the studio does the addition.
   *
   * An absolute wins where both are given: a stated measurement is more
   * specific than a nudge, and a plan carrying both has contradicted itself.
   */
  elevation_delta_cm?: number | null;
  offset_delta_m?: number | null;
  /** Percentage of the current long side — 120 is "a bit bigger". */
  scale_pct?: number | null;
  /**
   * On `arrange`: metres of air to leave between neighbours.
   *
   * Without it the hang divides *all* the free wall equally, which is the
   * right default and also why "촘촘하게 붙여봐" was previously inexpressible —
   * a second arrange returned byte-identical positions and the model reported
   * a change that had not happened.
   */
  gap_m?: number | null;
}

/** Why a plan came back empty, when it did. */
export type StudioAssistNote =
  "" | "ambiguous" | "unsupported" | "not_found" | "unparsed";

export interface StudioAssistPlan {
  /** One sentence, in the locale that was asked for. */
  reply: string;
  ops: StudioAssistOp[];
  /** Which work to walk the visitor round to, 1-based. */
  focus: number | null;
  note: StudioAssistNote;
  /**
   * Up to three things the visitor might say next, each short enough to be a
   * chip. Tapping one sends it — unlike a spoken sentence, a chip is text the
   * visitor read and chose, so there is nothing to mishear.
   *
   * The browser overrules these where a rule does better (the work numbers
   * after a `not_found`) and supplies its own where the request never got an
   * answer at all, so chips exist exactly when the visitor is most stuck.
   */
  suggestions: string[];
}

/** How an application is decided. `pending` is where every one starts. */
export type ReviewStatus = "pending" | "approved" | "rejected";

/**
 * One application as the gallery's desk sees it. Unlike every public shape in
 * this file it carries the applicant's contact details, so it is only ever
 * served from `/api/admin/*`.
 */
export interface AdminBooking {
  id: string;
  hall_id: string;
  week_start: string;
  week_end: string;
  status: ReviewStatus;
  /** Partial, because a 대리 신청 carries none of it: the desk records the
   *  week and a 메모 and telephones. Every field is present on anything the
   *  applicant's own form filed. */
  applicant: Partial<BookingApplicant>;
  /** The applicant's 메모, or — on a 대리 신청 — what the desk was told. */
  statement: string;
  /** Null on applications filed before the form asked for it. */
  exhibition: BookingExhibition | null;
  /** Which 유의사항 wording they agreed to, or null if it went unrecorded. */
  terms_version: string | null;
  /** 약력소개 and 포트폴리오, read back through the desk's own credentials. */
  attachments: BookingAttachment[];
  /** The hanging plan they sent, if they sent one. */
  session_id: string | null;
  /** The admin who typed this in on the applicant's behalf, and the door it
   *  came through (`"desk"`). Both null on everything the public form filed —
   *  the queue reads them to say who took the application rather than letting
   *  a desk-typed one pass as something the applicant sent. */
  created_by: string | null;
  created_via: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string | null;
}

/** One visitor's verdict on one answer from the studio's 도우미, as the desk's
 *  의견 page reads it. */
export interface AssistantFeedback {
  id: string;
  verdict: "up" | "down";
  /** The words, when the visitor went on to write any. */
  note: string;
  question: string;
  answer: string;
  /** The hall, and what the studio did with the plan the answer described.
   *  `applied` 0 with drops present is the case worth reading — the reply
   *  described a hall that did not move. */
  hall_id: string | null;
  applied: number | null;
  drops: string[];
  at: string | null;
}

export interface FeedbackPage {
  items: AssistantFeedback[];
  /** The id to ask for the next page with, or null at the end. */
  next: string | null;
}

/** Thrown by postJson so callers can tell a booking race (409) from a failure. */
export class ApiError extends Error {
  // A plain field rather than a parameter property: the workspace builds with
  // `erasableSyntaxOnly`, which rules those out.
  readonly status: number;
  /**
   * What the API said in its envelope, `{error: {message}}`, when it said
   * anything: the Korean sentence a route refused with, or a readable list of
   * the fields a body failed on. Undefined when the body was not the
   * envelope. Kept apart from `message`, which stays `API responded <status>`
   * because one call site sniffs it (studio HallView's not-found branch).
   */
  readonly detail: string | undefined;

  constructor(status: number, detail?: string) {
    super(`API responded ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

/**
 * The ApiError for a failed response, carrying the envelope's message when
 * the body is one. Reading the body is best effort: a proxy's HTML 502 or an
 * empty 204 is simply an error with no detail.
 */
export async function readApiError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as { error?: { message?: unknown } };
    const message = body?.error?.message;
    return new ApiError(
      res.status,
      typeof message === "string" && message ? message : undefined,
    );
  } catch {
    return new ApiError(res.status);
  }
}

/**
 * GET — 주소는 원본 사이트(`/api/...`) 그대로 두고, 실제 처리는 `./backend.ts`
 * 가 우리 PHP 백엔드로 옮겨 부릅니다.
 */
export async function fetchJson<T>(
  url: string,
  _init?: RequestInit,
): Promise<T> {
  const { status, message, data } = await siteGet(url);
  // ApiError, not a plain Error, so a caller can tell 404 from 403 from 500
  // without reading the message.
  if (status < 200 || status >= 300) throw new ApiError(status, message);
  return data as T;
}

/** 쓰기 요청도 같은 어댑터를 지납니다. 지금은 대관 신청 하나뿐입니다. */
async function sendJson<T>(
  method: string,
  url: string,
  body: unknown,
  _init?: RequestInit,
): Promise<T> {
  if (method !== "POST") {
    throw new ApiError(405, "지원하지 않는 요청입니다.");
  }

  const { status, message, data } = await sitePost(url, body);

  // Status carried on the error: a 409 is a lost race the UI recovers from,
  // anything else is a failure it reports, with the backend's own words when
  // it gave any.
  if (status < 200 || status >= 300) throw new ApiError(status, message);
  return data as T;
}

export function postJson<T>(
  url: string,
  body: unknown,
  init?: RequestInit,
): Promise<T> {
  return sendJson<T>("POST", url, body, init);
}

export function patchJson<T>(
  url: string,
  body: unknown,
  init?: RequestInit,
): Promise<T> {
  return sendJson<T>("PATCH", url, body, init);
}

/** PUT, for the one setting that is replaced wholesale rather than amended. */
export function putJson<T>(
  url: string,
  body: unknown,
  init?: RequestInit,
): Promise<T> {
  return sendJson<T>("PUT", url, body, init);
}

/** Pick the localized variant of a paired *_ko/*_en field, falling back to Korean. */
export function pick<T extends object>(
  item: T,
  field: string,
  lang: string,
): string {
  const record = item as Record<string, unknown>;
  const en = record[`${field}_en`];
  const ko = record[`${field}_ko`];
  return (
    lang === "en" && typeof en === "string" && en ? en : (ko ?? "")
  ) as string;
}
