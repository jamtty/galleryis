/**
 * 원본 사이트(공개 화면)의 데이터 계층 ↔ 우리 PHP 백엔드 연결.
 *
 * 원본 공개 화면은 Firebase/Cloud Run 의 `/api/...` 를 부릅니다. 이 파일이 그
 * 주소와 응답 모양을 우리 `backend/` 의 엔드포인트로 옮겨 줍니다.
 *  - 주소 매핑: `/api/halls` → `/backend/api/halls/public_list.php` 등
 *  - 모양 매핑: 우리 응답(PublicExhibitionItem 등) → 원본 타입(ExhibitionSummary 등)
 *
 * 화면 코드(components/*, pages/*)는 원본 그대로 두고 여기서만 맞춥니다.
 */
import {
  fetchPublicExhibitionDetail,
  fetchPublicExhibitionList,
  type PublicExhibitionItem,
} from '@/api/exhibitions'
import { fetchPublicHalls, type HallItem } from '@/api/halls'
import {
  fetchPublicNoticeDetail,
  fetchPublicNoticeList,
  type PublicNoticeItem,
} from '@/api/notices'
import { fetchActivePopups } from '@/api/popups'
import { packRentalMemo } from '@/lib/rentalMemo'
import { HALL_PLANS } from './hallPlans'
import {
  createBooking,
  fetchAvailability,
  type AvailabilityResponse as BackendAvailability,
  type RentalBookingInput,
} from '@/api/rentals'
import { takePendingFiles, type PendingFiles } from './pendingAttachments'
import type {
  AvailabilityResponse,
  AvailabilityWeek,
  BookingAttachment,
  BookingStatus,
  ExhibitionDetail,
  ExhibitionSummary,
  Hall,
  NoticeDetail,
  NoticeSummary,
  PopupResponse,
  SiteStatus,
} from './index'

/** 목록에서 한 번에 받아 오는 건수 — 원본은 한 목록을 통째로 받았습니다. */
const LIST_SIZE = 100

/** 원본의 대관 달력은 12주씩 한 페이지입니다 (components/Rental.tsx). */
const WEEKS_PER_PAGE = 12

/**
 * 전시장 정보 + 우리 관리자에서 올린 도면 (원본에는 없는 값).
 *
 * 원본은 `/hall-sheets/hall1.jpg` 같은 고정 파일을 썼지만, 우리는 관리자에서
 * 도면·조감도를 올려 관리하므로, 있으면 그것을 씁니다.
 */
export type SiteHall = Hall & {
  sheet_url: string | null
  plan_url: string | null
  plan_name: string | null
}

/** `/api/...` 를 우리 엔드포인트로 옮겨 부른 결과. */
export type SiteOutcome = {
  status: number
  message?: string
  data?: unknown
}

class UnknownSiteRoute extends Error {}

/** 자주 나오는 이름 엔티티 (모르는 이름은 그대로 둡니다) */
const NAMED_ENTITIES: Record<string, string> = {
  nbsp: '\u00a0',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
}

/**
 * 레거시 게시판 글에 남아 있는 엔티티(`&#65517;` · `&nbsp;`)를 원래 글자로
 * 되돌립니다.
 *
 * euc-kr 컬럼에는 이모지·반각 기호를 담을 수 없어서, **저장할 때** `&#NNNN;`
 * 로 바꿔 둡니다(backend/lib/notice.php 의 `notice_legacy_html` — "화면에서는
 * 브라우저가 원래 글자로 되돌려 그린다"). 관리자 화면은 그 본문을 HTML 로
 * 그리므로 저절로 되돌아가지만, 공개 화면은 원본 UI 그대로 **글자로** 그리기
 * 때문에 `&#65517;` 이 그대로 보입니다. 그래서 여기서 되돌려 줍니다.
 *
 * ⚠ HTML 본문(전시 개요·약력)에는 쓰지 마세요 — `&amp;lt;` 같은 것이 두 번
 * 풀려 버립니다.
 */
