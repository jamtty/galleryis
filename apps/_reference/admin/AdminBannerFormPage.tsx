import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AdminHeader from '@/components/admin/AdminHeader'
import AdminSidebar from '@/components/admin/AdminSidebar'
import {
  createMainBanner,
  updateMainBanner,
  fetchMainBannerDetail,
  type MainBannerItem,
} from '@/api/mainBanner'

const SORT_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1)

export default function AdminBannerFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)

  const [title, setTitle] = useState('')
  const [displayYn, setDisplayYn] = useState<'Y' | 'N'>('N')
  const [sortOrder, setSortOrder] = useState('')

  // 이미지 web
  const [webFile, setWebFile] = useState<File | null>(null)
  const [webPreview, setWebPreview] = useState('')
  const [webCurrentUrl, setWebCurrentUrl] = useState('')
  const [webCurrentName, setWebCurrentName] = useState('')

  // 이미지 mobile
  const [mobileFile, setMobileFile] = useState<File | null>(null)
  const [mobilePreview, setMobilePreview] = useState('')
  const [mobileCurrentUrl, setMobileCurrentUrl] = useState('')
  const [mobileCurrentName, setMobileCurrentName] = useState('')

  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(isEdit)

  useEffect(() => {
    if (!isEdit) return
    fetchMainBannerDetail(Number(id))
      .then((item: MainBannerItem) => {
        setTitle(item.title)
        setDisplayYn(item.display_yn === 'Y' ? 'Y' : 'N')
        setSortOrder(item.sort_order != null ? String(item.sort_order) : '')
        setWebCurrentUrl(item.img_url_web || '')
        setWebCurrentName(item.img_web_ori || item.img_web || '')
        setMobileCurrentUrl(item.img_url_mobile || '')
        setMobileCurrentName(item.img_mobile_ori || item.img_mobile || '')
      })
      .catch(() => {
        alert('배너 정보를 불러오지 못했습니다.')
        navigate('/admin/banner')
      })
      .finally(() => setFetching(false))
  }, [id, isEdit, navigate])

  const handleWebChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setWebFile(file)
    setWebPreview(URL.createObjectURL(file))
    e.target.value = ''
  }

  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setMobileFile(file)
    setMobilePreview(URL.createObjectURL(file))
    e.target.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { alert('배너명을 입력해주세요.'); return }
    if (!isEdit && !webFile) { alert('이미지(web)를 선택해주세요.'); return }

    const fd = new FormData()
    fd.append('title', title.trim())
    fd.append('display_yn', displayYn)
    fd.append('sort_order', sortOrder)
    if (webFile) fd.append('img_web', webFile)
    if (mobileFile) fd.append('img_mobile', mobileFile)

    setLoading(true)
    try {
      if (isEdit) {
        await updateMainBanner(Number(id), fd)
        alert('수정되었습니다.')
      } else {
        await createMainBanner(fd)
        alert('등록되었습니다.')
      }
      navigate('/admin/banner')
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
        <AdminHeader pageTitle={isEdit ? '배너 수정' : '배너 등록'} />
        <main className="adm_main"><div className="adm_loading">불러오는 중...</div></main>
      </div>
    </div>
  )

  return (
    <div className="adm_wrap">
      <AdminSidebar />
      <div className="adm_content">
        <AdminHeader pageTitle={isEdit ? '배너 수정' : '배너 등록'} />
        <main className="adm_main">
          <section className="adm_section">
            <form className="adm_form" onSubmit={handleSubmit}>
              {/* 배너명 */}
              <div className="adm_form_row">
                <label className="adm_form_label" htmlFor="banner_title">
                  배너명 <span className="required">*</span>
                </label>
                <input
                  id="banner_title"
                  type="text"
                  className="adm_form_input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="배너명을 입력해주세요."
                />
              </div>

              {/* 이미지(web) */}
              <div className="adm_form_row">
                <span className="adm_form_label">
                  이미지(web){!isEdit && <> <span className="required">*</span></>}
                </span>
                <div style={{ flex: 1 }}>
                  <div className="adm_file_row">
                    <label className="adm_file_label" htmlFor="webFileInput">
                      파일 선택
                      <input
                        id="webFileInput"
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleWebChange}
                      />
                    </label>
                    <span className="adm_file_name">
                      {webFile ? webFile.name : (webCurrentName || '선택된 파일 없음')}
                    </span>
                  </div>
                  {(webPreview || webCurrentUrl) && (
                    <img
                      src={webPreview || webCurrentUrl}
                      alt="web 미리보기"
                      style={{ marginTop: 8, maxHeight: 100, objectFit: 'contain', border: '1px solid #ddd', display: 'block' }}
                    />
                  )}
                </div>
              </div>

              {/* 이미지(mobile) */}
              <div className="adm_form_row">
                <span className="adm_form_label">이미지(mobile)</span>
                <div style={{ flex: 1 }}>
                  <div className="adm_file_row">
                    <label className="adm_file_label" htmlFor="mobileFileInput">
                      파일 선택
                      <input
                        id="mobileFileInput"
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleMobileChange}
                      />
                    </label>
                    <span className="adm_file_name">
                      {mobileFile ? mobileFile.name : (mobileCurrentName || '선택된 파일 없음')}
                    </span>
                  </div>
                  {(mobilePreview || mobileCurrentUrl) && (
                    <img
                      src={mobilePreview || mobileCurrentUrl}
                      alt="mobile 미리보기"
                      style={{ marginTop: 8, maxHeight: 100, objectFit: 'contain', border: '1px solid #ddd', display: 'block' }}
                    />
                  )}
                  <p className="adm_input_hint">미등록 시 PC 이미지로 대체됩니다.</p>
                </div>
              </div>

              {/* 노출여부 */}
              <div className="adm_form_row">
                <span className="adm_form_label">노출여부 <span className="required">*</span></span>
                <div className="adm_radio_group">
                  <label className="adm_radio">
                    <input
                      type="radio"
                      name="display_yn"
                      value="Y"
                      checked={displayYn === 'Y'}
                      onChange={() => setDisplayYn('Y')}
                    />
                    노출
                  </label>
                  <label className="adm_radio">
                    <input
                      type="radio"
                      name="display_yn"
                      value="N"
                      checked={displayYn === 'N'}
                      onChange={() => setDisplayYn('N')}
                    />
                    비노출
                  </label>
                </div>
              </div>

              {/* 노출순위 */}
              <div className="adm_form_row">
                <label className="adm_form_label" htmlFor="sort_order">노출순위</label>
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

              <div className="adm_form_btns">
                <button
                  type="button"
                  className="adm_btn_secondary"
                  onClick={() => navigate('/admin/banner')}
                >취소</button>
                <button type="submit" className="adm_btn_primary" disabled={loading}>
                  {loading ? '저장 중...' : (isEdit ? '수정' : '등록')}
                </button>
              </div>
            </form>
          </section>
        </main>
      </div>
    </div>
  )
}
