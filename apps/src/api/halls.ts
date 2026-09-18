import { apiRequest } from './client'
import type { SavedArtwork } from '@/components/admin/ArtworkDropzone'

/**
 * 전시장 API.
 *
 * 전시장은 **4개 고정**입니다. (hall1~hall4 — 대관 신청서·대관 일정 표와 같은 키)
 * 관리자는 내용·사진·노출 여부만 고칩니다. (등록·삭제 없음)
 *
 * ⚠ 키·제한값은 backend/lib/hall.php 와 맞춰 주세요.
 */

/** 전시장 키 — backend/lib/hall.php 의 HALL_KEYS 와 같게 유지하세요. */
export const HALL_KEYS = ['hall1', 'hall2', 'hall3', 'hall4'] as const

export type HallKey = (typeof HALL_KEYS)[number]

/** 시즌(요금) — 화면 순서와 라벨 (원본 사이트와 같음) */
export const HALL_SEASONS = [
  { key: 'peak', label: '평수기' },
  { key: 'off', label: '비수기' },
  { key: 'high', label: '성수기' },
] as const

export type HallSeasonKey = (typeof HALL_SEASONS)[number]['key']

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

/**
 * 3D 둘러보기에서 방 평면을 줄여 보여 주는 비율.
 *
 * 실제 치수 그대로면 천장(2.8m)에 비해 바닥이 너무 넓어 사진이 작게 보입니다.
 * 사진을 벽에 이어 붙여 둘러보는 화면이라, 평면만 절반으로 줄입니다. (층고는 그대로)
 */
const STUDIO_PLAN_SCALE = 0.5

/** 전시장 사진 제한 — backend/lib/hall.php 와 동일하게 유지하세요. */
export const HALL_FILE_LIMIT = {
  label: '전시장 사진',
  max: 8,
  sizeMB: 10,
  totalMB: 80,
  accept: '.jpg,.jpeg,.png,.gif,.webp',
} as const

/** 도면·조감도 1장 (형식은 사진과 같습니다) */
export const HALL_SHEET_LIMIT = {
  sizeMB: 10,
  accept: '.jpg,.jpeg,.png,.gif,.webp',
} as const

/** [도면 내려받기] 파일 1장 — 원본 사이트와 같이 이미지(JPG)로 올립니다. */
export const HALL_PLAN_LIMIT = {
  sizeMB: 10,
  accept: '.jpg,.jpeg,.png,.gif,.webp',
} as const

/** 노출 여부 — backend/lib/hall.php 와 같게 'Y' | 'N' */
export const HALL_USE_OPTIONS = [
  { value: 'Y', label: '사용' },
  { value: 'N', label: '미사용' },
] as const

export type HallUse = (typeof HALL_USE_OPTIONS)[number]['value']

export type HallPhoto = {
  id: number
  url: string
  name: string
  width: number
  height: number
}

export type HallItem = {
  id: number
  /** hall1 ~ hall4 */
  key: string
  name: string
  /** 층 (1F · 2F · 3F · B1) */
  floor: string
  /** 규모 (181m² · 55평 (공유면적 포함) · 층고 280cm) */
  spec: string
  pricePeak: number
  monthPeak: string
  priceOff: number
  monthOff: string
  priceHigh: number
  monthHigh: string
  /** '주 단위 · VAT 포함' */
  priceNote: string
  sheetName: string
  /** 도면·조감도 이미지 주소 (uploads/hall/) */
  sheetUrl: string
  /** [도면 내려받기] 파일명 — 비어 있으면 버튼을 숨깁니다 */
  planName: string
  /** 도면 파일 확장자 (소문자 · 예: jpg) — 버튼 라벨에 씁니다 */
  planExt: string
  /** [도면 내려받기] 파일 주소 */
  planUrl: string
  useYn: string
  updatedAt: string
  photos: HallPhoto[]
}

