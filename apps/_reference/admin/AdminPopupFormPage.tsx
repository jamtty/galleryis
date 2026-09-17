import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AdminHeader from '@/components/admin/AdminHeader'
import AdminSidebar from '@/components/admin/AdminSidebar'
import {
  createPopup,
  updatePopup,
  fetchPopupDetail,
  type PopupItem,
} from '@/api/popup'

const SORT_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1)

export default function AdminPopupFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)

  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [linkTarget, setLinkTarget] = useState('_self')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [useYn, setUseYn] = useState<'Y' | 'N'>('N')
  const [sortOrder, setSortOrder] = useState('')
  const [imgPosLeft, setImgPosLeft] = useState('0')
  const [imgPosTop, setImgPosTop] = useState('0')

  const [imgFile, setImgFile] = useState<File | null>(null)
  const [imgPreview, setImgPreview] = useState('')
  const [imgCurrentUrl, setImgCurrentUrl] = useState('')

  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(isEdit)

  useEffect(() => {
    if (!isEdit) return
    fetchPopupDetail(Number(id))
      .then((item: PopupItem) => {
        setTitle(item.title)
        setUrl(item.url || '')
        setLinkTarget(item.link_target || '_self')
        setPeriodStart(item.period_start || '')
        setPeriodEnd(item.period_end || '')
        setUseYn(item.use_yn === 'Y' ? 'Y' : 'N')
        setSortOrder(item.sort_order != null ? String(item.sort_order) : '')
        setImgPosLeft(item.img_pos_left ? String(item.img_pos_left) : '0')
        setImgPosTop(item.img_pos_top ? String(item.img_pos_top) : '0')
        setImgCurrentUrl(item.img_url_full || '')
      })
      .catch(() => {
        alert('팝업 정보를 불러오지 못했습니다.')
        navigate('/admin/popup')
      })
      .finally(() => setFetching(false))
  }, [id, isEdit, navigate])

  const handleImgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImgFile(file)
    setImgPreview(URL.createObjectURL(file))
    e.target.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { alert('제목을 입력해주세요.'); return }
    if (!isEdit && !imgFile) { alert('팝업 이미지를 선택해주세요.'); return }

    const fd = new FormData()
    fd.append('title', title.trim())
    fd.append('url', url.trim())
    fd.append('link_target', linkTarget)
    fd.append('period_start', periodStart)
    fd.append('period_end', periodEnd)
    fd.append('use_yn', useYn)
    fd.append('sort_order', sortOrder)
    fd.append('img_pos_left', imgPosLeft || '0')
    fd.append('img_pos_top', imgPosTop || '0')
    if (imgFile) fd.append('img_file', imgFile)

    setLoading(true)
    try {
      if (isEdit) {
        await updatePopup(Number(id), fd)
        alert('수정되었습니다.')
      } else {
        await createPopup(fd)
        alert('등록되었습니다.')
      }
      navigate('/admin/popup')
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (fetching) return (
    <div className="adm_wrap">
      <AdminSidebar />
      <div className="adm_content">
        <AdminHeader pageTitle={isEdit ? '팝업 수정' : '팝업 등록'} />
        <main className="adm_main"><div className="adm_loading">불러오는 중...</div></main>
      </div>
    </div>
  )

  return (
    <div className="adm_wrap">
      <AdminSidebar />
      <div className="adm_content">
        <AdminHeader pageTitle={isEdit ? '팝업 수정' : '팝업 등록'} />
        <main className="adm_main">
          <section className="adm_section">
            <form className="adm_form" onSubmit={handleSubmit}>
              <div className="adm_form_row">
                <label className="adm_form_label" htmlFor="popup_title">
                  제목 <span className="required">*</span>
                </label>
                <input
                  id="popup_title"
                  type="text"
                  className="adm_form_input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="관리용 팝업 제목"
                />
              </div>

              <div className="adm_form_row">
                <label className="adm_form_label" htmlFor="popup_url">링크 URL</label>
                <input
                  id="popup_url"
                  type="text"
                  className="adm_form_input"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>

              <div className="adm_form_row">
                <label className="adm_form_label">링크 대상</label>
                <select
                  className="adm_search_select"
                  value={linkTarget}
                  onChange={(e) => setLinkTarget(e.target.value)}
                >
                  <option value="_self">현재 창</option>
                  <option value="_blank">새 창</option>
                </select>
              </div>

              <div className="adm_form_row">
                <label className="adm_form_label">게시 기간</label>
                <div className="adm_form_inline">
                  <input
                    type="date"
                    className="adm_form_input"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                  />
                  <span className="adm_form_sep">~</span>
                  <input
                    type="date"
                    className="adm_form_input"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                  />
                  <span className="adm_form_hint">미입력 시 상시 노출</span>
                </div>
              </div>

              <div className="adm_form_row">
                <label className="adm_form_label">사용 여부</label>
                <select
                  className="adm_search_select"
                  value={useYn}
                  onChange={(e) => setUseYn(e.target.value as 'Y' | 'N')}
                >
                  <option value="Y">사용</option>
                  <option value="N">미사용</option>
                </select>
              </div>

              <div className="adm_form_row">
                <label className="adm_form_label" htmlFor="sort_order">정렬 순서</label>
                <select
                  id="sort_order"
                  className="adm_search_select"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                >
                  <option value="">선택</option>
                  {SORT_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>

              <div className="adm_form_row">
                <label className="adm_form_label">팝업 위치</label>
                <div className="adm_form_inline">
                  <span className="adm_form_hint">좌측</span>
                  <input
                    type="number"
                    className="adm_form_input adm_form_input_sm"
                    placeholder="left"
                    value={imgPosLeft}
                    onChange={(e) => setImgPosLeft(e.target.value)}
                  />
                  <span className="adm_form_sep">px</span>
                  <span className="adm_form_hint">상단</span>
                  <input
                    type="number"
                    className="adm_form_input adm_form_input_sm"
                    placeholder="top"
                    value={imgPosTop}
                    onChange={(e) => setImgPosTop(e.target.value)}
                  />
                  <span className="adm_form_sep">px</span>
                  <span className="adm_form_hint">0 = 중앙 정렬</span>
                </div>
              </div>

              <div className="adm_form_row">
                <label className="adm_form_label">
                  팝업 이미지 {!isEdit && <span className="required">*</span>}
                </label>
                <div className="adm_form_file_wrap">
                  <input type="file" accept="image/*" onChange={handleImgChange} />
                  {(imgPreview || imgCurrentUrl) && (
                    <div className="adm_form_preview" style={{ marginTop: '1.2rem' }}>
                      <img src={imgPreview || imgCurrentUrl} alt="팝업 미리보기" />
                    </div>
                  )}
                </div>
              </div>

              <div className="adm_form_btns">
                <button type="button" className="adm_btn_secondary" onClick={() => navigate('/admin/popup')}>
                  취소
                </button>
                <button type="submit" className="adm_btn_primary" disabled={loading}>
                  {loading ? '저장 중...' : isEdit ? '수정' : '등록'}
                </button>
              </div>
            </form>
          </section>
        </main>
      </div>
    </div>
  )
}
