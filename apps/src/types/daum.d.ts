/**
 * 다음(Daum) 우편번호 서비스가 전역에 붙이는 `daum` 객체 타입 선언.
 *
 * 스크립트는 주소 검색을 처음 열 때 동적으로 불러옵니다.
 *   https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js
 */

export type PostcodeResult = {
  /** 우편번호 (5자리) */
  zonecode: string
  /** 도로명 주소 (없으면 지번) */
  address: string
  /** 도로명 주소 */
  roadAddress: string
  /** 지번 주소 */
  jibunAddress: string
  /** 사용자가 선택한 주소 종류 ('R' = 도로명, 'J' = 지번) */
  userSelectedType: 'R' | 'J'
  /** 건물명 */
  buildingName: string
}

export type PostcodeInstance = {
  open: () => void
  embed: (element: HTMLElement) => void
}

export type PostcodeConstructor = new (options: {
  oncomplete: (data: PostcodeResult) => void
  onclose?: () => void
  width?: string
  height?: string
}) => PostcodeInstance

declare global {
  interface Window {
    daum?: {
      Postcode: PostcodeConstructor
    }
  }
}
