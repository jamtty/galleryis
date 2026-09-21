import { useState } from 'react'

/**
 * 관리자 — 파일첨부 입력.
 *
 * 제목·내용 아래에 놓고, [파일 선택] 으로 여러 개를 고릅니다.
 * 수정 화면에서는 서버에 저장된 파일도 함께 보여 주고 × 로 지울 수 있습니다.
 * (스타일은 admin.css·editor.css 의 .adm_file_*)
 */

/** 서버에 저장된 첨부 (수정 모드) */
export type AttachedFile = {
  /** bf_no */
  no: number
  name: string
  url: string
  size?: number
}

type FileAttachFieldProps = {
  files: File[]
  onChange: (files: File[]) => void
  max: number
  sizeMB: number
  accept: string
  /** 서버에 저장된 파일 */
  saved?: readonly AttachedFile[]
  /** 저장된 파일 삭제 (실제 삭제는 저장할 때 반영됩니다) */
  onRemoveSaved?: (no: number) => void
  /** 검증 실패 안내 */
  onError?: (message: string) => void
  disabled?: boolean
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

export default function FileAttachField({
  files,
  onChange,
  max,
  sizeMB,
  accept,
  saved = [],
  onRemoveSaved,
  onError,
  disabled = false,
}: FileAttachFieldProps) {
  const [dragging, setDragging] = useState(false)

  const extensions = accept
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)

  /** 형식 · 용량 · 개수를 확인하고 통과한 파일만 넘깁니다. */
  const addFiles = (picked: File[]) => {
    if (disabled || picked.length === 0) return

    const accepted: File[] = []

    for (const file of picked) {
      const extension = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`

      if (extensions.length > 0 && !extensions.includes(extension)) {
        onError?.(`${file.name}: 첨부할 수 없는 형식입니다.`)
        continue
      }

      if (file.size > sizeMB * 1048576) {
        onError?.(`${file.name}: ${sizeMB}MB 이하만 첨부할 수 있습니다.`)
        continue
      }

      accepted.push(file)
    }

    const room = max - saved.length - files.length
    const next = accepted.slice(0, Math.max(0, room))

    if (accepted.length > next.length) {
      onError?.(`파일첨부: ${max}개까지만 첨부할 수 있습니다.`)
    }

    if (next.length > 0) onChange([...files, ...next])
  }

  const remove = (index: number) => {
    if (disabled) return
    onChange(files.filter((_, i) => i !== index))
  }

  const count = saved.length + files.length

  return (
    <div>
      {(saved.length > 0 || files.length > 0) && (
        <ul className="adm_file_list">
          {saved.map((file) => (
            <li className="adm_file_item" key={`saved-${file.no}`}>
              <a
                className="adm_file_name"
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {file.name}
              </a>

              {typeof file.size === 'number' && (
                <span className="adm_file_size">{formatSize(file.size)}</span>
              )}

              <button
                type="button"
                className="adm_file_del"
                aria-label={`${file.name} 삭제`}
                disabled={disabled}
                onClick={() => onRemoveSaved?.(file.no)}
              >
                <span className="material-icons">close</span>
              </button>
            </li>
          ))}

          {files.map((file, index) => (
            <li className="adm_file_item adm_file_new" key={`${file.name}-${index}`}>
              <span className="adm_file_name">{file.name}</span>
              <span className="adm_file_size">{formatSize(file.size)}</span>

              <button
                type="button"
                className="adm_file_del"
                aria-label={`${file.name} 삭제`}
                disabled={disabled}
                onClick={() => remove(index)}
              >
                <span className="material-icons">close</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div
        className={dragging ? 'adm_file_row is-dragging' : 'adm_file_row'}
        onDragOver={(event) => {
          if (disabled) return
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          addFiles(Array.from(event.dataTransfer.files))
        }}
      >
        <label className="adm_file_btn">
          <span className="material-icons">attach_file</span>
          파일 선택
          <input
            type="file"
            multiple
            accept={accept}
            disabled={disabled}
            style={{ display: 'none' }}
            onChange={(event) => {
              addFiles(Array.from(event.target.files ?? []))
              event.target.value = ''
            }}
          />
        </label>

        <span className="adm_file_name">
          {count > 0 ? `${count}개 선택됨` : '선택된 파일 없음'}
        </span>
      </div>

      <p className="adm_input_hint">
        최대 {max}개 · 개당 {sizeMB}MB 이하 (끌어다 놓아도 됩니다)
      </p>
    </div>
  )
}
