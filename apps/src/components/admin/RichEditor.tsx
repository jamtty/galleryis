import { useCallback, useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { renderBodyHtml } from '@/utils/html'

/**
 * 관리자용 간단 리치 에디터.
 *
 * 전시개요 · 약력처럼 HTML 로 저장하는 본문에 씁니다.
 * 외부 라이브러리 없이 contentEditable + document.execCommand 로 동작합니다.
 * (에디터 스타일은 assets/css/editor.css — 관리자 구역(AdminApp)에서 함께 불러옵니다)
 */
/** 업로드된 이미지 — 본문에는 url 만 쓰지만 서버가 크기까지 함께 줍니다. */
export type EditorImage = {
  url: string
  width?: number
  height?: number
}

type RichEditorProps = {
  /** HTML 문자열 */
  value: string
  onChange: (html: string) => void
  placeholder?: string
  /**
   * 이미지를 서버에 올리는 함수. (업로드 API 를 그대로 넘기면 됩니다)
   * 없으면 이미지를 data URI 로 본문에 넣습니다. (DB 용량 주의)
   */
  onUploadImage?: (file: File) => Promise<EditorImage>
  disabled?: boolean
  /**
   * 편집기 겉상자에 덧붙일 클래스 — 화면별로 다른 모양을 줄 때 씁니다.
   * (예: 공지 편집기는 본문 사진을 가로 절반까지만 보여 줍니다 — `is-notice`)
   */
  className?: string
}

/** 글자색 팔레트 */
const COLORS = [
  '#111111',
  '#374151',
  '#b23c0e',
  '#dc2626',
  '#ea580c',
  '#ca8a04',
  '#16a34a',
  '#0891b2',
  '#2563eb',
  '#7c3aed',
  '#db2777',
]

/** 문단 서식 */
const BLOCKS = [
  { value: 'p', label: '본문' },
  { value: 'h2', label: '제목 1' },
  { value: 'h3', label: '제목 2' },
  { value: 'blockquote', label: '인용' },
] as const

/** 글자 크기 (execCommand fontSize 의 1~6 단계) */
const SIZES = [
  { value: '1', label: '10pt' },
  { value: '2', label: '12pt' },
  { value: '3', label: '14pt' },
  { value: '4', label: '16pt' },
  { value: '5', label: '20pt' },
  { value: '6', label: '24pt' },
] as const

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp,image/bmp'

/** 본문에 눈에 보이는 내용이 있는지 */
function hasContent(body: HTMLDivElement) {
  const text = (body.textContent ?? '').replace(/\u200b/g, '').trim()
  return text !== '' || body.querySelector('img, table, hr, video, iframe') !== null
}

/** HTML 속성값에 넣기 위해 따옴표를 막습니다. */
function escapeAttr(value: string) {
  return value.replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('이미지를 읽지 못했습니다.'))
    reader.readAsDataURL(file)
  })
}

