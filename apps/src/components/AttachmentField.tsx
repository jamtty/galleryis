import {
  ATTACHMENT_LIMITS,
  extensionAllowed,
  formatBytes,
  type AttachmentKind,
  type BookingAttachment,
} from "@galleryis/shared";
import type { Dispatch, SetStateAction } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  dropPendingAttachment,
  keepPendingAttachment,
} from "../shared/pendingAttachments";
import { BUTTON_OUTLINE, META } from "../ui";

// 약력소개 and 포트폴리오, the two file fields on the gallery's own form.
//
// The counts printed here are the gallery's — three documents, eight images —
// and the byte caps are what the path can carry (`ATTACHMENT_LIMITS` says why).
// They are checked on the device first, so a 90 MB portfolio is refused by the
// form that asked for it rather than after a minute of uploading, and checked
// again on the server, which is the copy that decides.
//
// Files go up as they are chosen rather than with the application: an
// applicant on a phone who loses signal after six of eight images keeps the
// six, and the send button is never the thing that has to carry a portfolio.
//
// **One at a time, and one after another.** Eight parallel requests share one
// uplink, so each takes eight times as long and all eight expire together
// against Firebase Hosting's 60 s — the failure mode is losing the whole
// selection rather than the last of it. Sending them in turn keeps every
// request short enough to land.

const MB = 1024 * 1024;

interface Uploading {
  key: string;
  name: string;
  /** Counted against the shared cap while in flight — the parent's total only
   * knows about files that have already landed. */
  size: number;
}

