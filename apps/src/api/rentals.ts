import { apiRequest } from './client'

/** 대관 상태 — 백엔드 lib/rental.php 와 동일하게 유지하세요. */
export const RENTAL_STATUSES = ['available', 'pending', 'approved'] as const

export type RentalStatus = (typeof RENTAL_STATUSES)[number]

/** 전시장 목록 — DB 의 wr_8 값(제N전시장(MF)) 과 정확히 일치해야 합니다. */
export const RENTAL_HALLS = [
  { id: 'hall1', label: '제1전시장(1F)' },
  { id: 'hall2', label: '제2전시장(2F)' },
  { id: 'hall3', label: '제3전시장(3F)' },
  { id: 'hall4', label: '제4전시장(B1)' },
] as const

export const RENTAL_KINDS = [
  { value: 'solo', label: '개인전' },
  { value: 'group', label: '그룹전' },
  { value: 'thesis', label: '석·박사 청구전' },
] as const

export const RENTAL_GENRES = [
  '서양화',
  '한국화',
  '공예',
  '사진',
  '조각',
  '판화',
] as const

/** 이메일 도메인 빠른 선택 — 직접 입력도 가능합니다. */
export const EMAIL_DOMAINS = [
  'naver.com',
  'gmail.com',
  'daum.net',
  'hanmail.net',
  'nate.com',
  'kakao.com',
] as const

export type RentalFileLimit = {
  label: string
  /** 최대 첨부 개수 */
  max: number
  /** 개당 최대 용량 (MB) */
  sizeMB: number
  /** 전체 최대 용량 (MB) */
  totalMB: number
  accept: string
}

/** 첨부 제한 — backend/api/rentals/bookings.php 와 동일하게 유지하세요. */
export const RENTAL_FILE_LIMITS: Record<'bio' | 'portfolio', RentalFileLimit> = {
  bio: {
    label: '약력 소개',
    max: 3,
    sizeMB: 15,
    totalMB: 100,
    accept: '.hwp,.hwpx,.txt,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.pdf',
  },
  portfolio: {
    label: '포트폴리오',
    max: 8,
    sizeMB: 10,
    totalMB: 80,
    accept: '.jpg,.jpeg,.png,.gif,.webp',
  },
}

export const RENTAL_STATUS_LABELS: Record<RentalStatus, string> = {
  available: '신청가능',
  pending: '심사중',
  approved: '대관완료',
}

export type RentalWeek = {
  start: string
  end: string
  halls: Record<string, RentalStatus>
}

export type AvailabilityResponse = {
  /** 기간 검색(unit) 으로 조회했을 때만 옵니다. */
  unit?: string
  page?: number
  weeksPerPage: number
  last: boolean
  edge: string
  weeks: RentalWeek[]
}

/** 기간 검색 단위 — backend/lib/rental.php 의 rental_units() 와 동일하게 유지하세요. */
export const RENTAL_UNITS = [
  { value: '1m', label: '1개월' },
  { value: '6m', label: '6개월' },
  { value: '1y', label: '1년' },
  { value: '2y', label: '2년' },
] as const

export type RentalUnit = (typeof RENTAL_UNITS)[number]['value']

/** 전시장별 주간 대관 가능 여부 */
export function fetchAvailability(page: number) {
  return apiRequest<AvailabilityResponse>('/api/rentals/availability.php', {
    query: { page },
    auth: false,
  })
}

/** 기간 검색 (1개월 / 6개월 / 1년 / 2년) — 이번 주부터 한 번에 가져옵니다. */
export function fetchAvailabilityRange(unit: RentalUnit) {
  return apiRequest<AvailabilityResponse>('/api/rentals/availability.php', {
    query: { unit },
    auth: false,
  })
}

export type RentalApplicant = {
  name: string
  email: string
  phone: string
  postcode: string
  address1: string
  address2: string
}

export type RentalExhibition = {
  kind: string
  /** 그룹전일 때만보냅니다. */
  artist_count?: number
  work_count?: number
  genre: string
  genre_other?: string
  memo?: string
}

export type RentalFiles = {
  bio: File[]
  portfolio: File[]
}

