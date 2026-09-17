import { apiRequest } from './client'

/**
 * 전시 API
 *
 * 등록(create) · 목록(list) 은 관리자 토큰이 필요합니다. (Authorization: Bearer)
 */

/**
 * 분류 — backend/lib/exhibition.php 의 EXHIBITION_STATUSES 와 동일하게 유지하세요.
 *
 *   current 현재전시 · upcoming 예정전시 · past 지난전시
 *
 * 지난전시는 날짜(종료일)가 지나면 서버가 자동으로 붙입니다.
 */
export const EXHIBITION_STATUSES = [
  { value: 'current', label: '현재전시' },
  { value: 'upcoming', label: '예정전시' },
  { value: 'past', label: '지난전시' },
] as const

export type ExhibitionStatus = (typeof EXHIBITION_STATUSES)[number]['value']

/** 등록할 때 고를 수 있는 분류 (지난전시는 자동) */
export const EXHIBITION_REGISTERED_STATUSES = [
  { value: 'current', label: '현재전시' },
  { value: 'upcoming', label: '예정전시' },
] as const satisfies readonly { value: ExhibitionStatus; label: string }[]

export type ExhibitionRegisteredStatus =
  (typeof EXHIBITION_REGISTERED_STATUSES)[number]['value']

/** 노출 여부 — 미사용(N)이면 공개 사이트에 나오지 않습니다. */
export const EXHIBITION_USE_OPTIONS = [
  { value: 'Y', label: '사용' },
  { value: 'N', label: '미사용' },
] as const

export type ExhibitionUse = (typeof EXHIBITION_USE_OPTIONS)[number]['value']

/** 작품등록(이미지) 제한 — backend/lib/exhibition.php 와 동일하게 유지하세요. */
export const EXHIBITION_FILE_LIMIT = {
  label: '작품등록',
  max: 8,
  sizeMB: 10,
  totalMB: 80,
  accept: '.jpg,.jpeg,.png,.gif,.webp',
} as const

/** 에디터 이미지 제한 — backend/lib/exhibition.php 와 동일하게 유지하세요. */
export const EXHIBITION_EDITOR_IMAGE = {
  maxMB: 10,
  accept: 'image/jpeg,image/png,image/gif,image/webp',
} as const

/** 전시 등록 입력값 — backend/api/exhibitions/create.php 의 payload */
export type ExhibitionInput = {
  title: string
  /** 등록 분류 — 날짜가 지나면 서버가 현재전시/지난전시로 자동 변경합니다. */
  status: ExhibitionRegisteredStatus
  place: string
  artist: string
  /** YYYY-MM-DD */
  start_date: string
  /** YYYY-MM-DD */
  end_date: string
  /** 전시개요 (HTML) */
  overview: string
  /** 작가 약력 (HTML) */
  bio: string
  /** 노출 여부 */
  use_yn: 'Y' | 'N'
}

/**
 * 전시 등록 (관리자)
 *
 * @param files 파일첨부 (최대 5개 · 개당 15MB)
 */
export function createExhibition(input: ExhibitionInput, files: File[] = []) {
  const form = new FormData()
  form.append('payload', JSON.stringify(input))

  for (const file of files) form.append('files[]', file)

  return apiRequest<{ id: number }>('/api/exhibitions/create.php', {
    method: 'POST',
    form,
  })
}

/**
 * 에디터에 넣을 이미지 업로드 (관리자)
 *
 * 등록을 취소하면 올린 이미지는 서버에 남습니다.
 */
export function uploadEditorImage(file: File) {
  const form = new FormData()
  form.append('image', file)

  return apiRequest<{ url: string; name: string; width: number; height: number }>(
    '/api/exhibitions/editor_image.php',
    { method: 'POST', form },
  )
}

export type ExhibitionListItem = {
  id: number
  title: string
  /** 분류 값 (current | upcoming) */
  status: string
  /** 분류 문구 (현재전시 | 예정전시) */
  statusLabel: string
  place: string
  artist: string
  /** YYYY-MM-DD (없으면 빈 문자열) */
  startDate: string
  endDate: string
  useYn: string
  hit: number
  fileCount: number
  createdAt: string
}

export type ExhibitionListResponse = {
  items: ExhibitionListItem[]
  totalCount: number
  totalPages: number
  page: number
  size: number
}

export type ExhibitionListQuery = {
  page?: number
  size?: number
  keyword?: string
  /** '' 전체 | 'Y' | 'N' */
  use_yn?: string
  /** '' 전체 | 'current' | 'upcoming' | 'past' */
  status?: string
  /** 전시기간 검색 시작 (YYYY-MM-DD) */
  from?: string
  /** 전시기간 검색 끝 (YYYY-MM-DD) */
  to?: string
}