export default function RichEditor({
  value,
  onChange,
  placeholder = '내용을 입력해 주세요.',
  onUploadImage,
  disabled = false,
  className,
}: RichEditorProps) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  /**
   * 이 컴포넌트가 마지막으로 본문에 그린 HTML.
   * 밖에서 값이 바뀐 경우에만 본문을 다시 그립니다.
   */
  const lastHtml = useRef('')

  /** 툴바를 누를 때 선택 영역이 풀리므로 미리 저장해 둡니다. */
  const savedRange = useRef<Range | null>(null)

  const [sourceMode, setSourceMode] = useState(false)
  const [source, setSource] = useState(value)
  const [syncedValue, setSyncedValue] = useState(value)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [colorOpen, setColorOpen] = useState(false)

  const [toolbar, setToolbar] = useState({
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    block: 'p',
  })

  /** 본문이 비었으면 안내 문구(.is-empty)를 보여 줍니다. */
  const syncEmpty = useCallback(() => {
    const body = bodyRef.current
    if (!body) return
    body.classList.toggle('is-empty', !hasContent(body))
  }, [])

  // 밖에서 값이 바뀌면(수정 화면 불러오기 등) 소스 보기 값도 함께 맞춥니다.
  // (effect 안에서 setState 하지 않도록 렌더 중에 조정합니다)
  if (value !== syncedValue) {
    setSyncedValue(value)
    setSource(value)
  }

  // 본문 DOM 은 effect 에서 그립니다. (React 가 관리하지 않는 영역)
  useEffect(() => {
    const body = bodyRef.current
    if (!body) return
    if (value === lastHtml.current) return

    lastHtml.current = value
    // 예전 글은 태그 없이 평문으로 저장돼 있어 줄바꿈이 그대로는 안 보입니다.
    body.innerHTML = renderBodyHtml(value)
    syncEmpty()
  }, [value, syncEmpty])

  useEffect(() => {
    const body = bodyRef.current
    if (body) body.classList.toggle('is-uploading', uploading)
  }, [uploading])

  /** 선택 영역 저장 */
  const saveSelection = useCallback(() => {
    const body = bodyRef.current
    const selection = window.getSelection()

    if (!body || !selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)

    if (body.contains(range.commonAncestorContainer)) {
      savedRange.current = range.cloneRange()
    }
  }, [])

  /** 저장해 둔 선택 영역 되돌리기 */
  const restoreSelection = useCallback(() => {
    const body = bodyRef.current
    if (!body) return

    body.focus()

    const range = savedRange.current
    const selection = window.getSelection()

    if (!range || !selection) return

    selection.removeAllRanges()
    selection.addRange(range)
  }, [])

  /** 본문 내용을 부모에게 알립니다. */
  const emit = useCallback(() => {
    const body = bodyRef.current
    if (!body) return

    // 내용이 없으면 <br> 만 남는 경우가 있어 비워 둡니다.
    if (!hasContent(body)) body.innerHTML = ''

    syncEmpty()

    const html = body.innerHTML
    lastHtml.current = html
    onChange(html)
  }, [onChange, syncEmpty])

  /** 툴바 활성 상태 갱신 */
  const syncToolbar = useCallback(() => {
    const body = bodyRef.current
    const selection = window.getSelection()

    if (!body || !selection || selection.rangeCount === 0) return
    if (!body.contains(selection.anchorNode)) return

    saveSelection()

    const block = String(document.queryCommandValue('formatBlock') ?? '').toLowerCase()

    setToolbar((prev) => {
      const next = {
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strike: document.queryCommandState('strikeThrough'),
        block: BLOCKS.some((item) => item.value === block) ? block : 'p',
      }

      const same =
        prev.bold === next.bold &&
        prev.italic === next.italic &&
        prev.underline === next.underline &&
        prev.strike === next.strike &&
        prev.block === next.block

      return same ? prev : next
    })
  }, [saveSelection])

  // 본문 밖(문서 어디든)에서 선택이 바뀌어도 툴바를 갱신합니다.
  useEffect(() => {
    const handler = () => syncToolbar()
    document.addEventListener('selectionchange', handler)
    return () => document.removeEventListener('selectionchange', handler)
  }, [syncToolbar])

  /** 서식 명령 실행 */
  const exec = useCallback(
    (command: string, argument?: string) => {
      if (disabled) return

      restoreSelection()
      document.execCommand(command, false, argument)
      emit()
      syncToolbar()
    },
    [disabled, emit, restoreSelection, syncToolbar],
  )

  /** 이미지 1장을 본문에 넣습니다. */
  const insertImage = useCallback(
    async (file: File) => {
      if (disabled || uploading) return

      if (!file.type.startsWith('image/')) {
        window.alert('이미지 파일만 넣을 수 있습니다.')
        return
      }

      saveSelection()
      setUploading(true)

      try {
        const url = onUploadImage
          ? (await onUploadImage(file)).url
          : await readAsDataUrl(file)

        exec('insertHTML', `<p><img src="${escapeAttr(url)}" alt=""></p>`)
      } catch (err) {
        window.alert(
          err instanceof Error ? err.message : '이미지를 넣지 못했습니다.',
        )
      } finally {
        setUploading(false)
      }
    },
    [disabled, uploading, saveSelection, onUploadImage, exec],
  )

  const pickImage = () => {
    if (disabled || uploading) return
    saveSelection()
    imageInputRef.current?.click()
  }

  const insertLink = () => {
    const url = window.prompt('링크 주소를 입력하세요.', 'https://')
    if (!url) return
    exec('createLink', url)
  }

  const insertTable = () => {
    const answer = window.prompt('표 크기를 입력하세요. (행 x 열)', '3x3')
    if (!answer) return

    const match = answer.replace(/\s/g, '').match(/^(\d{1,2})[x×,](\d{1,2})$/)
    const rows = match ? Math.min(20, Math.max(1, Number(match[1]))) : 3
    const cols = match ? Math.min(10, Math.max(1, Number(match[2]))) : 3

    let html = '<table style="border-collapse:collapse;width:100%">'

    for (let row = 0; row < rows; row += 1) {
      html += '<tr>'
      for (let col = 0; col < cols; col += 1) {
        html +=
          '<td style="border:1px solid #ccc;padding:6px 10px;min-width:30px">&nbsp;</td>'
      }
      html += '</tr>'
    }

    html += '</table><p><br></p>'

    exec('insertHTML', html)
  }

  /** HTML 소스 보기 전환 */
  const toggleSource = () => {
    if (disabled) return

    if (!sourceMode) {
      setSource(bodyRef.current?.innerHTML ?? lastHtml.current)
      setSourceMode(true)
      return
    }

    const body = bodyRef.current

    if (body) {
      body.innerHTML = source
      lastHtml.current = source
      syncEmpty()
    }

    setSourceMode(false)
    onChange(source)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)

    const file = Array.from(event.dataTransfer.files).find((item) =>
      item.type.startsWith('image/'),
    )

    if (file) void insertImage(file)
  }

  const toolbarButton = (
    icon: string,
    title: string,
    command: string,
    argument?: string,
    active = false,
  ) => (
    <button
      type="button"
      className={active ? 'te-btn is-active' : 'te-btn'}
      title={title}
      aria-label={title}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => exec(command, argument)}
    >
      <span className="material-icons">{icon}</span>
    </button>
  )

  return (
    <div
      className={[
        'rich_editor_outer',
        dragging ? 'is-dragover' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      onDragOver={(event) => {
        if (disabled) return
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <div className="te-toolbar">
        {toolbarButton('undo', '실행 취소', 'undo')}
        {toolbarButton('redo', '다시 실행', 'redo')}

        <span className="te-sep" />

        <select
          className="te-select"
          title="문단 서식"
          aria-label="문단 서식"
          value={toolbar.block}
          disabled={disabled}
          onChange={(event) => exec('formatBlock', `<${event.target.value}>`)}
        >
          {BLOCKS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>

        <select
          className="te-select"
          title="글자 크기"
          aria-label="글자 크기"
          defaultValue=""
          disabled={disabled}
          onChange={(event) => {
            if (!event.target.value) return
            exec('fontSize', event.target.value)
            event.target.value = ''
          }}
        >
          <option value="">크기</option>
          {SIZES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>

        <span className="te-sep" />

        {toolbarButton('format_bold', '굵게', 'bold', undefined, toolbar.bold)}
        {toolbarButton('format_italic', '기울임', 'italic', undefined, toolbar.italic)}
        {toolbarButton(
          'format_underlined',
          '밑줄',
          'underline',
          undefined,
          toolbar.underline,
        )}
        {toolbarButton(
          'strikethrough_s',
          '취소선',
          'strikeThrough',
          undefined,
          toolbar.strike,
        )}

        {/* 글자색 */}
        <div className="te-color-wrap">
          <button
            type="button"
            className="te-btn te-color-btn"
            title="글자색"
            aria-label="글자색"
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setColorOpen((open) => !open)}
          >
            <span className="te-color-label">A</span>
            <span className="te-color-bar" style={{ background: '#dc2626' }} />
          </button>

          {colorOpen && (
            <div className="te-color-picker">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className="te-color-swatch"
                  style={{ background: color }}
                  title={color}
                  aria-label={color}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setColorOpen(false)
                    exec('foreColor', color)
                  }}
                />
              ))}
              <button
                type="button"
                className="te-color-swatch te-color-unset"
                title="색 없음"
                aria-label="색 없음"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setColorOpen(false)
                  exec('removeFormat')
                }}
              >
                ✕
              </button>
            </div>
          )}
        </div>

        <span className="te-sep" />

        {toolbarButton('format_align_left', '왼쪽 정렬', 'justifyLeft')}
        {toolbarButton('format_align_center', '가운데 정렬', 'justifyCenter')}
        {toolbarButton('format_align_right', '오른쪽 정렬', 'justifyRight')}
        {toolbarButton('format_align_justify', '양쪽 정렬', 'justifyFull')}

        <span className="te-sep" />

        {toolbarButton('format_list_bulleted', '글머리 기호', 'insertUnorderedList')}
        {toolbarButton('format_list_numbered', '번호 목록', 'insertOrderedList')}
        {toolbarButton('format_quote', '인용', 'formatBlock', '<blockquote>')}

        <span className="te-sep" />

        <button
          type="button"
          className="te-btn"
          title="링크"
          aria-label="링크"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={insertLink}
        >
          <span className="material-icons">link</span>
        </button>

        <button
          type="button"
          className="te-btn"
          title="표 넣기"
          aria-label="표 넣기"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={insertTable}
        >
          <span className="material-icons">table_chart</span>
        </button>

        {toolbarButton('horizontal_rule', '구분선', 'insertHorizontalRule')}

        <button
          type="button"
          className="te-btn"
          title="사진 넣기"
          aria-label="사진 넣기"
          disabled={disabled || uploading}
          onMouseDown={(event) => event.preventDefault()}
          onClick={pickImage}
        >
          <span className="material-icons">
            {uploading ? 'hourglass_top' : 'image'}
          </span>
        </button>

        <span className="te-sep" />

        {toolbarButton('format_clear', '서식 지우기', 'removeFormat')}

        <button
          type="button"
          className={sourceMode ? 'te-btn is-active' : 'te-btn'}
          title="HTML 소스 보기"
          aria-label="HTML 소스 보기"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={toggleSource}
        >
          <span className="material-icons">code</span>
        </button>
      </div>

      <div className="te-content">
        <div
          ref={bodyRef}
          className="ProseMirror rich_editor_body"
          contentEditable={!disabled}
          suppressContentEditableWarning
          spellCheck={false}
          data-placeholder={placeholder}
          style={sourceMode ? { display: 'none' } : undefined}
          onInput={emit}
          onKeyUp={syncToolbar}
          onMouseUp={syncToolbar}
          onFocus={syncToolbar}
        />

        {sourceMode && (
          <textarea
            className="html_source_area"
            value={source}
            spellCheck={false}
            aria-label="HTML 소스"
            onChange={(event) => setSource(event.target.value)}
          />
        )}
      </div>

      <input
        ref={imageInputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        style={{ display: 'none' }}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void insertImage(file)
        }}
      />
    </div>
  )
}
