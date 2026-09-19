import Wordmark from "./Wordmark";

// The activity mark for a blocking wait: the gallery's wordmark breathing
// over a hairline with one ink segment sliding along it. Every wait in the
// studio has an unknown layout — three.js arriving, a hall's document being
// read — so this is the only one it needs.
//
// The letters are set to about the width of the rule beneath them, which is
// what the square mark they replaced could never do.
//
// The words are for a screen reader only: the breathing says "working", and a
// sentence under it would only be read once anyway.

export default function Loader({
  label,
  className = "",
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={`flex flex-col items-center gap-5 ${className}`}
    >
      <span className="sr-only">{label}</span>
      <span aria-hidden>
        <Wordmark className="h-3 animate-breathe text-ink" />
      </span>
      <span aria-hidden className="block h-0.5 w-40 overflow-hidden bg-line">
        <span className="block h-full w-1/3 animate-slide bg-ink" />
      </span>
    </div>
  );
}