export type RentalBookingInput = {
  hall_id: string
  week_start: string
  applicant: RentalApplicant
  exhibition: RentalExhibition
  /** 동의한 대관 유의사항 버전 */
  terms_version: string
}

/** 대관 신청 접수 */
export function createBooking(input: RentalBookingInput, files: RentalFiles) {
  const form = new FormData()
  form.append('payload', JSON.stringify(input))

  for (const file of files.bio) form.append('bio[]', file)
  for (const file of files.portfolio) form.append('portfolio[]', file)

  return apiRequest<{ id: number }>('/api/rentals/bookings.php', {
    method: 'POST',
    form,
    auth: false,
  })
}

/* ------------------------------------------------------------------
 * 관리자
 * ------------------------------------------------------------------ */

export type RentalListItem = {
  id: number
  title: string
  applicant: string
  email: string
  phone: string
  postcode: string
  address1: string
  address2: string
  hall: string
  hallId: string | null
  kind: string
  genre: string
  memo: string
  periodStart: string
  periodEnd: string
  status: RentalStatus
  /** 관리자 확인(읽음) 여부 */
  checked: boolean
  /** 확인한 일시 (없으면 빈 문자열) */
  checkedAt: string
  createdAt: string
}

export type RentalListResponse = {
  items: RentalListItem[]
  totalCount: number
  totalPages: number
  page: number
  size: number
}

export type RentalListQuery = {
  page?: number
  size?: number
  keyword?: string
  status?: string
  hall?: string
  /** '' 전체 | 'applicant' 신청서가 있는 건만 */
  scope?: string
  /** 신청일 시작 (YYYY-MM-DD) */
  from?: string
  /** 신청일 끝 (YYYY-MM-DD) */
  to?: string
}

/** 대관 신청 목록 (관리자) */
export function fetchRentalList(query: RentalListQuery = {}) {
  return apiRequest<RentalListResponse>('/api/rentals/list.php', { query })
}

/** 서버에 저장된 첨부파일 1건 */
export type RentalAttachment = {
  /** bf_no — 남길 파일을 지정할 때 씁니다. */
  no: number
  name: string
  size: number
  url: string
}

export type RentalDetail = {
  id: number
  hallId: string | null
  hall: string
  weekStart: string
  weekEnd: string
  applicant: RentalApplicant
  exhibition: {
    kind: string
    kind_label: string
    genre: string
    memo: string
    artist_count: number
    work_count: number
  }
  files: {
    bio: RentalAttachment[]
    portfolio: RentalAttachment[]
  }
  status: RentalStatus
  createdAt: string
}

/** 대관 신청 1건 상세 (관리자) */
export function fetchRentalDetail(id: number) {
  return apiRequest<RentalDetail>('/api/rentals/detail.php', { query: { id } })
}

/**
 * 대관 신청 수정 (관리자)
 *
 * @param keep 남길 첨부의 bf_no. 여기 없는 첨부는 서버에서 지워집니다.
 */
export function updateBooking(
  id: number,
  input: RentalBookingInput,
  files: RentalFiles,
  keep: number[] = [],
) {
  const form = new FormData()
  form.append('id', String(id))
  form.append('payload', JSON.stringify(input))

  for (const no of keep) form.append('keep[]', String(no))
  for (const file of files.bio) form.append('bio[]', file)
  for (const file of files.portfolio) form.append('portfolio[]', file)

  return apiRequest<{ id: number }>('/api/rentals/update.php', {
    method: 'POST',
    form,
  })
}

/**
 * 관리자 확인(읽음) 여부 바꾸기
 *
 * @param ids     바꿀 신청 번호
 * @param checked true = 확인, false = 미확인
 */
export function setRentalChecked(ids: number[], checked: boolean) {
  return apiRequest<{ updated: number; checked: boolean }>(
    '/api/rentals/check.php',
    { method: 'POST', body: { ids, checked } },
  )
}

/**
 * 대관 신청 삭제 (관리자)
 *
 * ⚠ 첨부파일과 g4_write_order 행이 함께 지워집니다. 되돌릴 수 없습니다.
 */
export function deleteRental(ids: number[]) {
  return apiRequest<{ deleted: number; files: number }>(
    '/api/rentals/delete.php',
    { method: 'POST', body: { ids } },
  )
}