function decodeEntities(text: string): string {
  return text.replace(
    /&(#[0-9]+|#x[0-9a-f]+|[a-z][a-z0-9]*);/gi,
    (whole: string, body: string) => {
      if (body.startsWith('#')) {
        const hex = body[1] === 'x' || body[1] === 'X'
        const code = Number.parseInt(hex ? body.slice(2) : body.slice(1), hex ? 16 : 10)

        if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return whole

        try {
          return String.fromCodePoint(code)
        } catch {
          return whole
        }
      }

      return NAMED_ENTITIES[body.toLowerCase()] ?? whole
    },
  )
}

/* --------------------------------------------------------------------------
   GET
   -------------------------------------------------------------------------- */

/** 원본 `fetchJson` 이 부르는 주소를 받아 그대로 처리합니다. */
export async function siteGet(url: string): Promise<SiteOutcome> {
  try {
    return { status: 200, data: await dispatchGet(url) }
  } catch (err) {
    return {
      status: (err as { status?: number }).status ?? 0,
      message: err instanceof Error ? err.message : undefined,
    }
  }
}

/** 원본 `postJson` 이 부르는 주소를 받아 그대로 처리합니다. */
export async function sitePost(
  url: string,
  body: unknown,
): Promise<SiteOutcome> {
  try {
    if (url === '/api/bookings') {
      return { status: 200, data: await createBookingFromSite(body) }
    }

    throw new UnknownSiteRoute(`알 수 없는 요청입니다: ${url}`)
  } catch (err) {
    return {
      status: (err as { status?: number }).status ?? 0,
      message: err instanceof Error ? err.message : undefined,
    }
  }
}

async function dispatchGet(url: string): Promise<unknown> {
  const [path, search] = url.split('?')
  const query = new URLSearchParams(search ?? '')

  switch (path) {
    case '/api/exhibitions': {
      const status = query.get('status') ?? 'current'
      const res = await fetchPublicExhibitionList({
        status,
        page: 1,
        size: LIST_SIZE,
      })

      return res.items.map(toExhibitionSummary)
    }

    case '/api/notices': {
      const res = await fetchPublicNoticeList({ page: 1, size: LIST_SIZE })

      return res.items.map(toNoticeSummary)
    }

    case '/api/halls':
      return (await fetchPublicHalls()).items.map(toHall)

    case '/api/popup':
      return toPopup()

    // 우리 백엔드에는 긴급 정지 기능이 없습니다. (항상 정상)
    case '/api/site-status':
      return { shutdown: false, updated_at: null } satisfies SiteStatus

    case '/api/availability': {
      const page = pageFromRange(Number(query.get('page') ?? '0'), query.get('from'))
      const res = await fetchAvailability(page)

      return toAvailability(res)
    }

    default:
      break
  }

  const hall = /^\/api\/halls\/(.+)$/.exec(path)

  if (hall) {
    const key = decodeURIComponent(hall[1])
    const items = (await fetchPublicHalls()).items
    const found = items.find((item) => item.key === key)

    // 없는 전시장은 404 — 화면이 "찾을 수 없습니다" 를 보여 줍니다.
    if (!found) {
      const missing = new Error('해당 전시장을 찾을 수 없습니다.') as Error & {
        status: number
      }
      missing.status = 404
      throw missing
    }

    return toHall(found)
  }

  const exhibition = /^\/api\/exhibitions\/(.+)$/.exec(path)

  if (exhibition) {
    return toExhibitionDetail(
      await fetchPublicExhibitionDetail(Number(decodeURIComponent(exhibition[1]))),
    )
  }

  const notice = /^\/api\/notices\/(.+)$/.exec(path)

  if (notice) {
    return toNoticeDetail(
      await fetchPublicNoticeDetail(Number(decodeURIComponent(notice[1]))),
    )
  }

  throw new UnknownSiteRoute(`알 수 없는 요청입니다: ${url}`)
}

/* --------------------------------------------------------------------------
   전시
   -------------------------------------------------------------------------- */

function toExhibitionSummary(item: PublicExhibitionItem): ExhibitionSummary {
  return {
    id: String(item.id),
    status: item.status as ExhibitionSummary['status'],
    title_ko: decodeEntities(item.title),
    // 우리 백엔드는 영문 제목을 따로 두지 않습니다. (화면은 한국어를 씁니다)
    title_en: null,
    artist_ko: item.artist ? decodeEntities(item.artist) : null,
    artist_en: null,
    // 목록에는 전시개요가 없습니다. (원본도 목록에서는 쓰지 않습니다)
    overview_ko: null,
    overview_en: null,
    translation: 'missing',
    // 전시장소는 관리자가 적은 글을 그대로 보여 줍니다.
    hall_id: null,
    hall_text: item.place ? decodeEntities(item.place) : null,
    period_text: periodText(item.startDate, item.endDate),
    start_date: item.startDate || null,
    end_date: item.endDate || null,
    images: item.imageUrl ? [item.imageUrl] : null,
  }
}

function toExhibitionDetail(
  detail: Awaited<ReturnType<typeof fetchPublicExhibitionDetail>>,
): ExhibitionDetail {
  const images = detail.files.map((file) => file.url)

  return {
    ...toExhibitionSummary(detail),
    // 전시개요·약력은 관리자 에디터가 쓴 HTML 입니다.
    overview_html_ko: detail.overview || null,
    overview_en: null,
    overview_html_en: null,
    bio_ko: null,
    bio_html_ko: detail.bio || null,
    bio_en: null,
    bio_html_en: null,
    images: images.length > 0 ? images : detail.imageUrl ? [detail.imageUrl] : null,
  }
}

/** "2026.08.05 ~ 09.30" — 원본이 카드에 쓰는 모양 */
function periodText(start: string, end: string): string | null {
  if (!start && !end) return null

  const dot = (value: string) => value.replaceAll('-', '.')
  if (start && end) return `${dot(start)} ~ ${dot(end)}`

  return dot(start || end)
}

/* --------------------------------------------------------------------------
   소식
   -------------------------------------------------------------------------- */

/** 소식 목록 1건 — 첨부 개수는 우리 목록 API 에만 있습니다. */
export type SiteNoticeSummary = NoticeSummary & { file_count: number }

function toNoticeSummary(item: PublicNoticeItem): SiteNoticeSummary {
  return {
    id: String(item.id),
    title_ko: decodeEntities(item.title),
    title_en: null,
    body_ko: null,
    body_en: null,
    translation: 'missing',
    pinned: item.pinned,
    published_at: item.createdAt,
    views: item.hit,
    attachments: null,
    images: null,
    links: null,
    file_count: item.fileCount,
  }
}

function toNoticeDetail(
  detail: Awaited<ReturnType<typeof fetchPublicNoticeDetail>>,
): NoticeDetail {
  const links = [detail.link1, detail.link2].filter(Boolean)

  return {
    ...toNoticeSummary({
      id: detail.id,
      title: detail.title,
      pinned: detail.pinned,
      author: detail.author,
      hit: detail.hit,
      fileCount: detail.files.length,
      hasLink: links.length > 0,
      createdAt: detail.createdAt,
    }),
    // 본문은 에디터가 쓴 HTML 이거나 옛 평문입니다. (RichText 가 판단합니다)
    // 옛 본문의 `&#65517;` 같은 엔티티는 여기서 글자로 되돌립니다.
    body_ko: detail.content ? decodeEntities(detail.content) : null,
    attachments: detail.files.map((file) => ({
      url: file.url,
      filename: decodeEntities(file.name),
    })),
    links: links.length > 0 ? links : null,
  }
}

/* --------------------------------------------------------------------------
   전시장
   -------------------------------------------------------------------------- */

function toHall(hall: HallItem): SiteHall {
  const area = Number(/([\d.]+)\s*m²/.exec(hall.spec)?.[1] ?? 0)
  const pyeong = Number(/([\d.]+)\s*평/.exec(hall.spec)?.[1] ?? 0)
  const ceiling = Number(/층고\s*([\d.]+)\s*cm/.exec(hall.spec)?.[1] ?? 0)

  return {
    id: hall.key,
    floor: hall.floor,
    name_ko: hall.name,
    name_en: hall.name,
    area_m2: area || 0,
    pyeong: pyeong || 0,
    ceiling_cm: ceiling || 0,
    pricing: {
      // peak 평수기 · low 비수기 · high 성수기 (lib/pricing.ts 의 TIERS)
      peak: hall.pricePeak,
      low: hall.priceOff,
      high: hall.priceHigh,
    },
    photos: hall.photos.length > 0 ? hall.photos.map((photo) => photo.url) : null,
    // 3D 둘러보기(원본 스튜디오)는 **정밀 도면 좌표**로 방을 만듭니다. 우리
    // 관리자 DB 에는 없는 값이라, 원본 공개 API 에서 받아 둔 것을 씁니다.
    // (src/shared/hallPlans.ts — 사진·요금은 우리 DB 가 원천입니다)
    ...hallPlan(hall.key),
    sheet_url: hall.sheetUrl || null,
    plan_url: hall.planUrl || null,
    plan_name: hall.planName || null,
  }
}

/** 도면 좌표 — 없으면 방을 못 그리므로 빈 폴리곤으로 둡니다. */
function hallPlan(key: string): Pick<
  Hall,
  'footprint' | 'door' | 'desk' | 'windows' | 'floor_finish' | 'extinguishers'
> {
  const plan = HALL_PLANS[key]

  return {
    footprint: plan ? plan.footprint.map((point) => ({ ...point })) : [],
    door: plan?.door ? { ...plan.door } : null,
    desk: plan?.desk ? { ...plan.desk, center: { ...plan.desk.center } } : null,
    windows: plan?.windows ? plan.windows.map((item) => ({ ...item })) : null,
    floor_finish: plan?.floor_finish ? { ...plan.floor_finish } : null,
    extinguishers: plan?.extinguishers
      ? plan.extinguishers.map((item) => ({ ...item }))
      : null,
  }
}

/* --------------------------------------------------------------------------
   팝업
   -------------------------------------------------------------------------- */

async function toPopup(): Promise<PopupResponse> {
  // 우리 백엔드는 여러 개를 켤 수 있지만, 원본 첫 화면은 한 장만 띄웁니다.
  const [first] = await fetchActivePopups()

  if (!first) return { popup: null }

  return {
    popup: {
      id: String(first.id),
      title_ko: first.title,
      title_en: null,
      image_url: first.imageUrl,
      link_url: first.url || null,
      updated_at: null,
    },
  }
}

/* --------------------------------------------------------------------------
   대관 (가용성 · 신청)
   -------------------------------------------------------------------------- */

/**
 * 원본은 `from`/`to` 날짜로 12주씩 잘라 부릅니다. 우리 백엔드는 같은 12주씩
 * `page` 로 받으므로, 날짜 차이를 페이지 번호로 되돌립니다.
 */
function pageFromRange(page: number, from: string | null): number {
  if (page > 0) return page
  if (!from) return 0

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const start = new Date(`${from}T00:00:00`)
  if (Number.isNaN(start.getTime())) return 0

  const days = Math.round((start.getTime() - today.getTime()) / 86_400_000)

  return Math.max(0, Math.round(days / (WEEKS_PER_PAGE * 7)))
}

function toAvailability(res: BackendAvailability): AvailabilityResponse {
  const weeks: AvailabilityWeek[] = res.weeks.map((week) => {
    const halls: Record<string, BookingStatus> = {}

    for (const [hallId, cell] of Object.entries(week.halls)) {
      halls[hallId] = cell.status as BookingStatus
    }

    return { start: week.start, end: week.end, halls }
  })

  return {
    weeks,
    truncated: !res.last,
    // 우리 일정은 우리 DB 가 원본입니다. (복제 지연 없음)
    origin: 'live',
    origin_checked_at: null,
  }
}

/**
 * 원본 신청서의 낱말 → 우리 백엔드의 낱말.
 *
 * 원본 화면은 전시구분을 `degree`, 전시장르를 `western` 같은 **영문 키**로
 * 보냅니다. 우리 백엔드와 레거시 DB(`g4_write_order`) 는 전시구분 키를
 * `thesis`, 장르를 `서양화` 같은 **한글 낱말**로 씁니다 — 관리자 화면과 그동안
 * 쌓인 신청서가 그 낱말에 맞춰져 있습니다. 그래서 화면과 백엔드 사이인 여기서
 * 옮깁니다. (안 옮기면 '석·박사 청구전' 신청은 422 로 막힙니다)
 *
 *   전시구분 : solo · group · degree  →  solo · group · thesis
 *   전시장르 : western · korean · sculpture · print · photo · craft · media · other
 *              →  서양화 · 한국화 · 조각 · 판화 · 사진 · 공예 · 미디어 · other
 *
 * `other` 는 장르 이름이 아니라 '직접 입력' 표시입니다. 백엔드가 genre_other 를
 * 대신 장르로 씁니다.
 */
const BACKEND_KINDS: Record<string, string> = {
  solo: 'solo',
  group: 'group',
  degree: 'thesis',
}

const BACKEND_GENRES: Record<string, string> = {
  western: '서양화',
  korean: '한국화',
  sculpture: '조각',
  print: '판화',
  photo: '사진',
  craft: '공예',
  media: '미디어',
  other: 'other',
}

/** 모르는 낱말은 그대로 넘겨 백엔드가 422 로 걸러 내게 합니다. */
function backendKind(kind: string): string {
  return BACKEND_KINDS[kind] ?? kind
}

function backendGenre(genre: string | undefined): string {
  if (!genre) return ''

  return BACKEND_GENRES[genre] ?? genre
}

/** 원본 신청서의 본문 → 우리 `POST /api/rentals/bookings.php` payload */
async function createBookingFromSite(body: unknown): Promise<{ id: string }> {
  const payload = body as {
    hall_id: string
    week_start: string
    applicant: {
      name: string
      email: string
      phone: string
      postcode?: string
      address1?: string
      address2?: string
    }
    exhibition: {
      title?: string
      artist?: string
      kind: string
      artist_count?: number
      work_count?: number
      genre?: string
      genre_other?: string
    }
    attachments?: BookingAttachment[]
    terms_version: string
  }

  const files: PendingFiles = takePendingFiles(payload.attachments ?? [])

  const input: RentalBookingInput = {
    hall_id: payload.hall_id,
    week_start: payload.week_start,
    applicant: {
      name: payload.applicant.name,
      email: payload.applicant.email,
      phone: payload.applicant.phone,
      postcode: payload.applicant.postcode ?? '',
      address1: payload.applicant.address1 ?? '',
      address2: payload.applicant.address2 ?? '',
    },
    exhibition: {
      kind: backendKind(payload.exhibition.kind),
      artist_count: payload.exhibition.artist_count,
      work_count: payload.exhibition.work_count,
      genre: backendGenre(payload.exhibition.genre),
      genre_other: payload.exhibition.genre_other ?? '',
      // 우리 백엔드의 메모(wr_3)로 갑니다. 공개 신청서에는 메모 칸이 없고
      // 전시명·작가명만 있으므로 둘을 여기에 담아 두면, 관리자 수정 화면이
      // 같은 모양으로 읽고 씁니다. (src/lib/rentalMemo.ts)
      memo: packRentalMemo({
        title: payload.exhibition.title,
        artist: payload.exhibition.artist,
      }),
    },
    terms_version: payload.terms_version,
  }

  const created = await createBooking(input, files)

  return { id: String(created.id) }
}
