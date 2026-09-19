/**
 * 신청서의 전시명 · 작가명 ↔ 메모(`g4_write_order.wr_3`).
 *
 * 공개 신청 폼(원본 UI)에는 **메모 칸이 없고 전시명 · 작가명만** 있습니다. 그 두
 * 값을 `wr_3`(메모)에 담아 두고, 관리자 수정 화면도 같은 모양으로 읽고 씁니다.
 * 줄 모양은 `전시명 : …` · `작가명 : …` 입니다.
 *
 * 관리자 확인용 요약 줄(참여 작가 수 · 작품 수 · 장르 · 첨부)은 저장할 때 서버가
 * 덧붙이고 읽을 때 걷어냅니다(backend/lib/rental.php 의 `rental_memo_text` /
 * `rental_memo_only`). 혹시 섞여 들어와도 여기서 다시 걷어내 두 번 쌓이지 않게 합니다.
 */

/** 서버가 덧붙이는 요약 줄 — 메모로 되돌려 보내면 안 됩니다. */
const SUMMARY_LINE = /^(참여 작가 수|작품 수|장르|첨부)\s*:/

const TITLE_LABEL = '전시명'
const ARTIST_LABEL = '작가명'

export type RentalMemoFields = {
  /** 전시명 */
  title: string
  /** 작가명 (그룹전이면 대표 작가) */
  artist: string
  /** 그 밖에 적혀 있던 메모 — 옛 신청서에 남은 글이라 지우지 않습니다 */
  rest: string
}

/** 메모(`wr_3`) → 전시명 · 작가명 · 나머지 */
export function unpackRentalMemo(
  memo: string | null | undefined,
): RentalMemoFields {
  const fields: RentalMemoFields = { title: '', artist: '', rest: '' }
  const rest: string[] = []

  for (const line of (memo ?? '').split(/\r\n|\r|\n/)) {
    const text = line.trim()

    if (text === '' || SUMMARY_LINE.test(text)) continue

    const [label, value] = splitLabel(text)

    // 같은 이름표가 두 번 나오면 첫 줄만 씁니다(나머지는 메모로 남겨 잃지 않게).
    if (label === TITLE_LABEL && fields.title === '') {
      fields.title = value
      continue
    }

    if (label === ARTIST_LABEL && fields.artist === '') {
      fields.artist = value
      continue
    }

    rest.push(text)
  }

  fields.rest = rest.join('\n')

  return fields
}

/** 전시명 · 작가명 · 나머지 → 메모(`wr_3`) */
export function packRentalMemo(fields: Partial<RentalMemoFields>): string {
  const lines: string[] = []
  const title = (fields.title ?? '').trim()
  const artist = (fields.artist ?? '').trim()

  if (title !== '') lines.push(`${TITLE_LABEL} : ${title}`)
  if (artist !== '') lines.push(`${ARTIST_LABEL} : ${artist}`)

  for (const line of (fields.rest ?? '').split(/\r\n|\r|\n/)) {
    const text = line.trim()

    if (text === '' || SUMMARY_LINE.test(text)) continue

    lines.push(text)
  }

  return lines.join('\n')
}

/** "전시명 : 김지희" → ['전시명', '김지희'] (콜론 앞뒤 공백은 무시) */
function splitLabel(line: string): [string, string] {
  const at = line.indexOf(':')

  if (at < 0) return ['', line]

  return [line.slice(0, at).trim(), line.slice(at + 1).trim()]
}
