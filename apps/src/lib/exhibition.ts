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
  exhibition: Pick<ExhibitionSummary, "hall_id" | "hall_text">,
  t: TFunction,
): string | null {
  if (exhibition.hall_id) return t(hallNameKey(exhibition.hall_id));
  return exhibition.hall_text || null;
}

/**
 * A show's name, and its artist's, in Korean — in both locales.
 *
 * These two fields are names, not prose. 봄놀다 2026 展 is a coined word and
 * "Spring Play 2026 Exhibition" is a guess at what it might mean; 김 도 희 is
 * a person, and "Kim Do-hee" is a spelling of that name rather than the name
 * the gallery filed. Everything else about a show — the overview, the 약력,
 * when it runs and where it hangs — reads in the visitor's own language.
 *
 * `title_en` and `artist_en` keep arriving from the sync and stay on the wire
 * and in Firestore. They are simply not what this site prints, so the day the
 * gallery supplies an English name it has written itself, these two functions
 * are the only place that changes.
 *
 * Whatever the page's locale the text they return is Korean, so every element
 * that renders one carries `lang="ko"`: on the English page a screen reader
 * has to switch voice for it rather than read 봄놀다 out as Latin letters.
 */
export function showTitle(
  exhibition: Pick<ExhibitionSummary, "title_ko">,
): string {
  return exhibition.title_ko;
}

/** The artist as the gallery filed them. See {@link showTitle}. */
export function showArtist(
  exhibition: Pick<ExhibitionSummary, "artist_ko">,
): string | null {
  return exhibition.artist_ko;
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
