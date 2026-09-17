import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AdminHeader from '@/components/admin/AdminHeader'
import AdminSidebar from '@/components/admin/AdminSidebar'
import RichEditor from '@/components/admin/RichEditor'
import {
  createReport,
  updateReport,
  fetchReportDetail,
  deleteReportFile,
  type ReportFile,
} from '@/api/report'
import { toAbsUrl } from '@/utils/uploadUrl'

export default function AdminDataFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [existingFiles, setExistingFiles] = useState<ReportFile[]>([])
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [newFilePreviews, setNewFilePreviews] = useState<(string | null)[]>([])
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(isEdit)

  const isImageFile = (name: string) => /\.(jpg|jpeg|png|gif|webp)$/i.test(name)

  useEffect(() => {
    if (!isEdit) return
    fetchReportDetail(Number(id), true)
      .then((res) => {
        setTitle(res.item.title)
        setContent(res.item.content ?? '')
        setExistingFiles(res.files)
      })
      .catch(() => {
        alert('게시글을 불러오지 못했습니다.')
        navigate('/admin/data')
      })
      .finally(() => setFetching(false))
  }, [id, isEdit, navigate])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]
    // 기존 미리보기 URL 해제
    newFilePreviews.forEach((p) => { if (p) URL.revokeObjectURL(p) })
    setNewFiles([file])
    setNewFilePreviews([isImageFile(file.name) ? URL.createObjectURL(file) : null])
    e.target.value = ''
  }

  const removeNewFile = (index: number) => {
    const preview = newFilePreviews[index]
    if (preview) URL.revokeObjectURL(preview)
    setNewFiles((prev) => prev.filter((_, i) => i !== index))
    setNewFilePreviews((prev) => prev.filter((_, i) => i !== index))
  }

  const handleDeleteExistingFile = async (fileId: number) => {
    if (!confirm('첨부파일을 삭제하시겠습니까?')) return
    try {
      await deleteReportFile(fileId)
      setExistingFiles((prev) => prev.filter((f) => f.id !== fileId))
    } catch {
      alert('파일 삭제에 실패했습니다.')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      alert('제목을 입력해주세요.')
      return
    }

    setLoading(true)
    try {
      if (isEdit) {
        await updateReport(Number(id), title, content, newFiles.length > 0 ? newFiles : undefined)
        alert('수정되었습니다.')
      } else {
        await createReport(title, content, newFiles.length > 0 ? newFiles : undefined)
        alert('등록되었습니다.')
      }
      navigate('/admin/data')
    } catch (err: unknown) {
      alert(err instanceof Error && err.message ? err.message : '저장에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <div className="adm_wrap">
        <AdminSidebar />
        <div className="adm_content">
          <AdminHeader pageTitle="자료실 관리" />
          <main className="adm_main">
            <p style={{ padding: '2rem' }}>불러오는 중...</p>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="adm_wrap">
      <AdminSidebar />
      <div className="adm_content">
        <AdminHeader pageTitle={isEdit ? '자료실 수정' : '자료실 등록'} />
        <main className="adm_main">
          <section className="adm_section">
            <form className="adm_form" onSubmit={handleSubmit}>

              {/* 제목 */}
              <div className="adm_form_row">
                <label className="adm_form_label">
                  제목 <span className="required">*</span>
                </label>
                <input
                  type="text"
                  className="adm_form_input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="제목을 입력해주세요."
                  required
                />
              </div>

              {/* 내용 */}
              <div className="adm_form_row adm_form_row_col">
                <label className="adm_form_label">내용</label>
                <RichEditor value={content} onChange={setContent} />
              </div>

              {/* 첨부파일 */}
              <div className="adm_form_row adm_form_row_col">
                <label className="adm_form_label">첨부파일</label>
                <div>
                  {existingFiles.length > 0 && (
                    <ul className="adm_file_list">
                      {existingFiles.map((f) => (
                        <li key={f.id} className="adm_file_item">
                          {/^(jpg|jpeg|png|gif|webp)$/i.test(f.file_ext) && (
                            <img
                              src={toAbsUrl(f.file_url)}
                              className="adm_file_thumb"
                              alt={f.ori_name}
                            />
                          )}
                          <a
                            href={toAbsUrl(f.file_url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="adm_file_name"
                          >
                            {f.ori_name}
                          </a>
                          <button
                            type="button"
                            className="adm_file_del"
                            onClick={() => handleDeleteExistingFile(f.id)}
                          >
                            <span className="material-icons">close</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {newFiles.map((f, i) => (
                    <div key={i} className="adm_file_item adm_file_new">
                      {newFilePreviews[i] && (
                        <img src={newFilePreviews[i]!} className="adm_file_thumb" alt={f.name} />
                      )}
                      <span className="adm_file_name">{f.name}</span>
                      <button type="button" className="adm_file_del" onClick={() => removeNewFile(i)}>
                        <span className="material-icons">close</span>
                      </button>
                    </div>
                  ))}
                  <label className="adm_file_btn">
                    <span className="material-icons">attach_file</span>
                    파일 선택
                    <input
                      type="file"
                      onChange={handleFileChange}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              </div>

              <div className="adm_form_btns">
                <button
                  type="button"
                  className="adm_btn_secondary"
                  onClick={() => navigate('/admin/data')}
                >
                  취소
                </button>
                <button type="submit" className="adm_btn_primary" disabled={loading}>
                  {loading ? '저장 중...' : isEdit ? '수정 완료' : '등록'}
                </button>
              </div>
            </form>
          </section>
        </main>
      </div>
    </div>
  )
}