/** 시즌 값 읽기 — 필드 이름이 바뀌면 이 함수만 고치면 됩니다. */
export function hallSeason(hall: HallItem, key: HallSeasonKey) {
  if (key === 'peak') return { price: hall.pricePeak, months: hall.monthPeak }
  if (key === 'off') return { price: hall.priceOff, months: hall.monthOff }

  return { price: hall.priceHigh, months: hall.monthHigh }
}

/** 저장된 사진 → 드롭존(saved) 모양 */
export function hallPhotoSaved(photo: HallPhoto): SavedArtwork {
  return { id: photo.id, name: photo.name, url: photo.url }
}

/**
 * 규모 문구에서 방 크기(m)를 읽습니다. (3D 둘러보기)
 *
 * '181m² · 55평 (공유면적 포함) · 층고 280cm' → 가로 12.0 · 세로 15.0 · 높이 2.8
 * 값이 없으면 원본 사이트 기본값(181m² · 층고 300cm)을 씁니다.
 * 방은 직사각형으로 근사합니다. (실제 전시장은 ㄱ자 형태입니다)
 */
export function hallSize(hall: HallItem) {
  const area = Number(/([\d.]+)\s*m²/.exec(hall.spec)?.[1] ?? 0) || 181
  const ceiling = Number(/층고\s*([\d.]+)\s*cm/.exec(hall.spec)?.[1] ?? 0) || 300

  // 가로:세로를 1:1.25 로 두고 넓이에 맞춘 뒤, 화면에서 보기 좋게 줄입니다.
  const width = clamp(Math.sqrt(area / 1.25), 4, 40) * STUDIO_PLAN_SCALE

  return {
    width,
    depth: width * 1.25,
    height: clamp(ceiling / 100, 2, 8),
  }
}

/**
 * 벽 4면에 넣을 사진을 4장씩 묶습니다. (정면 → 오른쪽 → 뒤 → 왼쪽)
 *
 * 사진이 4장을 넘으면 세트를 바꿔 가며 둘러볼 수 있습니다.
 */
export function hallPhotoSets(hall: HallItem) {
  const urls = hall.photos.map((photo) => photo.url)
  const sets: string[][] = []

  for (let index = 0; index < urls.length; index += 4) {
    sets.push(urls.slice(index, index + 4))
  }

  return sets
}

/** 전시장 수정 입력값 — backend/api/halls/update.php 의 payload */
export type HallInput = {
  name: string
  floor: string
  spec: string
  price_peak: number
  month_peak: string
  price_off: number
  month_off: string
  price_high: number
  month_high: string
  price_note: string
  use_yn: HallUse
}

/** 관리자 — 전시장 4개 */
export function fetchHallList() {
  return apiRequest<{ items: HallItem[] }>('/api/halls/list.php')
}

/** 관리자 — 전시장 1건 (사진 포함) */
export function fetchHallDetail(id: number) {
  return apiRequest<HallItem>('/api/halls/detail.php', { query: { id } })
}

/**
 * 관리자 — 전시장 수정
 *
 * @param keep  남길 사진 id (화면에 남아 있는 순서대로) — 안 넘기면 사진이 모두 지워집니다.
 * @param sheet 도면·조감도 교체 (안 넘기면 그대로)
 * @param plan  [도면 내려받기] 파일 교체 (안 넘기면 그대로)
 */
export function updateHall(
  id: number,
  input: HallInput,
  options: {
    files?: File[]
    keep?: number[]
    sheet?: File | null
    plan?: File | null
  } = {},
) {
  const form = new FormData()

  form.append('id', String(id))
  form.append('payload', JSON.stringify(input))

  for (const fileId of options.keep ?? []) form.append('keep[]', String(fileId))
  for (const file of options.files ?? []) form.append('files[]', file)

  if (options.sheet) form.append('sheet', options.sheet)
  if (options.plan) form.append('plan', options.plan)

  return apiRequest<{ id: number }>('/api/halls/update.php', { method: 'POST', form })
}

/** 공개 — 노출 중인 전시장 (인증 없음) */
export function fetchPublicHalls() {
  return apiRequest<{ items: HallItem[] }>('/api/halls/public_list.php', {
    auth: false,
  })
}
