import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  NOTICE_FILE_LIMIT,
  createNotice,
  fetchNoticeDetail,
  updateNotice,
  uploadNoticeEditorImage,
  type NoticeFile,
} from '@/api/notices'
import AdminAlert from '@/components/admin/AdminAlert'
import AdminPage from '@/components/admin/AdminPage'
import FileAttachField from '@/components/admin/FileAttachField'
import RichEditor from '@/components/admin/RichEditor'
import { PATHS } from '@/routes/paths'

/**
 * 관리자 — 공지 등록 / 수정.
 *
 *   /admin/notices/write     등록
 *   /admin/notices/edit/:id  수정 (목록의 [상세])
 *
 * 그누보드4 공지 테이블(g4_write_notice)에 저장됩니다.
 *   제목 → wr_subject · 내용 → wr_content(HTML) · 링크 → wr_link1/wr_link2
 *   첨부 → g4_board_file (실제 파일 uploads/notice/)
 */
export default function AdminNoticeFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()

  const editId = Number(id)
  const isEdit = Number.isInteger(editId) && editId > 0

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [link1, setLink1] = useState('')
  const [link2, setLink2] = useState('')
  /** 상단 고정 (공지 체크) */
  const [pinned, setPinned] = useState(false)

  const [files, setFiles] = useState<File[]>([])
  /** 서버에 저장된 첨부 — 여기 남아 있는 것만 유지됩니다. */
  const [savedFiles, setSavedFiles] = useState<NoticeFile[]>([])

  const [loading, setLoading] = useState(isEdit)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** 저장 완료 안내 알럿 문구 (null 이면 닫힘) */
  const [done, setDone] = useState<string | null>(null)

  const back = () => navigate(PATHS.adminNotices)

  // 수정 모드 — 저장된 내용을 채웁니다.
  useEffect(() => {
    if (!isEdit) return

    let cancelled = false

    fetchNoticeDetail(editId)
      .then((res) => {
        if (cancelled) return

        setTitle(res.title)
        setContent(res.content)
        setLink1(res.link1)
        setLink2(res.link2)
        setPinned(res.pinned)
        setSavedFiles(res.files)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadError(
          err instanceof Error ? err.message : '공지를 불러오지 못했습니다.',
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
      setError('제목을 입력해 주세요.')
      return
    }

    setSaving(true)

    const input = {
      title: title.trim(),
      content,
      link1: link1.trim(),
      link2: link2.trim(),
      pinned: (pinned ? 'Y' : 'N') as 'Y' | 'N',
    }

    try {
      if (isEdit) {
        await updateNotice(
          editId,
          input,
          files,
          // 화면에 남아 있는 첨부만 유지합니다.
          savedFiles.map((file) => file.no),
        )
      } else {
        await createNotice(input, files)
      }

      // 저장 결과를 알리고, [확인] 을 누르면 목록으로 돌아갑니다.
      setDone(isEdit ? '수정되었습니다.' : '등록되었습니다.')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isEdit
            ? '공지를 수정하지 못했습니다.'
            : '공지를 등록하지 못했습니다.',
      )
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setSaving(false)
    }
  }

  const pageTitle = isEdit ? '공지수정' : '공지등록'

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
          {/* 제목 */}
          <div className="adm_form_row">
            <label className="adm_form_label" htmlFor="nt_title">
              제목 <span className="required">*</span>
            </label>
            <input
              id="nt_title"
              type="text"
              className="adm_form_input"
              value={title}
              maxLength={255}
              placeholder="제목을 입력해 주세요."
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          {/* 옵션 */}
          <div className="adm_form_row">
            <span className="adm_form_label">옵션</span>
            <label className="adm_checkbox_label">
              <input
                type="checkbox"
                checked={pinned}
                disabled={saving}
                onChange={(event) => setPinned(event.target.checked)}
              />
              공지
            </label>
          </div>

          {/* 내용 */}
          <div className="adm_form_row adm_form_row_col">
            <label className="adm_form_label">내용</label>
            <RichEditor
              value={content}
              onChange={setContent}
              placeholder="내용을 입력해 주세요."
              disabled={saving}
              className="is-notice"
              // 본문 이미지는 파일로 올리고 주소만 넣습니다. (base64 로 넣으면
              // 저장 요청이 수 MB 가 되어 서버가 422 로 거절합니다)
              onUploadImage={uploadNoticeEditorImage}
            />
          </div>

          {/* 링크 #1 */}
          <div className="adm_form_row">
            <label className="adm_form_label" htmlFor="nt_link1">
              링크 #1
            </label>
            <input
              id="nt_link1"
              type="text"
              className="adm_form_input"
              value={link1}
              maxLength={255}
              placeholder="https://"
              onChange={(event) => setLink1(event.target.value)}
            />
          </div>

          {/* 링크 #2 */}
          <div className="adm_form_row">
            <label className="adm_form_label" htmlFor="nt_link2">
              링크 #2
            </label>
            <input
              id="nt_link2"
              type="text"
              className="adm_form_input"
              value={link2}
              maxLength={255}
              placeholder="https://"
              onChange={(event) => setLink2(event.target.value)}
            />
          </div>

          {/* 파일첨부 */}
          <div className="adm_form_row adm_form_row_col">
            <label className="adm_form_label">파일첨부</label>
            <FileAttachField
              files={files}
              onChange={(next) => {
                setError(null)
                setFiles(next)
              }}
              saved={savedFiles}
              onRemoveSaved={(no) => {
                setError(null)
                setSavedFiles((prev) => prev.filter((file) => file.no !== no))
              }}
              max={NOTICE_FILE_LIMIT.max}
              sizeMB={NOTICE_FILE_LIMIT.sizeMB}
              accept={NOTICE_FILE_LIMIT.accept}
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
