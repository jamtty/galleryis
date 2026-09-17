import { apiRequest } from './client'

/**
 * 공지 API — 그누보드4 레거시 테이블(g4_write_notice)에 연결됩니다.
 *
 * 목록 · 상세 · 등록 · 수정 · 삭제 모두 관리자 토큰이 필요합니다.
 */

/** 파일첨부 제한 — backend/lib/notice.php 와 동일하게 유지하세요. */
export const NOTICE_FILE_LIMIT = {
  label: '파일첨부',
  max: 5,
  sizeMB: 10,
  totalMB: 50,
  accept:
    '.jpg,.jpeg,.png,.gif,.webp,.bmp,.pdf,.hwp,.hwpx,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip',
} as const

/** 등록·수정 입력값 — backend/api/notices/create.php 의 payload */
export type NoticeInput = {
  title: string
  /** 에디터 본문 (HTML) */
  content: string
  link1: string
  link2: string
  /** 상단 고정 (g4_board.bo_notice) */
  pinned: 'Y' | 'N'
}

/** 서버에 저장된 첨부 1건 */
export type NoticeFile = {
  /** bf_no — 수정할 때 남길 첨부를 지정합니다. */
  no: number
  name: string
  size: number
  width: number
  height: number
  isImage: boolean
  url: string
}

export type NoticeDetail = {
  id: number
  title: string
  /** 본문 (HTML) */
  content: string
  link1: string
  link2: string
  /** 상단 고정 여부 */
  pinned: boolean
  author: string
  email: string
  hit: number
  createdAt: string
  files: NoticeFile[]
}

/** 공지 등록 (관리자) */
export function createNotice(input: NoticeInput, files: File[] = []) {
  const form = new FormData()
  form.append('payload', JSON.stringify(input))

  for (const file of files) form.append('files[]', file)

  return apiRequest<{ id: number }>('/api/notices/create.php', {
    method: 'POST',
    form,
  })
}

/**
 * 공지 수정 (관리자)
 *
 * @param keep 남길 첨부의 bf_no. 여기 없는 첨부는 서버에서 지워집니다.
 */
export function updateNotice(
  id: number,
  input: NoticeInput,
  files: File[] = [],
  keep: number[] = [],
) {
  const form = new FormData()
  form.append('id', String(id))
  form.append('payload', JSON.stringify(input))

  for (const no of keep) form.append('keep[]', String(no))
  for (const file of files) form.append('files[]', file)

  return apiRequest<{ id: number }>('/api/notices/update.php', {
    method: 'POST',
    form,
  })
}

/** 공지 1건 상세 (관리자) */
export function fetchNoticeDetail(id: number) {
  return apiRequest<NoticeDetail>('/api/notices/detail.php', { query: { id } })
}

export type NoticeListItem = {
  id: number
  title: string
  /** 상단 고정 여부 */
  pinned: boolean
  author: string
  hit: number
  fileCount: number
  hasLink: boolean
  createdAt: string
}

export type NoticeListResponse = {
  items: NoticeListItem[]
  totalCount: number
  totalPages: number
  page: number
  size: number
  /** g4_board.bo_notice 원본 값 */
  pinnedRaw: string
  /** 해석한 고정 공지 번호 */
  pinnedIds: number[]
  /** 고정 설정에는 있는데 공지 목록에 없는 번호 (삭제·설정 꾸임 등) */
  pinnedNotListed: number[]
}

export type NoticeListQuery = {
  page?: number
  size?: number
  keyword?: string
  /** 작성일 시작 (YYYY-MM-DD) */
  from?: string
  /** 작성일 끝 (YYYY-MM-DD) */
  to?: string
}

/** 공지 목록 (관리자) */
export function fetchNoticeList(query: NoticeListQuery = {}) {
  return apiRequest<NoticeListResponse>('/api/notices/list.php', { query })
}

/**
 * 공지 삭제 (관리자)
 *
 * ⚠ 첨부파일과 공지 글이 함께 지워집니다. 되돌릴 수 없습니다.
 */
export function deleteNotices(ids: number[]) {
  return apiRequest<{ deleted: number; files: number }>(
    '/api/notices/delete.php',
    { method: 'POST', body: { ids } },
  )
}

/* --------------------------------------------------------------------------
   공개 소식 페이지 (/notices, 홈 소식 섹션) — 토큰 없이 부를 수 있습니다.
   -------------------------------------------------------------------------- */

/** 공개 목록 1건 */
export type PublicNoticeItem = NoticeListItem

export type PublicNoticeListResponse = {
  items: PublicNoticeItem[]
  totalCount: number
  totalPages: number
  page: number
  size: number
}

/** 이전글 · 다음글 (없으면 null) */
export type PublicNoticeNeighbour = { id: number; title: string } | null

export type PublicNoticeDetail = {
  id: number
  title: string
  /** 본문 (HTML 또는 옛 평문) */
  content: string
  link1: string
  link2: string
  pinned: boolean
  author: string
  hit: number
  createdAt: string
  files: NoticeFile[]
  prev: PublicNoticeNeighbour
  next: PublicNoticeNeighbour
}

/** 공개 소식 목록 */
export function fetchPublicNoticeList(
  query: { page?: number; size?: number; keyword?: string } = {},
) {
  return apiRequest<PublicNoticeListResponse>('/api/notices/public_list.php', {
    query,
    auth: false,
  })
}

/** 공개 소식 상세 (조회수가 1 올라갑니다) */
export function fetchPublicNoticeDetail(id: number) {
  return apiRequest<PublicNoticeDetail>('/api/notices/public_detail.php', {
    query: { id },
    auth: false,
  })
}
