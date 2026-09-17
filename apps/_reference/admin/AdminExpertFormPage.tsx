import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AdminHeader from '@/components/admin/AdminHeader'
import AdminSidebar from '@/components/admin/AdminSidebar'
import { createExpert, updateExpert, fetchExpertDetail, type ExpertItem } from '@/api/expert'

const SORT_OPTIONS = Array.from({ length: 20 }, (_, i) => i + 1)

export default function AdminExpertFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)

  const [expertType, setExpertType] = useState<'advisor' | 'coach'>('advisor')
  const [expertName, setExpertName] = useState('')
  const [expertTags, setExpertTags] = useState('')
  const [expertDesc, setExpertDesc] = useState('')
  const [expertCareer, setExpertCareer] = useState('')
  const [sortOrder, setSortOrder] = useState('1')
  const [useYn, setUseYn] = useState<'Y' | 'N'>('Y')

  const [imgFile, setImgFile] = useState<File | null>(null)
  const [imgPreview, setImgPreview] = useState('')
  const [imgCurrentUrl, setImgCurrentUrl] = useState('')
  const [imgCurrentName, setImgCurrentName] = useState('')
  const [removeImg, setRemoveImg] = useState(false)

  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(isEdit)

  useEffect(() => {
    if (!isEdit) return
    fetchExpertDetail(Number(id))
      .then((item: ExpertItem) => {
        setExpertType(item.expert_type)
        setExpertName(item.expert_name)
        setExpertTags(item.expert_tags)
        setExpertDesc(item.expert_desc)
        setExpertCareer(item.expert_career.join('\n'))
        setSortOrder(String(item.sort_order))
        setUseYn(item.use_yn)
        setImgCurrentUrl(item.expert_img_url || '')
        setImgCurrentName(item.expert_img_org || item.expert_img || '')
      })
      .catch(() => {
        alert('전문가 정보를 불러오지 못했습니다.')
        navigate('/admin/expert')
      })
      .finally(() => setFetching(false))
  }, [id, isEdit, navigate])

  const handleImgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImgFile(file)
    setImgPreview(URL.createObjectURL(file))
    setRemoveImg(false)
    e.target.value = ''
  }

  const handleRemoveImg = () => {
    setImgFile(null)
    setImgPreview('')
    setImgCurrentUrl('')
    setImgCurrentName('')
    setRemoveImg(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!expertName.trim()) { alert('이름을 입력해주세요.'); return }

    const fd = new FormData()
    fd.append('expert_type', expertType)
    fd.append('expert_name', expertName.trim())
    fd.append('expert_tags', expertTags.trim())
    fd.append('expert_desc', expertDesc.trim())
    fd.append('expert_career', expertCareer.trim())
    fd.append('sort_order', sortOrder)
    fd.append('use_yn', useYn)
    if (imgFile) fd.append('expert_img', imgFile)
    if (removeImg) fd.append('remove_img', '1')

    setLoading(true)
    try {
      if (isEdit) {
        await updateExpert(Number(id), fd)
        alert('수정되었습니다.')
      } else {
        await createExpert(fd)
        alert('등록되었습니다.')
      }
      navigate('/admin/expert')
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
        <AdminHeader pageTitle={isEdit ? '전문가 수정' : '전문가 등록'} />
        <main className="adm_main"><div className="adm_loading">불러오는 중...</div></main>
      </div>
    </div>
  )

  return (
    <div className="adm_wrap">
      <AdminSidebar />
      <div className="adm_content">
        <AdminHeader pageTitle={isEdit ? '전문가 수정' : '전문가 등록'} />
        <main className="adm_main">
          <section className="adm_section">
            <form className="adm_form" onSubmit={handleSubmit}>
              {/* 구분 */}
              <div className="adm_form_row">
                <span className="adm_form_label">구분 <span className="required">*</span></span>
                <div className="adm_radio_group">
                  <label className="adm_radio">
                    <input type="radio" name="expert_type" value="advisor" checked={expertType === 'advisor'} onChange={() => setExpertType('advisor')} />
                    자문위원 / 수퍼바이저
                  </label>
                  <label className="adm_radio">
                    <input type="radio" name="expert_type" value="coach" checked={expertType === 'coach'} onChange={() => setExpertType('coach')} />
                    전문상담사 / 전문 코치
                  </label>
                </div>
              </div>

              {/* 이름 */}
              <div className="adm_form_row">
                <label className="adm_form_label" htmlFor="expert_name">
                  이름 <span className="required">*</span>
                </label>
                <input
                  id="expert_name"
                  type="text"
                  className="adm_form_input"
                  value={expertName}
                  onChange={(e) => setExpertName(e.target.value)}
                  placeholder="예: 김현정 상담사 (임상심리전문가)"
                />
              </div>

              {/* 태그 */}
              <div className="adm_form_row">
                <label className="adm_form_label" htmlFor="expert_tags">태그</label>
                <div style={{ flex: 1, width: '100%' }}>
                  <input
                    id="expert_tags"
                    type="text"
                    className="adm_form_input"
                    value={expertTags}
                    onChange={(e) => setExpertTags(e.target.value)}
                    placeholder="예: #불안 #성인ADHD #트라우마"
                    style={{ width: '100%' }}
                  />
                  <p className="adm_input_hint">#태그 형태로 입력 (공백 구분)</p>
                </div>
              </div>

              {/* 한줄 소개 */}
              <div className="adm_form_row">
                <label className="adm_form_label" htmlFor="expert_desc">한줄 소개</label>
                <input
                  id="expert_desc"
                  type="text"
                  className="adm_form_input"
                  value={expertDesc}
                  onChange={(e) => setExpertDesc(e.target.value)}
                  placeholder="예: 복잡한 감정을 이해하고 정리하도록 돕는 상담"
                />
              </div>

              {/* 경력/약력 */}
              <div className="adm_form_row">
                <label className="adm_form_label" htmlFor="expert_career">경력/약력</label>
                <div style={{ flex: 1 }}>
                  <textarea
                    id="expert_career"
                    className="adm_form_textarea"
                    rows={6}
                    value={expertCareer}
                    onChange={(e) => setExpertCareer(e.target.value)}
                    placeholder="한 줄에 하나씩 입력&#10;예:&#10;○○대 상담심리 석사&#10;보건복지부 임상심리사&#10;위드원 공감 지도사Level 1"
                  />
                  <p className="adm_input_hint">한 줄에 하나씩 입력 (줄바꿈으로 구분)</p>
                </div>
              </div>

              {/* 프로필 이미지 */}
              <div className="adm_form_row">
                <span className="adm_form_label">프로필 이미지</span>
                <div style={{ flex: 1 }}>
                  <div className="adm_file_row">
                    <label className="adm_file_label" htmlFor="imgFileInput">
                      파일 선택
                      <input
                        id="imgFileInput"
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleImgChange}
                      />
                    </label>
                    <span className="adm_file_name">
                      {imgFile ? imgFile.name : (removeImg ? '삭제됨' : (imgCurrentName || '선택된 파일 없음'))}
                    </span>
                  </div>
                  {(imgPreview || (imgCurrentUrl && !removeImg)) && (
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <img
                        src={imgPreview || imgCurrentUrl}
                        alt="미리보기"
                        style={{ maxHeight: 120, objectFit: 'contain', border: '1px solid #ddd', borderRadius: 8 }}
                      />
                      {isEdit && imgCurrentUrl && !removeImg && (
                        <button type="button" className="adm_btn_delete" onClick={handleRemoveImg}>
                          삭제
                        </button>
                      )}
                    </div>
                  )}
                  <p className="adm_input_hint">권장 이미지: 340 x 370</p>
                </div>
              </div>

              {/* 정렬순서 */}
              <div className="adm_form_row">
                <label className="adm_form_label" htmlFor="sort_order">정렬순서</label>
                <select
                  id="sort_order"
                  className="adm_search_select"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                >
                  {SORT_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>

              {/* 사용여부 */}
              <div className="adm_form_row">
                <span className="adm_form_label">사용여부 <span className="required">*</span></span>
                <div className="adm_radio_group">
                  <label className="adm_radio">
                    <input type="radio" name="use_yn" value="Y" checked={useYn === 'Y'} onChange={() => setUseYn('Y')} />
                    사용
                  </label>
                  <label className="adm_radio">
                    <input type="radio" name="use_yn" value="N" checked={useYn === 'N'} onChange={() => setUseYn('N')} />
                    미사용
                  </label>
                </div>
              </div>

              {/* 버튼 */}
              <div className="adm_form_actions">
                <button type="button" className="adm_btn_secondary" onClick={() => navigate('/admin/expert')}>
                  취소
                </button>
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
