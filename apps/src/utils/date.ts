/**
 * 날짜 표시 형식 — 프로젝트 공통.
 *
 * DB·API 는 `YYYY-MM-DD` 로 주고받고, 화면에는 `2026.10.14` 처럼 보여 줍니다.
 * 기간은 시작·종료 **양쪽 모두 연도를 붙입니다**. (`2026.10.14 ~ 2026.10.20`)
 */

/** YYYY-MM-DD (또는 앞 10자가 그 형태인 값) → YYYY.MM.DD */
export function formatDotDate(value: string) {
  const ymd = (value ?? '').slice(0, 10)
  const parts = ymd.split('-')

  if (parts.length !== 3 || parts.some((part) => part === '')) {
    return value ?? ''
  }

  return `${parts[0]}.${parts[1]}.${parts[2]}`
}

/**
 * 시작 ~ 종료 (양쪽 모두 연도 포함)
 *
 * 종료일이 없으면 시작일만, 시작일도 없으면 '-'.
 */
export function formatDotRange(start: string, end?: string) {
  const from = formatDotDate(start)

  if (from === '') {
    return '-'
  }

  const to = formatDotDate(end ?? '')

  return to === '' ? from : `${from} ~ ${to}`
}
