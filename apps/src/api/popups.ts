import { apiRequest } from './client'

/**
 * 팝업 API — backend/lib/popup.php (popup_banner 테이블) 에 연결됩니다.
 *
 * 목록 · 상세 · 등록 · 수정 · 삭제는 관리자 토큰이 필요하고,
 * 공개 사이트용 active 만 토큰 없이 부를 수 있습니다.
 */

/** 팝업 이미지 제한 — backend/lib/popup.php 와 동일하게 유지하세요. */
export const POPUP_IMAGE_LIMIT = {
  label: '팝업 이미지',
  sizeMB: 10,
  accept: 'image/jpeg,image/png,image/gif,image/webp',
} as const

/** 정렬 순서 선택값 — backend/lib/popup.php 의 POPUP_SORT_MAX 와 동일하게 유지하세요. */
export const POPUP_SORT_OPTIONS = Array.from({ length: 10 }, (_, index) => index + 1)

/** 링크 대상 */
export const POPUP_LINK_TARGETS = [
  { value: '_self', label: '현재 창' },
  { value: '_blank', label: '새 창' },
] as const

/** 사용 여부 */
export const POPUP_USE_OPTIONS = [
  { value: 'Y', label: '사용' },
  { value: 'N', label: '미사용' },
] as const

export type PopupUse = (typeof POPUP_USE_OPTIONS)[number]['value']

/** 등록·수정 입력값 — backend/api/popups/create.php 의 payload */
export type PopupInput = {
  title: string
  /** 클릭 시 이동 주소 (빈 값이면 링크 없음) */
  url: string
  link_target: string
  /** YYYY-MM-DD (빈 값이면 상한 없음) */
  period_start: string
  /** YYYY-MM-DD (빈 값이면 상한 없음) */
  period_end: string
  use_yn: PopupUse
  sort_order: number
  /** 노출 위치 px — 0 이면 가운데 */
  img_pos_left: number
  img_pos_top: number
}

/** 팝업 1건 (관리자 응답) */
export type PopupItem = {
  id: number
  title: string
  url: string
  linkTarget: string
  /** YYYY-MM-DD (없으면 빈 문자열) */
  periodStart: string
  periodEnd: string
  useYn: string
  sortOrder: number
  posLeft: number
  posTop: number
  imageName: string
  imageUrl: string
  width: number
  height: number
  createdAt: string
  updatedAt: string
}

export type PopupListResponse = {
  items: PopupItem[]
  totalCount: number
  totalPages: number
  page: number
  size: number
}

export type PopupListQuery = {
  page?: number
  size?: number
  keyword?: string
  /** '' 전체 | 'Y' | 'N' */
  use_yn?: string
  /** 노출기간 검색 시작 (YYYY-MM-DD) */
  from?: string
  /** 노출기간 검색 끝 (YYYY-MM-DD) */
  to?: string
}

/** 팝업 목록 (관리자) */
export function fetchPopupList(query: PopupListQuery = {}) {
  return apiRequest<PopupListResponse>('/api/popups/list.php', { query })
}

/** 팝업 상세 (관리자) */
export function fetchPopupDetail(id: number) {
  return apiRequest<PopupItem>('/api/popups/detail.php', { query: { id } })
}

/** 공개 사이트에 띄울 팝업 (인증 없음) */
export type ActivePopup = Pick<
  PopupItem,
  'id' | 'title' | 'url' | 'linkTarget' | 'posLeft' | 'posTop' | 'imageUrl' | 'width' | 'height'
>

export function fetchActivePopups() {
  return apiRequest<ActivePopup[]>('/api/popups/active.php', { auth: false })
}

/** 팝업 등록 (관리자) — 이미지는 1장 필수 */
export function createPopup(input: PopupInput, image: File) {
  const form = new FormData()
  form.append('payload', JSON.stringify(input))
  form.append('image', image)

  return apiRequest<{ id: number }>('/api/popups/create.php', {
    method: 'POST',
    form,
  })
}

/** 팝업 수정 (관리자) — 이미지를 보내지 않으면 기존 이미지를 유지합니다. */
export function updatePopup(id: number, input: PopupInput, image?: File | null) {
  const form = new FormData()
  form.set('id', String(id))
  form.append('payload', JSON.stringify(input))

  if (image) form.append('image', image)

  return apiRequest<{ id: number }>('/api/popups/update.php', {
    method: 'POST',
    form,
  })
}

/** 사용 여부 변경 (목록의 토글) */
export function setPopupUse(id: number, useYn: PopupUse) {
  return apiRequest<{ id: number; useYn: string }>('/api/popups/display.php', {
    method: 'POST',
    body: { id, use_yn: useYn },
  })
}

/** 팝업 삭제 (여러 건 가능) — 이미지 파일도 함께 지워집니다. */
export function deletePopups(ids: number[]) {
  return apiRequest<{ deleted: number; files: number }>('/api/popups/delete.php', {
    method: 'POST',
    body: { ids },
  })
}
