import { fetchJson, type ExhibitionSummary } from "@galleryis/shared";
import { useQuery } from "@tanstack/react-query";
import type { TFunction } from "i18next";

/** One listing per status; the front page and the tabs page share the cache. */
export function useExhibitions(status: "current" | "upcoming" | "past") {
  return useQuery({
    queryKey: ["exhibitions", status],
    queryFn: () =>
      fetchJson<ExhibitionSummary[]>(`/api/exhibitions?status=${status}`),
  });
}

/**
 * 헤더 검색의 결과 — 전시 목록 페이지가 그리는 목록 (`/exhibitions?keyword=…`).
 *
 * 분류 탭의 세 목록과 달리 **현재·예정·지난을 한 번에** 훑습니다: 어느 탭에도
 * 없는 지난 전시를 찾는 것이 검색의 일이고, 서버가 검색일 때만 최신순으로
 * 돌려줍니다. 빈 검색어로는 묻지 않습니다 (`enabled`) — 빈 검색어는 "전부" 가
 * 아니라 아무것도 아닙니다.
 */
export function useExhibitionSearch(keyword: string) {
  return useQuery({
    queryKey: ["exhibitions", "search", keyword],
    queryFn: () =>
      fetchJson<ExhibitionSummary[]>(
        `/api/exhibitions?keyword=${encodeURIComponent(keyword)}`,
      ),
    enabled: keyword !== "",
  });
}

/**
 * The i18n key for a hall's display name. Hall ids on the wire are
 * hall1..hall4 (§5); the cast tells the typed t() so, since a runtime string
 * cannot carry that knowledge on its own.
 */
export function hallNameKey(hallId: string) {
  return `halls.${hallId}` as `halls.hall${1 | 2 | 3 | 4}`;
}

/**
 * Where a show hangs, as a label.
 *
 * A parsed hall gets the localised name; a show the parser could not pin to
 * one hall, "제 1, 2 전시장 (1F, 2F)" across two floors, gets the gallery's
 * own words verbatim, which beats saying nothing. Null when neither exists.
 */
export function hallLabel(
  exhibition: Pick<
    ExhibitionSummary,
    "hall_id" | "hall_text" | "hall_text_en"
  >,
  t: TFunction,
  language: string,
): string | null {
  if (exhibition.hall_id) return t(hallNameKey(exhibition.hall_id));
  // 관리자가 적은 전시장소 — 영문 화면에서는 그 번역문을 씁니다.
  if (language.startsWith("en") && exhibition.hall_text_en) {
    return exhibition.hall_text_en;
  }
  return exhibition.hall_text || null;
}

/**
 * A show's name, and its artist's — in the visitor's own language.
 *
 * 2026-10-08 바뀐 정책: 예전에는 두 값을 **양쪽 로케일 모두 한국어로** 그렸습니다
 * (`title_en` 은 원본 동기화에서 오는 기계 번역이라 이름을 지어내는 셈이라고 봤습니다).
 * 갤러리 요청에 따라 영문 화면에서는 영문을 그립니다 — 다만 그것이 기계 번역이라는
 * 사실을 화면이 밝힙니다 (`exhibition.machine`).
 *
 * 영문이 없으면 (번역 전이거나 키가 없을 때) 한국어로 되돌아갑니다.
 * 그래서 돌려주는 글의 언어를 `showLang()` 으로 물어 `lang` 속성에 적어야 합니다 —
 * 영문 화면의 한국어 이름은 화면 낭독기가 목소리를 바꿔서 읽어야 합니다.
 */
export function showTitle(
  exhibition: Pick<ExhibitionSummary, "title_ko" | "title_en">,
  language: string,
): string {
  if (language.startsWith("en") && exhibition.title_en) return exhibition.title_en;
  return exhibition.title_ko;
}

/** The artist as the gallery filed them. See {@link showTitle}. */
export function showArtist(
  exhibition: Pick<ExhibitionSummary, "artist_ko" | "artist_en">,
  language: string,
): string | null {
  if (language.startsWith("en") && exhibition.artist_en) return exhibition.artist_en;
  return exhibition.artist_ko;
}

/** showTitle()·showArtist() 가 그린 글의 언어 — 그대로 `lang` 속성에 씁니다. */
export function showLang(
  language: string,
  english: string | null | undefined,
): string {
  return language.startsWith("en") && english ? "en" : "ko";
}