export default function AttachmentField({
  kind,
  files,
  onChange,
  totalBytes,
  onBusyChange,
}: {
  kind: AttachmentKind;
  files: BookingAttachment[];
  /** Takes an updater, not an array: uploads land one at a time and each has
   * to add itself to whatever is there by then, not to the list this render
   * closed over. */
  onChange: Dispatch<SetStateAction<BookingAttachment[]>>;
  /** Bytes already taken by *both* fields — the total cap is shared. */
  totalBytes: number;
  /** Whether anything is still going up. The queue stays in here; only this
   * bit leaves, because the application the form sends can only carry files
   * that have already landed — sending mid-upload files an application without
   * them. The send button is the one place that can be stopped. */
  onBusyChange?: (busy: boolean) => void;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Uploading[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const queue = useRef<Promise<void>>(Promise.resolve());
  /** 붙인 파일의 일련번호 — 신청서를 보낼 때 파일을 되찾는 열쇠입니다. */
  const seq = useRef(0);
  const listId = useId();
  const limits = ATTACHMENT_LIMITS[kind];

  const busy = pending.length > 0;
  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  const accept = limits.extensions.map((ext) => `.${ext}`).join(",");

  function take(chosen: FileList | null) {
    if (!chosen?.length) return;
    const complaints: string[] = [];
    const waiting = pending.reduce((sum, item) => sum + item.size, 0);
    let room = ATTACHMENT_LIMITS.maxTotalBytes - totalBytes - waiting;
    let slots = limits.maxFiles - files.length - pending.length;

    for (const file of Array.from(chosen)) {
      if (slots <= 0) {
        complaints.push(
          t("rental.fileTooMany", { name: file.name, max: limits.maxFiles }),
        );
        continue;
      }
      if (!extensionAllowed(kind, file.name)) {
        complaints.push(t("rental.fileWrongType", { name: file.name }));
        continue;
      }
      if (file.size > limits.maxBytes) {
        complaints.push(
          t("rental.fileTooBig", {
            name: file.name,
            max: Math.round(limits.maxBytes / MB),
          }),
        );
        continue;
      }
      if (file.size > room) {
        complaints.push(
          t("rental.fileTotalFull", {
            name: file.name,
            total: Math.round(ATTACHMENT_LIMITS.maxTotalBytes / MB),
          }),
        );
        continue;
      }
      slots -= 1;
      room -= file.size;
      enqueue(file);
    }
    setErrors(complaints);
    // Same file twice in a row is a real thing people do after a failure, and
    // the input would not fire change again without this.
    if (input.current) input.current.value = "";
  }

  /** Put one file at the back of the line and show it straight away. The tail
   * is a ref rather than state because a second selection made while the first
   * is still going has to join the same line, not start a parallel one. */
  function enqueue(file: File) {
    seq.current += 1;
    // ⚠ 약력·포트폴리오 두 입력란이 각자 1번부터 세므로 **kind 를 앞에** 붙입니다.
    // 안 붙이면 두 영역이 `attachment-1` 을 같이 만들어 pendingAttachments 에서
    // 서로를 덮어쓰고, 먼저 붙인 쪽(보통 약력)이 조용히 사라집니다. (2026-09-19 수정)
    const key = `${kind}-${seq.current}`;
    setPending((prior) => [
      ...prior,
      { key, name: file.name, size: file.size },
    ]);
    queue.current = queue.current.then(() => upload(file, key));
  }

  /**
   * 고른 파일을 목록에 붙입니다.
   *
   * 원본 사이트는 여기서 서버에 올리고 주소(id)만 받아 두었습니다. 우리
   * 백엔드는 신청서와 파일을 한 번의 요청(multipart)으로 받으므로, 파일을
   * 그대로 붙들어 두었다가 신청서가 실어 보냅니다. (shared/pendingAttachments)
   * 화면에 보이는 것 — 목록·용량·삭제 — 은 원본과 같습니다.
   */
  async function upload(file: File, key: string) {
    const entry: BookingAttachment = {
      id: key,
      kind,
      name: file.name,
      size: file.size,
      content_type: file.type,
    };

    keepPendingAttachment(entry, file);
    onChange((prior) => [...prior, entry]);
    setPending((prior) => prior.filter((item) => item.key !== key));
  }

  const full = files.length + pending.length >= limits.maxFiles;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-sm font-medium text-ink-soft">
          {t(`rental.${kind === "bio" ? "bio" : "portfolio"}`)}
        </span>
        <span className="text-sm break-keep text-ink-soft">
          {/* Both slots print their own per-file cap. The 약력소개 line used to
              stop at the count, so the only way to find out a document was too
              big was to be refused after choosing it.

              `break-keep` because this line wraps on a phone and Korean
              breaks between syllables by default: it cut 개 / 당 15MB across
              two lines. Breaking on a word puts the whole clause over. */}
          {t(kind === "bio" ? "rental.bioHint" : "rental.portfolioHint", {
            max: limits.maxFiles,
            each: Math.round(limits.maxBytes / MB),
            total: Math.round(ATTACHMENT_LIMITS.maxTotalBytes / MB),
          })}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3 border border-dashed border-line-lit bg-ground px-4 py-3">
        <button
          type="button"
          disabled={full}
          onClick={() => input.current?.click()}
          className={`${BUTTON_OUTLINE} bg-surface disabled:cursor-not-allowed disabled:opacity-40`}
        >
          {t(kind === "bio" ? "rental.pickFiles" : "rental.pickImages")}
        </button>
        <span className={`${META} text-ink-soft`}>
          {t("rental.used", {
            count: files.length,
            max: limits.maxFiles,
            size: formatBytes(totalBytes),
            total: `${Math.round(ATTACHMENT_LIMITS.maxTotalBytes / MB)} MB`,
          })}
        </span>
        <input
          ref={input}
          type="file"
          multiple
          accept={accept}
          aria-label={t(`rental.${kind === "bio" ? "bio" : "portfolio"}`)}
          onChange={(event) => take(event.target.files)}
          className="sr-only"
        />
      </div>

      {(files.length > 0 || pending.length > 0) && (
        <ul id={listId} className="mt-2 space-y-1.5">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex items-center gap-3 border border-line bg-surface px-3 py-2 text-sm"
            >
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <span className={`${META} text-ink-soft`}>
                {formatBytes(file.size)}
              </span>
              <button
                type="button"
                aria-label={`${file.name} ${t("rental.remove")}`}
                onClick={() => {
                  dropPendingAttachment(file.id);
                  onChange((prior) => prior.filter((f) => f.id !== file.id));
                }}
                className="min-h-11 px-1 text-sm text-ink-soft transition-colors hover:text-ink"
              >
                ✕
              </button>
            </li>
          ))}
          {pending.map((item) => (
            // role="status" so the row still announces itself when it
            // appears. The ring is decorative and the word it replaced is
            // still here for a screen reader, which has no use for a
            // rotation.
            <li
              key={item.key}
              role="status"
              className="flex items-center gap-3 border border-line bg-surface px-3 py-2 text-sm text-ink-soft"
            >
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              <span className="sr-only">{t("rental.uploading")}</span>
              {/* The wrapper stands as tall as the ✕ on a landed row, so the
                  list does not jolt every time a file finishes. */}
              <span className="flex min-h-11 items-center px-1">
                <span
                  aria-hidden="true"
                  className="size-4 shrink-0 animate-spin rounded-full border-2 border-line-lit border-t-ink [animation-duration:.8s] motion-reduce:animate-none"
                />
              </span>
            </li>
          ))}
        </ul>
      )}

      {errors.length > 0 && (
        <ul role="status" className="mt-2 space-y-1">
          {errors.map((message) => (
            <li key={message} className="text-sm text-accent-ink">
              {message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
