/**
 * 전시 더미 데이터.
 * 실제 사이트의 콘텐츠를 참고해 화면 확인용으로 넣어둔 값입니다.
 * 추후 API 연동 시 이 모듈만 교체하면 됩니다.
 */
import exhibitionPlaceholder from '../assets/images/exhibition-placeholder.svg'

export type Exhibition = {
  id: string
  title: string
  /** 화면에 표시되는 전시 기간 문자열 */
  periodText: string
  /** 전시장 */
  hall: string
  /** 대표 이미지 (로컬 placeholder) */
  image: string
}

/** 이미지 준비 전 사용하는 로컬 placeholder */
export const EXHIBITION_PLACEHOLDER = exhibitionPlaceholder

/** 현재 전시 */
export const NOW_SHOWING: readonly Exhibition[] = [
  {
    id: 'gallery-2297',
    title: '예진 윤수빈 개인전',
    periodText: '2026.09.16 ~ 2026.09.21',
    hall: '제1전시장 (1F)',
    image: EXHIBITION_PLACEHOLDER,
  },
  {
    id: 'gallery-2296',
    title: '김지희 · Adelans 2인 展',
    periodText: '2026.09.16 ~ 2026.09.21',
    hall: '제2전시장 (2F)',
    image: EXHIBITION_PLACEHOLDER,
  },
  {
    id: 'gallery-2295',
    title: '이 인 정 개인전',
    periodText: '2026.09.16 ~ 2026.09.22',
    hall: '제3전시장 (3F)',
    image: EXHIBITION_PLACEHOLDER,
  },
  {
    id: 'gallery-2294',
    title: '인수문고 컬렉션',
    periodText: '2026.09.09 ~ 2026.09.14',
    hall: '제4전시장 (B1)',
    image: EXHIBITION_PLACEHOLDER,
  },
]

/** 예정 전시 */
export const UPCOMING: readonly Exhibition[] = [
  {
    id: 'gallery2-2298',
    title: '제 6회 Les Mardis 그룹전',
    periodText: '2026.09.30 ~ 2026.10.05',
    hall: '제1전시장 (1F)',
    image: EXHIBITION_PLACEHOLDER,
  },
  {
    id: 'gallery2-2299',
    title: '2026 신진작가 창작지원 프로그램 결과전',
    periodText: '2026.10.14 ~ 2026.10.25',
    hall: '제2전시장 (2F) · 제3전시장 (3F)',
    image: EXHIBITION_PLACEHOLDER,
  },
]
