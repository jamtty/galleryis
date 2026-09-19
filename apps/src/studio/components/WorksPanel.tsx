import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ACCEPTED_TYPES,
  ACCEPTED_TYPES_LABEL,
  MAX_MB,
  MAX_WORKS,
} from "../lib/artworkImage";
import {
  HO_SERIES,
  hoForLongSide,
  longSideForHo,
  longSideOf,
} from "../lib/canvasSizes";
import { overlappingIds } from "../lib/placement";
import { useWorksStore, type Work } from "../store/works";

// The DOM side of the placement tool: everything here reads and writes the
// same zustand store the 3D layer renders from.

// cm inputs commit on blur or Enter, live clamping would fight the keystrokes
// ("50" becomes 10 the moment "5" is typed). The draft resets to the store's
// clamped value afterwards, so the input always ends up telling the truth.
function SizeInput({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number;
  onCommit: (valueCm: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label className="flex items-center gap-1.5 text-sm text-ink-soft">
      {label}
      <input
        type="number"
        inputMode="decimal"
        min={1}
        aria-label={label}
        className="w-16 rounded-sm border border-line-lit bg-ground px-1.5 py-1 text-right text-sm text-ink tabular-nums transition-colors focus:border-ink"
        value={draft ?? String(value)}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) =>
          event.key === "Enter" && (event.target as HTMLInputElement).blur()
        }
        onBlur={() => {
          if (draft !== null) {
            const cm = Number(draft);
            if (Number.isFinite(cm) && cm > 0) onCommit(cm);
          }
          setDraft(null);
        }}
      />
    </label>
  );
}

// The 호 series as a picker. It sets the long side and leaves the aspect to the
// photograph, so a work that was cropped off-standard reads back as "직접 입력"
// rather than being snapped to a ratio the image doesn't have. A size the wall
// or ceiling had to cap does the same.
function HoSelect({ work }: { work: Work }) {
  const { t } = useTranslation();
  const ho = hoForLongSide(longSideOf(work));
  return (
    <label className="flex items-center gap-1.5 text-sm text-ink-soft">
      {t("works.hoLabel")}
      <select
        aria-label={t("works.hoLabel")}
        value={ho ?? ""}
        onChange={(event) => {
          const longCm = longSideForHo(Number(event.target.value));
          if (longCm === null) return;
          // Grow whichever side is already the long one, so a portrait work
          // stays portrait.
          useWorksStore
            .getState()
            .updateSize(
              work.id,
              work.aspect >= 1 ? { width_cm: longCm } : { height_cm: longCm },
            );
        }}
        className="rounded-sm border border-line-lit bg-ground px-1.5 py-1 text-sm text-ink transition-colors focus:border-ink"
      >
        {ho === null && <option value="">{t("works.hoCustom")}</option>}
        {HO_SERIES.map((size) => (
          <option key={size.ho} value={size.ho}>
            {t("works.hoOption", { n: size.ho })}
          </option>
        ))}
      </select>
    </label>
  );
}

function WorkRow({
  work,
  index,
  selected,
  overlapping,
}: {
  work: Work;
  /** 1-based, and load-bearing: it is how the assistant names this work. */
  index: number;
  selected: boolean;
  overlapping: boolean;
}) {
  const { t } = useTranslation();
  const { selectWork, removeWork, updateSize } = useWorksStore.getState();
  return (
    <li
      className={`space-y-2 border p-3 transition-colors duration-300 ${
        selected
          ? "border-ink bg-surface-hi"
          : "border-line bg-surface hover:border-line-lit"
      }`}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => selectWork(work.id)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <img
            // Never null here: the panel is not mounted in review mode.
            src={work.url ?? undefined}
            alt=""
            className="h-11 w-11 shrink-0 border border-line object-cover"
          />
          {/* The number the assistant refers to. Filenames never reach the
              server, so "세 번째 작품" only means anything if the panel says
              which one is third. */}
          <span className="shrink-0 text-sm text-ink-soft tabular-nums">
            {t("works.ordinal", { n: index })}
          </span>
          <span className="truncate text-sm">{work.name}</span>
        </button>
        <button
          type="button"
          onClick={() => removeWork(work.id)}
          aria-label={`${t("works.delete")}: ${work.name}`}
          className="shrink-0 rounded-full px-2 py-1 text-sm text-ink-soft transition-colors hover:bg-surface-hi hover:text-ink"
        >
          ✕
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SizeInput
          label={t("works.widthLabel")}
          value={work.width_cm}
          onCommit={(cm) => updateSize(work.id, { width_cm: cm })}
        />
        <SizeInput
          label={t("works.heightLabel")}
          value={work.height_cm}
          onCommit={(cm) => updateSize(work.id, { height_cm: cm })}
        />
        <HoSelect work={work} />
      </div>
      {overlapping && (
        <p className="text-sm text-accent-ink">{t("works.overlap")}</p>
      )}
    </li>
  );
}

