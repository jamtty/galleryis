/**
 * 라우트 경로 정의.
 * 실제 사이트(https://galleryis.web.app)의 라우트 테이블과 동일하게 맞췄습니다.
 */
export const PATHS = {
  home: '/',
  exhibitions: '/exhibitions',
  exhibitionDetail: '/exhibitions/:id',
  halls: '/halls',
  /** 전시장 3D 둘러보기 — 규모로 방을 만들고 사진을 벽에 붙여 둘러봅니다. */
  hallStudio: '/halls/:key/studio',
  rental: '/rental',
  /** 예전 대관 신청서 주소 — 이제 /rental 안에서 신청합니다. (넘겨 줍니다) */
  rentalApply: '/rental/apply',
  about: '/about',
  visit: '/visit',
  notices: '/notices',
  noticeDetail: '/notices/:id',
  privacy: '/privacy',
  /** 매칭되는 라우트가 없을 때 (404) */
  notFound: '*',

  /* 관리자 */
  admin: '/admin',
  adminLogin: '/admin/login',
  adminRentals: '/admin/rentals',
  /** 관리자 — 대리 신청 (전화 · 방문 접수). ?hall=hall1&week=YYYY-MM-DD */
  adminRentalDesk: '/admin/rentals/new',
  /** 관리자 — 대관 신청서 수정 */
  adminRentalEdit: '/admin/rentals/edit/:id',
  adminSchedule: '/admin/schedule',
  adminExhibitions: '/admin/exhibitions',
  /** 관리자 — 전시 등록 */
  adminExhibitionForm: '/admin/exhibitions/write',
  /** 관리자 — 전시 수정 (목록의 [상세]) */
  adminExhibitionEdit: '/admin/exhibitions/edit/:id',
  adminNotices: '/admin/notices',
  /** 관리자 — 공지 등록 */
  adminNoticeForm: '/admin/notices/write',
  /** 관리자 — 공지 수정 (목록의 [상세]) */
  adminNoticeEdit: '/admin/notices/edit/:id',
  /** 관리자 — 전시장 관리 (4개 고정 · 수정만) */
  adminHalls: '/admin/halls',
  /** 관리자 — 전시장 수정 */
  adminHallEdit: '/admin/halls/edit/:id',
  adminPopups: '/admin/popups',
  /** 관리자 — 팝업 등록 */
  adminPopupForm: '/admin/popups/write',
  /** 관리자 — 팝업 수정 (목록의 [상세]) */
  adminPopupEdit: '/admin/popups/edit/:id',
  /** 관리자 — 개인정보처리방침 (관리자 환경설정 페이지) */
  adminSettings: '/admin/settings',
  adminMyPage: '/admin/mypage',
} as const

/* --------------------------------------------------------------------------
   관리자
   -------------------------------------------------------------------------- */

export type AdminMenuItem = {
  to: string
  label: string
  /** Material Icons 리거처 이름 */
  icon: string
}

export type AdminMenuSection = {
  /** 섹션 제목 (없으면 구분 없이 이어집니다) */
  label?: string
  items: readonly AdminMenuItem[]
}

/** 관리자 사이드바 메뉴 */
export const ADMIN_MENU_SECTIONS: readonly AdminMenuSection[] = [
  {
    items: [
      { to: PATHS.adminRentals, label: '대관 신청', icon: 'mail' },
      { to: PATHS.adminSchedule, label: '대관 일정', icon: 'calendar_today' },
      { to: PATHS.adminExhibitions, label: '작품전시', icon: 'image' },
      { to: PATHS.adminHalls, label: '전시장', icon: 'apartment' },
      { to: PATHS.adminNotices, label: '공지', icon: 'campaign' },
      { to: PATHS.adminPopups, label: '팝업', icon: 'web_asset' },
    ],
  },
  {
    label: '설정',
    items: [
      { to: PATHS.adminSettings, label: '개인정보처리방침', icon: 'settings' },
    ],
  },
  {
    label: '계정',
    items: [
      { to: PATHS.adminMyPage, label: '마이페이지', icon: 'manage_accounts' },
    ],
  },
]

export type NavItemId = 'exhibitions' | 'about' | 'halls' | 'rental' | 'notices'

export type NavItem = {
  id: NavItemId
  label: string
  to: string
  /**
   * 이 경로에 있을 때도 같은 메뉴를 활성 상태로 취급합니다.
   * 원본 사이트에서 `about` 메뉴가 `/about` 과 `/visit` 을 함께 사용합니다.
   */
  also?: readonly string[]
}

/** 상단 주요 메뉴 — 원본: 전시 · 갤러리 이즈 · 전시장 · 대관신청 · 소식 */
export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'exhibitions', label: '전시', to: PATHS.exhibitions },
  { id: 'about', label: '갤러리 이즈', to: PATHS.about, also: [PATHS.visit] },
  { id: 'halls', label: '전시장', to: PATHS.halls },
  { id: 'rental', label: '대관신청', to: PATHS.rental },
  { id: 'notices', label: '소식', to: PATHS.notices },
]

/** 현재 경로가 해당 메뉴에 속하는지 판단 */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  const targets = [item.to, ...(item.also ?? [])]
  return targets.some(
    (target) => pathname === target || pathname.startsWith(`${target}/`),
  )
}
