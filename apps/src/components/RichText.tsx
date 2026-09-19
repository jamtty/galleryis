/**
 * The rich text a post written on the desk carries, rendered as it stands.
 *
 * The HTML here is the API's, not the visitor's and not the desk's: every
 * field passes through `richtext.clean_html` on the way into Firestore,
 * which keeps paragraphs, the four inline marks, links and a paragraph's
 * alignment and strips everything else, and the API is the only writer
 * (Firestore rules deny every other client). So this is the one place the
 * site sets innerHTML, and it sets what its own service cleaned.
 *
 * The styles are the `.rich` block in index.css, shared with the desk's
 * editor so what the gallery types is what the visitor reads: a paragraph
 * per line, an empty paragraph a blank line, no margins between them,
 * because a 약력 is typed one entry per Enter and a gap after every entry
 * would space the CV out to three screens.
 */
export default function RichText({
  html,
  className = "",
}: {
  html: string;
  className?: string;
}) {
  return (
    <div
      className={`rich ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