/**
 * What this device is holding, and the way to stop holding it. The claim in
 * `works.saveNote` is a privacy promise, so the control that undoes it sits
 * directly under the sentence that makes it, not on a settings screen.
 *
 * A two-step inline confirm rather than `window.confirm`: the native dialog is
 * unstyleable and reads as a page freeze on a phone, and this matches the
 * inline dismiss the upload errors already use.
 */
function SaveFooter() {
  const { t } = useTranslation();
  const persistence = useWorksStore((state) => state.persistence);
  const [confirming, setConfirming] = useState(false);
  const note =
    persistence === "on"
      ? "saveNote"
      : persistence === "full"
        ? "saveFull"
        : "saveOff";
  return (
    <div className="space-y-2 border-t border-line px-4 py-3">
      <p className="text-sm leading-relaxed text-ink-soft">
        {t(`works.${note}`)}
      </p>
      {/* Nothing stored, nothing to erase. */}
      {persistence !== "off" &&
        (confirming ? (
          <div className="space-y-1.5">
            <p className="text-sm leading-relaxed text-ink-soft">
              {t("works.deleteConfirm")}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setConfirming(false);
                  void useWorksStore.getState().clearSaved();
                }}
                className="text-xs text-accent-ink underline underline-offset-2"
              >
                {t("works.deleteYes")}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="text-xs text-ink-soft underline underline-offset-2 transition-colors hover:text-ink"
              >
                {t("works.deleteNo")}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-xs text-ink-soft underline underline-offset-2 transition-colors hover:text-ink"
          >
            {t("works.deleteAll")}
          </button>
        ))}
    </div>
  );
}

