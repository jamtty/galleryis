/**
 * 신청서에 붙인 파일은 **보낼 때 한 번에** 올라갑니다.
 *
 * 원본 사이트는 파일을 고르는 즉시 서버에 올리고 주소(id)만 받아 두었다가
 * 신청서에 그 id 를 실어 보냈습니다. 우리 백엔드는 신청서와 파일을 **한 번의
 * multipart 요청**으로 받으므로, 고른 파일(File)을 여기에 잠시 들고 있다가
 * 신청서를 보낼 때 꺼내 씁니다. 화면에 보이는 것(목록·용량·삭제)은 같습니다.
 */
import type { AttachmentKind, BookingAttachment } from './rentalForm'

type Pending = { file: File; kind: AttachmentKind }

const pending = new Map<string, Pending>()

/** 신청서에 붙은 파일 1건을 들고 있습니다. */
export function keepPendingAttachment(entry: BookingAttachment, file: File) {
  pending.set(entry.id, { file, kind: entry.kind })
}

/** 목록에서 지운 파일은 들고 있지 않습니다. */
export function dropPendingAttachment(id: string) {
  pending.delete(id)
}

export type PendingFiles = { bio: File[]; portfolio: File[] }

/** 신청서가 실어 보낸 id 목록 → 첨부 종류별 파일 (한 번 꺼내면 지워집니다) */
export function takePendingFiles(
  attachments: readonly BookingAttachment[],
): PendingFiles {
  const files: PendingFiles = { bio: [], portfolio: [] }

  for (const attachment of attachments) {
    const held = pending.get(attachment.id)

    if (!held) {
      // 화면에는 있는데 잡아 둔 파일이 없는 경우 — 조용히 넘기면 신청서에서 첨부가
      // 사라진 것처럼 보입니다. (id 가 겹쳤던 2026-09-19 버그를 찾아낸 자리)
      console.warn(
        '[attachment] 붙인 파일을 찾지 못해 보내지 못했습니다:',
        attachment.id,
        attachment.name,
      )
      continue
    }

    files[held.kind].push(held.file)
    pending.delete(attachment.id)
  }

  return files
}
