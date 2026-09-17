import { useEffect, useMemo, useState } from 'react'
import type { DragEvent } from 'react'
import ImageLightbox from './ImageLightbox'

/**
 * 관리자 — 이미지 드래그앤드랍 업로더.
 *
 * 전시 등록의 작품등록처럼 이미지를 여러 장 올리는 곳에 씁니다.
 * (썸네일 미리보기 · 개별 삭제 · 개수/용량 카운터)
 * 썸네일을 누르면 팝업 슬라이드(ImageLightbox)로 크게 봅니다.
 * 스타일은 admin.css 의 .adm_dropzone* · .adm_lightbox* 입니다.
 */

/** 서버에 이미 저장된 이미지 (수정 모드) */
export type SavedArtwork = {
  id: number
  name: string
  url: string
  /** 카운터 용량에 더할 크기 (모르면 0) */
  size?: number
}

/** saved 를 안 넘길 때 매번 새 배열을 만들지 않기 위한 상수 */
const NO_SAVED: readonly SavedArtwork[] = []

type ArtworkDropzoneProps = {
  files: File[]
  /** 검증을 통과한 파일만 담아 돌려줍니다. */
  onChange: (files: File[]) => void
  /** 최대 개수 */
  max: number
  /** 개당 최대 용량 (MB) */
  sizeMB: number
  /** 전체 최대 용량 (MB) */
  totalMB: number
  /** 허용 확장자 (예: '.jpg,.png') */
  accept: string
  /** 서버에 저장된 이미지 (수정 모드) — 개수·용량 제한에 함께 셉니다. */
  saved?: readonly SavedArtwork[]
  /** 저장된 이미지 삭제 (실제 삭제는 저장할 때 반영됩니다) */
  onRemoveSaved?: (id: number) => void
  /** 추가 타일 문구 */
  addLabel?: string
  /** 안내 문구 (없으면 제한값으로 만듭니다) */
  hint?: string
  /** 검증 실패 안내 */
  onError?: (message: string) => void
  disabled?: boolean
}

