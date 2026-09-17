import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminHeader from '@/components/admin/AdminHeader'
import AdminSidebar from '@/components/admin/AdminSidebar'
import ToggleSwitch from '@/components/admin/ToggleSwitch'
import { fetchExpertListAdmin, deleteExpert, updateExpertUseYn, type ExpertItem } from '@/api/expert'

const PAGE_SIZE = 15

export default function AdminExpertPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<ExpertItem[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [inputKeyword, setInputKeyword] = useState('')
  const [keyword, setKeyword] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkedIds, setCheckedIds] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<number | null>(null)

  const load = useCallback(async (p: number, kw: string, tp: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchExpertListAdmin({
        page: p,
        size: PAGE_SIZE,
        keyword: kw || undefined,
        type: (tp as 'advisor' | 'coach' | '') || undefined,
      })
      setItems(res.items)
      setTotal(res.total)
      setTotalPages(res.total_pages)
      setCheckedIds([])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(page, keyword, typeFilter) }, [load, page, keyword, typeFilter])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    setKeyword(inputKeyword)
  }

  const handleReset = () => {
    setInputKeyword('')
    setKeyword('')
    setTypeFilter('')
    setPage(1)
  }

  const allChecked = items.length > 0 && items.every((item) => checkedIds.includes(item.expert_id))
  const handleCheckAll = () => setCheckedIds(allChecked ? [] : items.map((i) => i.expert_id))
  const handleCheckOne = (id: number) =>
    setCheckedIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]))

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`"${name}" 전문가를 삭제하시겠습니까?`)) return
    try {
      await deleteExpert(id)
      load(page, keyword, typeFilter)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    }
  }

  const handleBulkDelete = async () => {
    if (checkedIds.length === 0) return
    if (!confirm(`선택한 ${checkedIds.length}건을 삭제하시겠습니까?`)) return
    try {
      await Promise.all(checkedIds.map((id) => deleteExpert(id)))
      load(page, keyword, typeFilter)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    }
  }

  const typeLabel = (type: string) => (type === 'advisor' ? '자문위원/수퍼바이저' : '전문상담사/코치')

  const handleToggleUse = async (item: ExpertItem) => {
    if (togglingId !== null) return
    const next: 'Y' | 'N' = item.use_yn === 'Y' ? 'N' : 'Y'
    setTogglingId(item.expert_id)
    // 화면 즉시 반영 (실패 시 되돌림)
    setItems((prev) => prev.map((i) => (i.expert_id === item.expert_id ? { ...i, use_yn: next } : i)))
    try {
      await updateExpertUseYn(item.expert_id, next)
    } catch (err: unknown) {
      setItems((prev) => prev.map((i) => (i.expert_id === item.expert_id ? { ...i, use_yn: item.use_yn } : i)))
      alert(err instanceof Error ? err.message : '변경에 실패했습니다.')
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="adm_wrap">
      <AdminSidebar />
      <div className="adm_content">
        <AdminHeader pageTitle="전문가 관리" />
        <main className="adm_main">
          <section className="adm_section">
            <div className="adm_toolbar">
              <form className="adm_search_form" onSubmit={handleSearch}>
                <div className="adm_search_row">
                  <label className="adm_search_label">구분</label>
                  <select
                    className="adm_search_select"
                    value={typeFilter}
                    onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
                  >
                    <option value="">전체</option>
                    <option value="advisor">자문위원/수퍼바이저</option>
                    <option value="coach">전문상담사/코치</option>
                  </select>
                  <label className="adm_search_label">검색어</label>
                  <input
                    type="text"
                    className="adm_search_keyword"
                    placeholder="이름, 태그 검색"
                    value={inputKeyword}
                    onChange={(e) => setInputKeyword(e.target.value)}
                  />
                  <button type="submit" className="adm_search_btn">
                    <span className="material-icons">search</span>
                  </button>
                  <button type="button" className="adm_btn_secondary" onClick={handleReset}>초기화</button>
                </div>
              </form>
              <button className="adm_btn_primary" onClick={() => navigate('/admin/expert/write')}>
                + 등록
              </button>
            </div>

            <div className="adm_table_wrap">
              <table className="adm_table">
                <thead>
                  <tr>
                    <th style={{ width: '4%' }}>
                      <input type="checkbox" checked={allChecked} onChange={handleCheckAll} />
                    </th>
                    <th style={{ width: '6%' }}>번호</th>
                    <th style={{ width: '8%' }}>이미지</th>
                    <th style={{ width: '12%' }}>구분</th>
                    <th>이름</th>
                    <th style={{ width: '8%' }}>사용여부</th>
                    <th style={{ width: '8%' }}>정렬순서</th>
                    <th style={{ width: '12%' }}>등록일</th>
                    <th style={{ width: '14%' }}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={9} className="adm_table_empty">불러오는 중...</td></tr>
                  ) : error ? (
                    <tr><td colSpan={9} className="adm_table_empty">오류: {error}</td></tr>
                  ) : items.length === 0 ? (
                    <tr><td colSpan={9} className="adm_table_empty">전문가가 없습니다.</td></tr>
                  ) : items.map((item, idx) => (
                    <tr key={item.expert_id}>
                      <td className="adm_td_center">
                        <input
                          type="checkbox"
                          checked={checkedIds.includes(item.expert_id)}
                          onChange={() => handleCheckOne(item.expert_id)}
                        />
                      </td>
                      <td className="adm_td_center">{total - (page - 1) * PAGE_SIZE - idx}</td>
                      <td className="adm_td_center">
                        {item.expert_img_url ? (
                          <img src={item.expert_img_url} alt={item.expert_name} style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 8, verticalAlign: 'middle' }} />
                        ) : '-'}
                      </td>
                      <td className="adm_td_center">
                        <span className={item.expert_type === 'advisor' ? 'adm_badge_on' : 'adm_badge_off'}>
                          {typeLabel(item.expert_type)}
                        </span>
                      </td>
                      <td>
                        <a
                          href="#"
                          className="adm_table_link"
                          onClick={(e) => { e.preventDefault(); navigate(`/admin/expert/edit/${item.expert_id}`) }}
                        >
                          {item.expert_name}
                        </a>
                      </td>
                      <td className="adm_td_center">
                        <ToggleSwitch
                          checked={item.use_yn === 'Y'}
                          onChange={() => handleToggleUse(item)}
                          disabled={togglingId === item.expert_id}
                          title={item.use_yn === 'Y' ? '사용 → 미사용 전환' : '미사용 → 사용 전환'}
                        />
                      </td>
                      <td className="adm_td_center">{item.sort_order}</td>
                      <td className="adm_td_center">{item.created_at?.substring(0, 10)}</td>
                      <td className="adm_td_center">
                        <div className="adm_action_btns">
                          <button
                            className="adm_btn_edit"
                            onClick={() => navigate(`/admin/expert/edit/${item.expert_id}`)}
                          >수정</button>
                          <button
                            className="adm_btn_delete"
                            onClick={() => handleDelete(item.expert_id, item.expert_name)}
                          >삭제</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 페이징 */}
            <div className="adm_pagination">
              <div className="adm_pagination_left">
                {checkedIds.length > 0 && (
                  <button className="adm_btn_delete" onClick={handleBulkDelete}>
                    선택 삭제 ({checkedIds.length})
                  </button>
                )}
                <span className="adm_total_count">총 {total.toLocaleString()}건</span>
              </div>
              <div className="adm_page_btns">
                <button className="adm_page_btn" disabled={page <= 1} onClick={() => setPage(1)}>{'<<'}</button>
                <button className="adm_page_btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{'<'}</button>
                {(() => {
                  const delta = 4
                  const start = Math.max(1, page - delta)
                  const end = Math.min(totalPages, page + delta)
                  return Array.from({ length: end - start + 1 }, (_, i) => start + i).map((p) => (
                    <button key={p} className={`adm_page_btn${page === p ? ' active' : ''}`} onClick={() => setPage(p)}>{p}</button>
                  ))
                })()}
                <button className="adm_page_btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{'>'}</button>
                <button className="adm_page_btn" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>{'>>'}</button>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
