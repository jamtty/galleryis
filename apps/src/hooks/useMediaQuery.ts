import { useCallback, useSyncExternalStore } from 'react'

/**
 * 미디어 쿼리 일치 여부. (예: `useMediaQuery('(max-width: 767px)')` — 좁은 화면인지)
 *
 * 창 크기를 바꾸면 자동으로 다시 그려집니다.
 * (팝업처럼 **자바스크립트가 위치를 계산하는** 요소는 CSS 미디어 쿼리만으로 처리할 수 없습니다.
 *  팝업의 좌우·상하 위치는 관리자가 넣은 값이 인라인 스타일로 들어오기 때문입니다)
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(query)
      media.addEventListener('change', onChange)

      return () => media.removeEventListener('change', onChange)
    },
    [query],
  )

  const getSnapshot = useCallback(
    () => window.matchMedia(query).matches,
    [query],
  )

  return useSyncExternalStore(subscribe, getSnapshot)
}
