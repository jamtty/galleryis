/** 공지 더미 데이터 (실제 사이트 공지를 참고) */
export type Notice = {
  id: string
  title: string
  publishedAt: string
  /** 상단 고정 공지 여부 */
  pinned: boolean
}

export const NOTICES: readonly Notice[] = [
  {
    id: 'notice-132',
    title: '2026 갤러리이즈 하계휴가 휴관 안내',
    publishedAt: '2026-07-27',
    pinned: true,
  },
  {
    id: 'notice-131',
    title: '제16회 갤러리이즈 신진작가 창작지원 프로그램 안내',
    publishedAt: '2026-06-01',
    pinned: true,
  },
  {
    id: 'notice-122',
    title: '2026, 2027 갤러리이즈 대관 안내',
    publishedAt: '2024-12-31',
    pinned: false,
  },
  {
    id: 'notice-15',
    title: '갤러리이즈 석·박사학위 청구전시 특별할인 안내',
    publishedAt: '2012-03-02',
    pinned: false,
  },
]
