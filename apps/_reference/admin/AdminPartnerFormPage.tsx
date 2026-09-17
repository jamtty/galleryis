import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AdminHeader from '@/components/admin/AdminHeader'
import AdminSidebar from '@/components/admin/AdminSidebar'
import {
  createPartner,
  updatePartner,
  fetchPartnerDetail,
  type PartnerItem,
} from '@/api/partner'

const SORT_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1)

export default function AdminPartnerFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)

  const [companyName, setCompanyName] = useState('')
  const [displayYn, setDisplayYn] = useState<'Y' | 'N'>('Y')
  const [sortOrder, setSortOrder] = useState('')

  const [imgFile, setImgFile] = useState<File | null>(null)
  const [imgPreview, setImgPreview] = useState('')
  const [imgCurrentUrl, setImgCurrentUrl] = useState('')

  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(isEdit)

  useEffect(() => {
    if (!isEdit) return
    fetchPartnerDetail(Number(id))
      .then((item: PartnerItem) => {
        setCompanyName(item.company_name)
        setDisplayYn(item.display_yn === 'Y' ? 'Y' : 'N')
        setSortOrder(item.sort_order != null ? String(item.sort_order) : '')
        setImgCurrentUrl(item.img_url_full || '')
      })
      .catch(() => {
        alert('파트너 정보를 불러오지 못했습니다.')
        navigate('/admin/partner')
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
    if (!isEdit && !imgFile) { alert('로고 이미지를 선택해주세요.'); return }

    const fd = new FormData()
    fd.append('company_name', companyName.trim())
    fd.append('display_yn', displayYn)
    fd.append('sort_order', sortOrder)
    if (imgFile) fd.append('img_file', imgFile)

    setLoading(true)
    try {
      if (isEdit) {
        await updatePartner(Number(id), fd)
        alert('수정되었습니다.')
      } else {
        await createPartner(fd)
        alert('등록되었습니다.')
      }
      navigate('/admin/partner')
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
        <AdminHeader pageTitle={isEdit ? '협력기관 수정' : '협력기관 등록'} />
        <main className="adm_main"><div className="adm_loading">불러오는 중...</div></main>
      </div>
    </div>
  )

  return (
    <div className="adm_wrap">
      <AdminSidebar />
      <div className="adm_content">
        <AdminHeader pageTitle={isEdit ? '협력기관 수정' : '협력기관 등록'} />
        <main className="adm_main">
          <section className="adm_section">
            <form className="adm_form" onSubmit={handleSubmit}>
              <div className="adm_form_row">
                <label className="adm_form_label" htmlFor="partner_name">업체명</label>
                <input
                  id="partner_name"
                  type="text"
                  className="adm_form_input"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="예: 파트너사 A"
                />
              </div>

              <div className="adm_form_row">
                <label className="adm_form_label">노출 여부</label>
                <select
                  className="adm_search_select"
                  value={displayYn}
                  onChange={(e) => setDisplayYn(e.target.value as 'Y' | 'N')}
                >
                  <option value="Y">노출</option>
                  <option value="N">미노출</option>
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
                <label className="adm_form_label">로고 이미지</label>
                <div className="adm_form_file_wrap">
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png"
                    onChange={handleImgChange}
                    className="adm_form_file"
                  />
                  {(imgPreview || imgCurrentUrl) && (
                    <div className="adm_form_img_preview">
                      <img
                        src={imgPreview || imgCurrentUrl}
                        alt="로고 미리보기"
                        style={{ maxHeight: '8rem', maxWidth: '20rem', objectFit: 'contain', background: '#f5f5f5', padding: '0.5rem', borderRadius: '0.4rem' }}
                      />
                    </div>
                  )}
                  <span className="adm_form_hint">권장: 가로 288px, 세로 88px 이내의 JPG/PNG 이미지</span>
                </div>
              </div>

              <div className="adm_form_actions">
                <button
                  type="button"
                  className="adm_btn_secondary"
                  onClick={() => navigate('/admin/partner')}
                >취소</button>
                <button
                  type="submit"
                  className="adm_btn_primary"
                  disabled={loading}
                >{loading ? '저장 중...' : isEdit ? '수정' : '등록'}</button>
              </div>
            </form>
          </section>
        </main>
      </div>
    </div>
  )
}