/** 전시 목록 (관리자) */
export function fetchExhibitionList(query: ExhibitionListQuery = {}) {
  return apiRequest<ExhibitionListResponse>('/api/exhibitions/list.php', {
    query,
  })
}

/**
 * 전시 삭제 (관리자)
 *
 * ⚠ 작품 이미지 파일과 전시 정보가 함께 지워집니다. 되돌릴 수 없습니다.
 * ※ 에디터 본문에 넣은 이미지는 서버에 남습니다.
 */
export function deleteExhibitions(ids: number[]) {
  return apiRequest<{ deleted: number; files: number }>(
    '/api/exhibitions/delete.php',
    { method: 'POST', body: { ids } },
  )
}

/**
 * 전시 복사 (관리자)
 *
 * 내용과 작품 이미지가 그대로 복제되고, 제목 뒤에 ` (복사)` 가 붙습니다.
 * 복사본은 **미사용(비노출)** 으로 만들어집니다.
 */
export function copyExhibition(id: number) {
  return apiRequest<{ id: number }>('/api/exhibitions/copy.php', {
    method: 'POST',
    body: { id },
  })
}

/** 서버에 저장된 작품 이미지 1장 */
export type ExhibitionFile = {
  /** ef_id — 수정할 때 남길 이미지를 지정합니다. */
  id: number
  /** 첨부 순번 */
  no: number
  name: string
  ext: string
  size: number
  width: number
  height: number
  isImage: boolean
  url: string
}

export type ExhibitionDetail = {
  id: number
  title: string
  /** 분류 값 — 자동 분류 결과(past 포함)일 수 있습니다. */
  status: string
  statusLabel: string
  place: string
  artist: string
  /** YYYY-MM-DD */
  startDate: string
  /** YYYY-MM-DD */
  endDate: string
  /** 전시개요 (HTML) */
  overview: string
  /** 작가 약력 (HTML) */
  bio: string
  useYn: string
  hit: number
  createdAt: string
  files: ExhibitionFile[]
}

/** 전시 1건 상세 (관리자) — 수정 화면에서 씁니다. */
export function fetchExhibitionDetail(id: number) {
  return apiRequest<ExhibitionDetail>('/api/exhibitions/detail.php', {
    query: { id },
  })
}

/**
 * 전시 수정 (관리자)
 *
 * @param keep 남길 작품 이미지의 ef_id. 여기 없는 이미지는 서버에서 지워집니다.
 */
export function updateExhibition(
  id: number,
  input: ExhibitionInput,
  files: File[] = [],
  keep: number[] = [],
) {
  const form = new FormData()
  form.append('id', String(id))
  form.append('payload', JSON.stringify(input))

  for (const no of keep) form.append('keep[]', String(no))
  for (const file of files) form.append('files[]', file)

  return apiRequest<{ id: number }>('/api/exhibitions/update.php', {
    method: 'POST',
    form,
  })
}

/* --------------------------------------------------------------------------
   공개 전시 페이지 (/exhibitions · /exhibitions/:id · 홈) — 토큰 없이 부를 수 있습니다.
   -------------------------------------------------------------------------- */

/** 카드에 쓰는 전시 1건 */
export type PublicExhibitionItem = {
  id: number
  title: string
  artist: string
  place: string
  /** YYYY-MM-DD */
  startDate: string
  endDate: string
  /** current | upcoming | past */
  status: string
  statusLabel: string
  /** 대표 이미지 (없으면 빈 문자열 → 화면에서 placeholder) */
  imageUrl: string
}

export type PublicExhibitionListResponse = {
  items: PublicExhibitionItem[]
  totalCount: number
  totalPages: number
  page: number
  size: number
}

export type PublicExhibitionDetail = PublicExhibitionItem & {
  /** 전시개요 (HTML) */
  overview: string
  /** 작가 약력 (HTML) */
  bio: string
  hit: number
  files: ExhibitionFile[]
}

export type PublicExhibitionListQuery = {
  /** '' 전체 | 'current' | 'upcoming' | 'past' */
  status?: string
  page?: number
  size?: number
}

/** 공개 전시 목록 */
export function fetchPublicExhibitionList(query: PublicExhibitionListQuery = {}) {
  return apiRequest<PublicExhibitionListResponse>(
    '/api/exhibitions/public_list.php',
    { query, auth: false },
  )
}

/** 공개 전시 상세 (조회수가 1 올라갑니다) */
export function fetchPublicExhibitionDetail(id: number) {
  return apiRequest<PublicExhibitionDetail>(
    '/api/exhibitions/public_detail.php',
    { query: { id }, auth: false },
  )
}
