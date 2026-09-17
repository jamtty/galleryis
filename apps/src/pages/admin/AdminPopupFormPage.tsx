import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  POPUP_IMAGE_LIMIT,
  POPUP_LINK_TARGETS,
  POPUP_SORT_OPTIONS,
  POPUP_USE_OPTIONS,
  createPopup,
  fetchPopupDetail,
  updatePopup,
  type PopupItem,
  type PopupUse,
} from '@/api/popups'
import AdminAlert from '@/components/admin/AdminAlert'
import AdminPage from '@/components/admin/AdminPage'
import DatePicker from '@/components/admin/DatePicker'
import { PATHS } from '@/routes/paths'

/**
 * 관리자 — 팝업 등록 / 수정.
 *
 *   /admin/popups/write     등록
 *   /admin/popups/edit/:id  수정 (목록의 [상세])
 *
 * 팝업은 이미지 1장이 있어야 띄울 수 있어서, 수정할 때도 기존 이미지를 지우지 않고
 * 새 이미지를 고르면 그때만 교체합니다.
 */
export default function AdminPopupFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()

  const editId = Number(id)
  const isEdit = Number.isInteger(editId) && editId > 0

  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [linkTarget, setLinkTarget] = useState<string>(POPUP_LINK_TARGETS[0].value)
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [useYn, setUseYn] = useState<PopupUse>('Y')
  const [sortOrder, setSortOrder] = useState('1')
  const [posLeft, setPosLeft] = useState('0')
  const [posTop, setPosTop] = useState('0')

  /** 새로 고른 이미지 (수정 시에는 기존 이미지가 그대로 남습니다) */
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [dragging, setDragging] = useState(false)
  /** 수정 모드 — 서버에 저장된 팝업 정보 */
  const [current, setCurrent] = useState<PopupItem | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  /** createObjectURL 로 만든 주소 (되돌려 줄 때 씁니다) */
  const previewRef = useRef('')

  const [loading, setLoading] = useState(isEdit)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** 저장 완료 안내 알럿 문구 (null 이면 닫힘) */
  const [done, setDone] = useState<string | null>(null)

  const back = () => navigate(PATHS.adminPopups)

  // 미리보기 주소 정리
  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    },
    [],
  )

  // 수정 모드 — 저장된 내용을 채웁니다.
  useEffect(() => {
    if (!isEdit) return

    let cancelled = false

    fetchPopupDetail(editId)
      .then((res) => {
        if (cancelled) return

        setCurrent(res)
        setTitle(res.title)
        setUrl(res.url)
        setLinkTarget(res.linkTarget || POPUP_LINK_TARGETS[0].value)
        setPeriodStart(res.periodStart)
        setPeriodEnd(res.periodEnd)
        setUseYn(res.useYn === 'N' ? 'N' : 'Y')
        setSortOrder(String(res.sortOrder || 1))
        setPosLeft(String(res.posLeft ?? 0))
        setPosTop(String(res.posTop ?? 0))
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadError(
          err instanceof Error ? err.message : '팝업을 불러오지 못했습니다.',
        )
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [editId, isEdit])

  /** 새 이미지 선택 (없애면 null) */
  const pickImage = (file: File | null) => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current)
      previewRef.current = ''
    }

    if (!file) {
      setImageFile(null)
      setPreviewUrl('')

      return
    }

    if (!POPUP_IMAGE_LIMIT.accept.split(',').includes(file.type)) {
      setError('jpg · png · gif · webp 이미지만 올릴 수 있습니다.')

      return
    }

    if (file.size > POPUP_IMAGE_LIMIT.sizeMB * 1048576) {
      setError(`이미지는 ${POPUP_IMAGE_LIMIT.sizeMB}MB 이하만 올릴 수 있습니다.`)

      return
    }

    const objectUrl = URL.createObjectURL(file)

    previewRef.current = objectUrl
    setError(null)
    setImageFile(file)
    setPreviewUrl(objectUrl)
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    pickImage(event.target.files?.[0] ?? null)
    // 같은 파일을 다시 골라도 반응하도록 비웁니다.
    event.target.value = ''
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)

    if (saving) return

    pickImage(event.dataTransfer.files?.[0] ?? null)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!title.trim()) {
      setError('제목을 입력해 주세요.')
      return
    }

    if (!isEdit && !imageFile) {
      setError('팝업 이미지를 선택해 주세요.')
      return
    }

    if (periodStart && periodEnd && periodStart > periodEnd) {
      setError('노출 종료일은 시작일보다 빠를 수 없습니다.')
      return
    }

    setSaving(true)

    const input = {
      title: title.trim(),
      url: url.trim(),
      link_target: linkTarget,
      period_start: periodStart,
      period_end: periodEnd,
      use_yn: useYn,
      sort_order: Number(sortOrder) || 1,
      img_pos_left: Number(posLeft) || 0,
      img_pos_top: Number(posTop) || 0,
    }

    try {
      if (isEdit) {
        await updatePopup(editId, input, imageFile)
      } else {
        await createPopup(input, imageFile as File)
      }

      // 저장 결과를 알리고, [확인] 을 누르면 목록으로 돌아갑니다.
      setDone(isEdit ? '수정되었습니다.' : '등록되었습니다.')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isEdit
            ? '팝업을 수정하지 못했습니다.'
            : '팝업을 등록하지 못했습니다.',
      )
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setSaving(false)
    }
  }

  const pageTitle = isEdit ? '팝업수정' : '팝업등록'

  const submitLabel = saving
    ? isEdit
      ? '수정 중...'
      : '등록 중...'
    : isEdit
      ? '수정'
      : '등록'

  // 수정 모드 — 불러오기에 실패한 경우
  if (loadError) {
    return (
      <AdminPage title={pageTitle}>
        <section className="adm_section">
          <h2 className="adm_section_title">{pageTitle}</h2>
          <p className="adm_table_notice">{loadError}</p>
          <div className="adm_page_btns">
            <button type="button" className="adm_btn_primary" onClick={back}>
              목록으로
            </button>
          </div>
        </section>
      </AdminPage>
    )
  }

  if (loading) {
    return (
      <AdminPage title={pageTitle}>
        <section className="adm_section">
          <h2 className="adm_section_title">{pageTitle}</h2>
          <p className="adm_table_notice">불러오는 중입니다...</p>
        </section>
      </AdminPage>
    )
  }

  // 화면에 보여 줄 이미지 — 새로 고른 파일이 있으면 그것부터
  const showUrl = previewUrl || current?.imageUrl || ''

  return (
    <AdminPage title={pageTitle}>
      <section className="adm_section">
        <h2 className="adm_section_title">{pageTitle}</h2>

        {error && <p className="adm_table_notice">{error}</p>}

        <form className="adm_form" onSubmit={handleSubmit} noValidate>
          {/* 제목 */}
          <div className="adm_form_row">
            <label className="adm_form_label" htmlFor="pop_title">
              제목 <span className="required">*</span>
            </label>
            <input
              id="pop_title"
              type="text"
              className="adm_form_input"
              value={title}
              maxLength={200}
              placeholder="관리용 제목입니다. (화면에는 이미지만 보입니다)"
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          {/* 팝업 이미지 */}
          <div className="adm_form_row adm_form_row_col">
            <span className="adm_form_label">
              팝업 이미지 {!isEdit && <span className="required">*</span>}
            </span>

            <div className="adm_image_field">
              <div
                className={
                  dragging ? 'adm_image_drop is-dragging' : 'adm_image_drop'
                }
                role="button"
                tabIndex={0}
                aria-label="팝업 이미지 선택"
                onClick={() => {
                  if (!saving) inputRef.current?.click()
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    if (!saving) inputRef.current?.click()
                  }
                }}
                onDragOver={(event) => {
                  event.preventDefault()
                  if (!saving) setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
              >
                {showUrl
                  ? '이미지를 바꾸려면 새 파일을 끌어다 놓거나 눌러서 고르세요.'
                  : `이미지를 끌어다 놓거나 눌러서 고르세요. (${POPUP_IMAGE_LIMIT.sizeMB}MB 이하 jpg · png · gif · webp)`}
                <input
                  ref={inputRef}
                  type="file"
                  accept={POPUP_IMAGE_LIMIT.accept}
                  disabled={saving}
                  onChange={handleFileChange}
                />
              </div>

              {showUrl && (
                <div className="adm_image_preview">
                  <img src={showUrl} alt="팝업 이미지 미리보기" />

                  {imageFile && (
                    <button
                      type="button"
                      className="adm_dropzone_remove"
                      aria-label="고른 이미지 취소"
                      onClick={() => pickImage(null)}
                    >
                      ×
                    </button>
                  )}
                </div>
              )}

              {imageFile ? (
                <p className="adm_image_meta">
                  {imageFile.name} · {(imageFile.size / 1048576).toFixed(1)}MB
                  (저장하면 교체됩니다)
                </p>
              ) : (
                current?.imageName && (
                  <p className="adm_image_meta">
                    현재 이미지: {current.imageName}
                    {current.width > 0 && current.height > 0
                      ? ` (${current.width}×${current.height})`
                      : ''}
                  </p>
                )
              )}
            </div>
          </div>

          {/* 링크 */}
          <div className="adm_form_row">
            <label className="adm_form_label" htmlFor="pop_url">
              링크 주소
            </label>
            <input
              id="pop_url"
              type="text"
              className="adm_form_input"
              value={url}
              maxLength={500}
              placeholder="https://... 또는 /exhibitions (비우면 링크 없음)"
              onChange={(event) => setUrl(event.target.value)}
            />
          </div>

          <div className="adm_form_row">
            <label className="adm_form_label" htmlFor="pop_target">
              링크 열기
            </label>
            <select
              id="pop_target"
              className="adm_search_select"
              value={linkTarget}
              onChange={(event) => setLinkTarget(event.target.value)}
            >
              {POPUP_LINK_TARGETS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          {/* 노출기간 */}
          <div className="adm_form_row">
            <span className="adm_form_label">노출기간</span>
            <div className="adm_form_inline">
              <DatePicker
                value={periodStart}
                onChange={setPeriodStart}
                maxDate={periodEnd || undefined}
                placeholder="시작일"
                variant="form"
                disabled={saving}
              />
              <span>~</span>
              <DatePicker
                value={periodEnd}
                onChange={setPeriodEnd}
                minDate={periodStart || undefined}
                placeholder="종료일"
                variant="form"
                disabled={saving}
              />
              <span className="adm_input_hint">비우면 상시 노출입니다.</span>
            </div>
          </div>

          {/* 사용 여부 */}
          <div className="adm_form_row">
            <span className="adm_form_label">사용 여부</span>
            <div className="adm_radio_field">
              <div className="adm_radio_cards" role="radiogroup" aria-label="사용 여부">
                {POPUP_USE_OPTIONS.map((item) => (
                  <label
                    key={item.value}
                    className={
                      useYn === item.value
                        ? 'adm_radio_card is-selected'
                        : 'adm_radio_card'
                    }
                  >
                    <input
                      type="radio"
                      name="pop_use_yn"
                      value={item.value}
                      checked={useYn === item.value}
                      disabled={saving}
                      onChange={() => setUseYn(item.value)}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>

              <p className="adm_input_hint">
                미사용으로 두면 목록에는 남고 공개 사이트에는 뜨지 않습니다.
              </p>
            </div>
          </div>

          {/* 정렬 순서 */}
          <div className="adm_form_row">
            <label className="adm_form_label" htmlFor="pop_sort">
              정렬 순서
            </label>
            <select
              id="pop_sort"
              className="adm_search_select"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
            >
              {POPUP_SORT_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          {/* 노출 위치 */}
          <div className="adm_form_row">
            <span className="adm_form_label">노출 위치</span>
            <div className="adm_form_inline">
              <span className="adm_input_hint">좌측</span>
              <input
                type="number"
                className="adm_form_input"
                style={{ width: '10rem' }}
                value={posLeft}
                aria-label="좌측 위치"
                onChange={(event) => setPosLeft(event.target.value)}
              />
              <span>px</span>
              <span className="adm_input_hint">상단</span>
              <input
                type="number"
                className="adm_form_input"
                style={{ width: '10rem' }}
                value={posTop}
                aria-label="상단 위치"
                onChange={(event) => setPosTop(event.target.value)}
              />
              <span>px</span>
              <span className="adm_input_hint">
                0 이면 가운데에 뜹니다.
              </span>
            </div>
          </div>

          <div className="adm_form_btns">
            <button
              type="button"
              className="adm_btn_secondary"
              onClick={back}
              disabled={saving}
            >
              취소
            </button>
            <button type="submit" className="adm_btn_primary" disabled={saving}>
              {submitLabel}
            </button>
          </div>
        </form>
      </section>

      <AdminAlert open={done !== null} title={done ?? ''} onClose={back} />
    </AdminPage>
  )
}