/** 드롭존 카메라 아이콘 */
function CameraIcon() {
  return (
    <svg className="adm_dropzone_icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M9 4h6l1.3 2H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.7L9 4Z"
        fill="currentColor"
      />
      <circle cx="12" cy="13" r="4.2" fill="#fff" />
      <circle cx="12" cy="13" r="2.8" fill="currentColor" />
    </svg>
  )
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

export default function ArtworkDropzone({
  files,
  onChange,
  max,
  sizeMB,
  totalMB,
  accept,
  saved = NO_SAVED,
  onRemoveSaved,
  addLabel = '작품 이미지 추가',
  hint,
  onError,
  disabled = false,
}: ArtworkDropzoneProps) {
  const [dragging, setDragging] = useState(false)
  /** 팝업 슬라이드로 보고 있는 이미지 번호 (null 이면 닫힘) */
  const [lightbox, setLightbox] = useState<number | null>(null)

  /** 썸네일용 object URL — files 가 바뀔 때만 새로 만듭니다. */
  const previews = useMemo(
    () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [files],
  )

  useEffect(
    () => () => {
      previews.forEach((item) => URL.revokeObjectURL(item.url))
    },
    [previews],
  )

  const savedBytes = saved.reduce((sum, item) => sum + (item.size ?? 0), 0)
  const newBytes = files.reduce((sum, file) => sum + file.size, 0)
  const totalBytes = savedBytes + newBytes
  const usedCount = saved.length + files.length

  /** 팝업 슬라이드에 보여 줄 이미지 — 저장된 것 먼저, 새로 고른 것 다음 */
  const lightboxImages = useMemo(
    () => [
      ...saved.map((item) => ({ url: item.url, name: item.name })),
      ...previews.map((item) => ({ url: item.url, name: item.file.name })),
    ],
    [saved, previews],
  )

  const extensions = accept
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)

  const hintText =
    hint ??
    `작품 이미지(${extensions
      .map((value) => value.replace('.', ''))
      .join(', ')}) 최대 ${max}개까지 가능하며 이미지 1개당 ${sizeMB}M 이하만 가능합니다. (총 ${totalMB}M)이하로 가능 합니다.`

  /** 형식 · 용량 · 개수를 확인하고 통과한 파일만 넘깁니다. */
  const addFiles = (picked: File[]) => {
    if (disabled || picked.length === 0) return

    const accepted: File[] = []

    for (const file of picked) {
      const extension = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`

      if (extensions.length > 0 && !extensions.includes(extension)) {
        onError?.(`${file.name}: 올릴 수 없는 형식입니다.`)
        continue
      }

      if (file.size > sizeMB * 1048576) {
        onError?.(`${file.name}: ${sizeMB}MB 이하만 올릴 수 있습니다.`)
        continue
      }

      accepted.push(file)
    }

    let room = max - usedCount
    let total = totalBytes
    const next: File[] = []

    for (const file of accepted) {
      if (room <= 0) {
        onError?.(`작품등록: ${max}개까지만 올릴 수 있습니다.`)
        break
      }

      if (total + file.size > totalMB * 1048576) {
        onError?.(`작품등록: 전체 용량은 ${totalMB}MB 이하만 가능합니다.`)
        break
      }

      total += file.size
      room -= 1
      next.push(file)
    }

    if (next.length > 0) onChange([...files, ...next])
  }

  const remove = (index: number) => {
    if (disabled) return
    onChange(files.filter((_, i) => i !== index))
  }

  return (
    <div className="adm_dropzone_block">
      <p className="adm_dropzone_hint">{hintText}</p>

      <div
        className={
          dragging ? 'adm_dropzone is-dragging' : 'adm_dropzone'
        }
        onDragOver={(event: DragEvent<HTMLDivElement>) => {
          if (disabled) return
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event: DragEvent<HTMLDivElement>) => {
          event.preventDefault()
          setDragging(false)
          addFiles(Array.from(event.dataTransfer.files))
        }}
      >
        <div className="adm_dropzone_grid">
          {saved.map((item, index) => (
            <div className="adm_dropzone_item" key={`saved-${item.id}`}>
              <button
                type="button"
                className="adm_dropzone_view"
                aria-label={`${item.name} 크게 보기`}
                onClick={() => setLightbox(index)}
              >
                <img src={item.url} alt={item.name} />
              </button>
              <button
                type="button"
                className="adm_dropzone_remove"
                aria-label={`${item.name} 삭제`}
                disabled={disabled}
                onClick={() => onRemoveSaved?.(item.id)}
              >
                ×
              </button>
            </div>
          ))}

          {previews.map((item, index) => (
            <div
              className="adm_dropzone_item"
              key={`${item.file.name}-${index}`}
            >
              <button
                type="button"
                className="adm_dropzone_view"
                aria-label={`${item.file.name} 크게 보기`}
                onClick={() => setLightbox(saved.length + index)}
              >
                <img src={item.url} alt={item.file.name} />
              </button>
              <button
                type="button"
                className="adm_dropzone_remove"
                aria-label={`${item.file.name} 삭제`}
                disabled={disabled}
                onClick={() => remove(index)}
              >
                ×
              </button>
            </div>
          ))}

          {usedCount < max && !disabled && (
            <label className="adm_dropzone_add">
              <CameraIcon />
              {addLabel}
              <input
                type="file"
                multiple
                accept={accept}
                onChange={(event) => {
                  addFiles(Array.from(event.target.files ?? []))
                  event.target.value = ''
                }}
              />
            </label>
          )}
        </div>
      </div>

      <p className="adm_dropzone_count">
        {usedCount}개 / {max}개 · {formatSize(totalBytes)}
      </p>

      <ImageLightbox
        images={lightboxImages}
        index={lightbox}
        onClose={() => setLightbox(null)}
        onIndexChange={setLightbox}
      />
    </div>
  )
}
