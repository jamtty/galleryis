/** 갤러리 기본 정보 (소개 / 오시는 길 / 푸터에 사용) */
export const SITE = {
  brandName: '갤러리 이즈',
  latinName: 'Gallery IS',
  hours: '월-일 10:00-19:00',
  hoursNote: '매주 화요일은 전시 교체로 인해 관람이 불가능합니다. (주차 불가)',
  fee: '무료 입장',
  closed: '없음 (내부 사정에 의한 휴관 시, 웹사이트에 공지)',
  director: '한수정',
  address: '(우)03146 서울특별시 종로구 인사동길 52-1',
  tel: '02-736-6669 · 02-737-6669',
  fax: '02-738-0781',
  email: 'galleryis@naver.com',
  subway:
    '3호선 안국역에서 내려 6번 출구로 나온 뒤, 인사동길로 진입해 50m 내려오시면 왼쪽에 갤러리 이즈가 있습니다.',
  /** 버스 — 줄 하나가 화면에서 한 줄로 표시됩니다. */
  bus: [
    '파랑버스 109 · 151 · 162 · 171 · 172 · 272 · 601 · 708, 초록버스 7025.',
    '종로경찰서에서 내려 인사동길로 진입해 50m 내려오시면 왼쪽입니다.',
  ],
  carFree:
    '인사동길은 평일과 주말 모두 차없는거리가 시행되므로 가급적 대중교통을 이용해 주시기 바랍니다.',
  /** 지도 중심 좌표 */
  coords: { lat: 37.5747722975425, lng: 126.984148806271 },
  instagram: 'https://www.instagram.com/gallery__is/',
  blog: 'http://blog.naver.com/galleryis',
  /** 푸터 하단 저작권 문구 */
  copyright: 'Copyright © 2026 GALLERY IS. All rights reserved.',
  credit: { label: 'Designed by MoonAI', href: 'https://moonai.co.kr' },
} as const
