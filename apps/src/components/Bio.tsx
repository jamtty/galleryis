import type { BioGroup } from "../lib/exhibition";

/**
 * A 약력 as the origin sets it: a bold group head, its entries single-spaced
 * under it in a list, and a blank line's worth of air before the next group.
 * It is a CV, so it is a list — reading it as one tells a screen reader how
 * many shows are under 개인전, which a run of paragraphs does not.
 *
 * The origin hangs an award that shares the year above it on a run of
 * `&nbsp;`. That indent is kept as padding rather than as the spaces
 * themselves, so a long entry's second line stays under the first instead of
 * wrapping back to the year's column.
 */
export default function Bio({ groups }: { groups: BioGroup[] }) {
  return (
    <div className="mt-6 max-w-4xl space-y-7 text-base">
      {groups.map((group, index) => (
        <section key={index}>
          {group.heading && (
            <h3 className="font-bold break-keep">{group.heading}</h3>
          )}
          {group.lines.length > 0 && (
            <ul className={group.heading ? "mt-1.5" : undefined}>
              {group.lines.map((line, at) => (
                <li
                  key={at}
                  className={`leading-normal break-keep ${line.indented ? "pl-8" : ""}`}
                >
                  {line.text}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