export default function WorksPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const works = useWorksStore((state) => state.works);
  const selectedId = useWorksStore((state) => state.selectedId);
  const manualLayout = useWorksStore((state) => state.manualLayout);
  const uploadErrors = useWorksStore((state) => state.uploadErrors);
  const hydrating = useWorksStore((state) => state.hydrating);
  const restoreNote = useWorksStore((state) => state.restoreNote);
  const overlaps = useMemo(() => overlappingIds(works), [works]);
  const fileInput = useRef<HTMLInputElement>(null);
  if (!open) return null;
  // On a phone: a bottom sheet above the sticky bar, capped so the hall
  // stays visible behind it, a 21rem card pinned right was effectively a
  // full-screen curtain at 393px. From `sm` up: the floating card, clear of
  // the mode buttons (top) and sticky bar (bottom).
  return (
    <aside
      id="works-panel"
      aria-label={t("works.title")}
      className="absolute inset-x-3 bottom-[calc(var(--hall-footer,4rem)+0.75rem)] z-10 flex max-h-[55dvh] flex-col border border-line-lit bg-ground/95 shadow-[0_18px_48px_rgba(0,0,0,0.55)] backdrop-blur sm:inset-x-auto sm:top-16 sm:right-3 sm:max-h-none sm:w-[21rem]"
    >
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 className="font-display text-base font-bold">
          {t("works.title")}{" "}
          <span
            aria-live="polite"
            className="text-sm text-ink-soft tabular-nums"
          >
            {t("works.count", { n: works.length, max: MAX_WORKS })}
          </span>
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("works.close")}
          className="rounded-full px-2 py-1 text-sm text-ink-soft transition-colors hover:bg-surface-hi hover:text-ink"
        >
          ✕
        </button>
      </header>
      {/* overscroll-contain: flicking past the end of the list stays in the
          list rather than handing the gesture to the page behind it. */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
        <input
          ref={fileInput}
          type="file"
          multiple
          accept={ACCEPTED_TYPES.join(",")}
          aria-label={t("works.add")}
          className="hidden"
          onChange={(event) => {
            const files = event.target.files;
            if (files?.length)
              void useWorksStore.getState().addFiles(Array.from(files));
            // Allow re-picking the same file after a delete.
            event.target.value = "";
          }}
        />
        {/* Add is the primary action and stays filled; Arrange is the same
            shape in outline so it reads as subordinate rather than a second
            call to action. min-h-11 gives both a 44 px touch target. */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="min-h-11 flex-1 rounded-full bg-ink px-4 py-2 text-sm font-medium text-ground transition-colors hover:bg-ink-soft"
          >
            {t("works.add")}
          </button>
          <button
            type="button"
            disabled={works.length === 0}
            onClick={() => useWorksStore.getState().arrangeAll()}
            className="min-h-11 flex-1 rounded-full border border-line-lit bg-surface px-4 py-2 text-sm text-ink transition-colors hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line-lit disabled:hover:text-ink"
          >
            {t("works.arrange")}
          </button>
        </div>
        {/* AI 도우미(AssistPanel)는 원본 서버가 있어야 동작해 걷어냈습니다. */}
        {manualLayout && works.length > 0 && (
          <p className="text-sm leading-relaxed text-ink-soft">
            {t("works.manualNote")}
          </p>
        )}
        {/* The live region must already exist when errors arrive or screen
            readers won't announce them, so it stays mounted (empty) for the
            panel's lifetime. */}
        <div
          role="status"
          className={
            uploadErrors.length > 0
              ? "space-y-1 border-l-2 border-ink bg-surface p-3"
              : undefined
          }
        >
          {uploadErrors.length > 0 && (
            <>
              {uploadErrors.map((error) => (
                <p
                  key={`${error.name}-${error.reason}`}
                  className="text-sm text-accent-ink"
                >
                  {t(`works.errors.${error.reason}`, {
                    name: error.name,
                    types: ACCEPTED_TYPES_LABEL,
                    mb: MAX_MB,
                    max: MAX_WORKS,
                  })}
                </p>
              ))}
              <button
                type="button"
                onClick={() => useWorksStore.getState().dismissErrors()}
                className="text-xs text-ink-soft underline underline-offset-2 transition-colors hover:text-ink"
              >
                {t("works.dismiss")}
              </button>
            </>
          )}
        </div>
        {/* Hydration is normally imperceptible; the line exists for the case
            where fifteen images have to be decoded off a cold phone. */}
        {hydrating && (
          <p className="text-sm leading-relaxed text-ink-soft">
            {t("works.restoring")}
          </p>
        )}
        {/* Silently moving someone's hang would be worse than saying so. */}
        {restoreNote && (
          <div className="space-y-1 border-l-2 border-line-lit bg-surface p-3">
            <p className="text-xs leading-relaxed text-ink-soft">
              {t(
                restoreNote === "dropped"
                  ? "works.restoredDropped"
                  : "works.restoredMoved",
              )}
            </p>
            <button
              type="button"
              onClick={() => useWorksStore.getState().dismissRestoreNote()}
              className="text-xs text-ink-soft underline underline-offset-2 transition-colors hover:text-ink"
            >
              {t("works.dismiss")}
            </button>
          </div>
        )}
        {works.length === 0 && !hydrating ? (
          <div className="space-y-1.5 border border-dashed border-line-lit bg-surface px-4 py-6 text-center">
            <p className="text-sm font-medium text-ink">
              {t("works.emptyTitle")}
            </p>
            <p className="text-xs leading-relaxed text-ink-soft">
              {t("works.empty", { types: ACCEPTED_TYPES_LABEL, mb: MAX_MB })}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {works.map((work, index) => (
              <WorkRow
                key={work.id}
                work={work}
                index={index + 1}
                selected={work.id === selectedId}
                overlapping={overlaps.has(work.id)}
              />
            ))}
          </ul>
        )}
      </div>
      <SaveFooter />
    </aside>
  );
}
