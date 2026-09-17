import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  EXHIBITION_FILE_LIMIT,
  EXHIBITION_REGISTERED_STATUSES,
  EXHIBITION_USE_OPTIONS,
  createExhibition,
  fetchExhibitionDetail,
  updateExhibition,
  uploadEditorImage,
  type ExhibitionFile,
  type ExhibitionRegisteredStatus,
  type ExhibitionUse,
} from '@/api/exhibitions'
import AdminAlert from '@/components/admin/AdminAlert'
import AdminPage from '@/components/admin/AdminPage'
import ArtworkDropzone from '@/components/admin/ArtworkDropzone'
import DatePicker from '@/components/admin/DatePicker'
import RichEditor from '@/components/admin/RichEditor'
import { PATHS } from '@/routes/paths'

/**
 * 관리자 — 전시 등록 / 수정.
 *
 *   /admin/exhibitions/write     등록
 *   /admin/exhibitions/edit/:id  수정 (목록의 [상세])
 *
 * 전시개요 · 약력은 에디터(RichEditor)로 작성하고 HTML 로 저장합니다.
 * 작품등록은 드래그앤드랍으로 이미지를 올립니다.
 */
export default function AdminExhibitionFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()

  const editId = Number(id)
  const isEdit = Number.isInteger(editId) && editId > 0

  const [title, setTitle] = useState('')
  const [status, setStatus] = useState<ExhibitionRegisteredStatus>('current')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [place, setPlace] = useState('')
  const [artist, setArtist] = useState('')
  const [overview, setOverview] = useState('')
  const [bio, setBio] = useState('')
  /** 노출 여부 — 미사용이면 공개 사이트에 나오지 않습니다. */
  const [useYn, setUseYn] = useState<ExhibitionUse>('Y')

  const [files, setFiles] = useState<File[]>([])
  /** 서버에 저장된 작품 이미지 — 여기 남아 있는 것만 유지됩니다. */
  const [savedFiles, setSavedFiles] = useState<ExhibitionFile[]>([])

  const [loading, setLoading] = useState(isEdit)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** 저장 완료 안내 알럿 문구 (null 이면 닫힘) */
  const [done, setDone] = useState<string | null>(null)

  const back = () => navigate(PATHS.adminExhibitions)

  // 수정 모드 — 저장된 내용을 채웁니다.
  useEffect(() => {
    if (!isEdit) return

    let cancelled = false

    fetchExhibitionDetail(editId)
      .then((res) => {
        if (cancelled) return

        setTitle(res.title)
        // 지난전시는 날짜로 자동 분류된 값이라 등록 분류에 없습니다.
        setStatus(res.status === 'upcoming' ? 'upcoming' : 'current')
        setStartDate(res.startDate)
        setEndDate(res.endDate)
        setPlace(res.place)
        setArtist(res.artist)
        setOverview(res.overview)
        setBio(res.bio)
        setUseYn(res.useYn === 'N' ? 'N' : 'Y')
        setSavedFiles(res.files)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadError(
          err instanceof Error ? err.message : '전시를 불러오지 못했습니다.',
        )
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [editId, isEdit])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!title.trim()) {
      setError('전시회명을 입력해 주세요.')
      return
    }

    if (!startDate || !endDate) {
      setError('전시기간을 선택해 주세요.')
      return
    }

    if (startDate > endDate) {
      setError('전시 종료일은 시작일보다 빠를 수 없습니다.')
      return
    }

    if (!place.trim()) {
      setError('전시장소를 입력해 주세요.')
      return
    }

    if (!artist.trim()) {
      setError('작가명을 입력해 주세요.')
      return
    }

    setSaving(true)

    const input = {
      title: title.trim(),
      status,
      place: place.trim(),
      artist: artist.trim(),
      start_date: startDate,
      end_date: endDate,
      overview,
      bio,
      use_yn: useYn,
    }

    try {
      if (isEdit) {
        await updateExhibition(
          editId,
          input,
          files,
          // 화면에 남아 있는 작품 이미지만 유지합니다.
          savedFiles.map((file) => file.id),
        )
      } else {
        await createExhibition(input, files)
      }

      // 저장 결과를 알리고, [확인] 을 누르면 목록으로 돌아갑니다.
      setDone(isEdit ? '수정되었습니다.' : '등록되었습니다.')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isEdit
            ? '전시를 수정하지 못했습니다.'
            : '전시를 등록하지 못했습니다.',
      )
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setSaving(false)
    }
  }

  const pageTitle = isEdit ? '전시수정' : '전시등록'

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

  return (
    <AdminPage title={pageTitle}>
      <section className="adm_section">
        <h2 className="adm_section_title">{pageTitle}</h2>

        {error && <p className="adm_table_notice">{error}</p>}

        <form className="adm_form" onSubmit={handleSubmit} noValidate>
          {/* 분류 */}
          <div className="adm_form_row">
            <span className="adm_form_label">
              분류 <span className="required">*</span>
            </span>
            <div className="adm_radio_field">
              <div className="adm_radio_cards" role="radiogroup" aria-label="분류">
                {EXHIBITION_REGISTERED_STATUSES.map((item) => (
                  <label
                    key={item.value}
                    className={
                      status === item.value
                        ? 'adm_radio_card is-selected'
                        : 'adm_radio_card'
                    }
                  >
                    <input
                      type="radio"
                      name="ex_status"
                      value={item.value}
                      checked={status === item.value}
                      disabled={saving}
                      onChange={() => setStatus(item.value)}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>

              <p className="adm_input_hint">
                전시 시작일이 되면 현재전시로, 종료일이 지나면 지난전시로 자동
                분류됩니다.
              </p>
            </div>
          </div>

          {/* 노출 여부 */}
          <div className="adm_form_row">
            <span className="adm_form_label">노출 여부</span>
            <div className="adm_radio_field">
              <div className="adm_radio_cards" role="radiogroup" aria-label="노출 여부">
                {EXHIBITION_USE_OPTIONS.map((item) => (
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
                      name="ex_use_yn"
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
                미사용으로 두면 공개 사이트 전시 목록에 나오지 않습니다. (복사한
                전시를 확인할 때 씁니다)
              </p>
            </div>
          </div>

          {/* 전시회명 */}
          <div className="adm_form_row">
            <label className="adm_form_label" htmlFor="ex_title">
              전시회명 <span className="required">*</span>
            </label>
            <input
              id="ex_title"
              type="text"
              className="adm_form_input"
              value={title}
              maxLength={200}
              placeholder="전시회명을 입력해 주세요."
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          {/* 전시기간 */}
          <div className="adm_form_row">
            <span className="adm_form_label">
              전시기간 <span className="required">*</span>
            </span>
            <div className="adm_form_inline">
              <DatePicker
                value={startDate}
                onChange={setStartDate}
                maxDate={endDate || undefined}
                placeholder="시작일"
                variant="form"
                disabled={saving}
              />
              <span>~</span>
              <DatePicker
                value={endDate}
                onChange={setEndDate}
                minDate={startDate || undefined}
                placeholder="종료일"
                variant="form"
                disabled={saving}
              />
            </div>
          </div>

          {/* 전시장소 */}
          <div className="adm_form_row">
            <label className="adm_form_label" htmlFor="ex_place">
              전시장소 <span className="required">*</span>
            </label>
            <input
              id="ex_place"
              type="text"
              className="adm_form_input"
              value={place}
              maxLength={200}
              placeholder="예) 제1전시장 (1F)"
              onChange={(event) => setPlace(event.target.value)}
            />
          </div>

          {/* 작가명 */}
          <div className="adm_form_row">
            <label className="adm_form_label" htmlFor="ex_artist">
              작가명 <span className="required">*</span>
            </label>
            <input
              id="ex_artist"
              type="text"
              className="adm_form_input"
              value={artist}
              maxLength={200}
              placeholder="작가명을 입력해 주세요."
              onChange={(event) => setArtist(event.target.value)}
            />
          </div>

          {/* 전시개요 */}
          <div className="adm_form_row adm_form_row_col">
            <label className="adm_form_label">전시개요</label>
            <RichEditor
              value={overview}
              onChange={setOverview}
              placeholder="전시개요를 입력해 주세요."
              onUploadImage={uploadEditorImage}
              disabled={saving}
            />
          </div>

          {/* 약력 */}
          <div className="adm_form_row adm_form_row_col">
            <label className="adm_form_label">약력</label>
            <RichEditor
              value={bio}
              onChange={setBio}
              placeholder="작가 약력을 입력해 주세요."
              onUploadImage={uploadEditorImage}
              disabled={saving}
            />
          </div>

          {/* 작품등록 */}
          <div className="adm_form_row adm_form_row_col">
            <label className="adm_form_label">작품등록</label>
            <ArtworkDropzone
              files={files}
              onChange={(next) => {
                setError(null)
                setFiles(next)
              }}
              saved={savedFiles}
              onRemoveSaved={(fileId) => {
                setError(null)
                setSavedFiles((prev) =>
                  prev.filter((file) => file.id !== fileId),
                )
              }}
              max={EXHIBITION_FILE_LIMIT.max}
              sizeMB={EXHIBITION_FILE_LIMIT.sizeMB}
              totalMB={EXHIBITION_FILE_LIMIT.totalMB}
              accept={EXHIBITION_FILE_LIMIT.accept}
              onError={setError}
              disabled={saving}
            />
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