/**
 * The origin's body text comes out of a run of <div>s as lines separated by
 * anything from one to five newlines. Blank runs are paragraph breaks; single
 * breaks inside a paragraph survive (rendered with `whitespace-pre-line`).
 *
 * Notice bodies additionally carry the origin's cp949-era noise: `\r` from
 * CRLF line ends and zero-width spaces pasted in from word processors. Both
 * read as content to the splitter (a line of `\r` is not blank) and the
 * zero-width ones as odd gaps to a reader, so they go first; non-breaking
 * spaces stay in the class below, where they always were.
 */
export function paragraphs(text: string | null | undefined): string[] {
  return (text ?? "")
    .replaceAll("\r", "")
    .replaceAll("\u200b", "")
    .split(/\n[ \t ]*\n[ \t \n]*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** One line of a 약력, and whether the origin hung it under the line above. */
export type BioLine = { text: string; indented: boolean };

/** A 약력 group: the origin's bold head and the lines it heads. */
export type BioGroup = { heading: string | null; lines: BioLine[] };

/**
 * A 약력 is a CV, not prose, and the origin writes it as one: a bold group
 * head (학력 · 개인전 · 수상 경력), the entries single-spaced under it, one
 * blank line before the next group, and `&nbsp;` runs hanging a second award
 * under the year it shares. `parse_exhibition_post` flattens that cell with
 * `get_text("\n")`, which drops the <b> but leaves the shape legible in the
 * newline runs: **three** newlines between lines of a group (the line break
 * plus the source's own newline between the two <div>s), **five** across a
 * blank line. Reading them back is what keeps the CV a CV — run it through
 * `paragraphs()` instead and all 55 lines come out as equal paragraphs.
 *
 * The head of a group is its first line, when it has lines to head; the very
 * first line of the bio is always one, being the artist's name or the
 * gallery's own "■ 참여 작가" label — both bold at the origin.
 *
 * `source` is the Korean the text was translated from, if this is not itself
 * the Korean. Cloud Translation returns one flat run of `\n\n`, so a machine
 * bio arrives with the grouping gone; the lines still stand 1:1 against the
 * Korean, so the shape is taken from there and only the words from here. It
 * is a fallback for bios stored before the sync learned to keep the runs, not
 * the normal path: an EN bio carrying its own groups is read on its own.
 */
export function bioSections(
  text: string | null | undefined,
  source?: string | null,
): BioGroup[] {
  const groups = splitBio(text);
  if (source && groups.length === 1 && groups[0].lines.length > 1) {
    const shape = splitBio(source);
    if (shape.length > 1 && countLines(shape) === countLines(groups))
      return reshape(groups[0], shape);
  }
  return groups;
}

/** The `&nbsp;` run the origin hangs a continuation line with. */
const INDENT = /^\s/;

function splitBio(text: string | null | undefined): BioGroup[] {
  const groups: BioGroup[] = [];
  const blocks = (text ?? "")
    .replaceAll("\r", "")
    .replaceAll("\u200b", "")
    .split(/\n{4,}/);
  for (const block of blocks) {
    const lines = block
      .split(/\n+/)
      .filter((line) => line.trim())
      .map((line) => ({
        text: line.trim(),
        indented: INDENT.test(line),
      }));
    if (lines.length === 0) continue;
    // A lone line heads the bio and nothing else; anywhere further down it is
    // an entry of its own (the row of names under "■ 참여 작가"), not a head.
    const heads = lines.length > 1 || groups.length === 0;
    groups.push({
      heading: heads ? lines[0].text : null,
      lines: heads ? lines.slice(1) : lines,
    });
  }
  return groups;
}

function countLines(groups: BioGroup[]): number {
  return groups.reduce(
    (total, group) => total + group.lines.length + (group.heading ? 1 : 0),
    0,
  );
}

/** The translated lines, re-cut to the Korean's groups and indents. */
function reshape(flat: BioGroup, shape: BioGroup[]): BioGroup[] {
  const lines = [
    ...(flat.heading ? [{ text: flat.heading, indented: false }] : []),
    ...flat.lines,
  ];
  let at = 0;
  return shape.map((group) => {
    const heading = group.heading ? lines[at++].text : null;
    return {
      heading,
      lines: group.lines.map((line) => ({
        text: lines[at++].text,
        indented: line.indented,
      })),
    };
  });
}
