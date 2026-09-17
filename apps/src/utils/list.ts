/**
 * 목록 표시용 번호.
 *
 * DB 의 실제 번호(id) 대신, 현재 검색 조건의 전체 건수를 기준으로
 * 화면에 보이는 순서대로 번호를 매깁니다. (최신 글이 가장 큰 번호 — 게시판 관례)
 *
 * 예) 전체 31건 · 페이지당 15건일 때
 *   1페이지 → 31, 30, …, 17
 *   2페이지 → 16, 15, …, 2
 *   3페이지 → 1
 *
 * @param totalCount 현재 조건의 전체 건수
 * @param page       현재 페이지 (1부터)
 * @param size       페이지당 건수
 * @param index      화면에서의 순서 (0부터)
 * @returns 표시할 번호
 */
export function listRowNumber(
  totalCount: number,
  page: number,
  size: number,
  index: number,
) {
  return totalCount - ((page - 1) * size + index)
}
