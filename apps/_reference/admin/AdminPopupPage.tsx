import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminHeader from '@/components/admin/AdminHeader'
import AdminSidebar from '@/components/admin/AdminSidebar'
import ToggleSwitch from '@/components/admin/ToggleSwitch'
import {
  fetchPopupList,
  deletePopup,
  updatePopupUseYn,
  type PopupItem,
} from '@/api/popup'

const PAGE_SIZE = 15

export default function AdminPopupPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<PopupItem[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [inputKeyword, setInputKeyword] = useState('')
  const [keyword, setKeyword] = useState('')
  const [useYnFilter, setUseYnFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkedIds, setCheckedIds] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (p: number, kw: string, uy: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchPopupList({ page: p, size: PAGE_SIZE, keyword: kw || undefined, use_yn: uy || undefined })
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

  useEffect(() => { load(page, keyword, useYnFilter) }, [load, page, keyword, useYnFilter])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    setKeyword(inputKeyword)
  }

  const handleReset = () => {
    setInputKeyword('')
    setKeyword('')
    setUseYnFilter('')
    setPage(1)
  }

  const allChecked = items.length > 0 && items.every((item) => checkedIds.includes(item.id))
  const handleCheckAll = () => setCheckedIds(allChecked ? [] : items.map((i) => i.id))
  const handleCheckOne = (id: number) =>
    setCheckedIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]))

  const handleDelete = async (id: number, title: string) => {
    if (!confirm(`"${title}" 팝업을 삭제하시겠습니까?`)) return
    try {
      await deletePopup(id)
      load(page, keyword, useYnFilter)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    }
  }

  const handleBulkDelete = async () => {
    if (checkedIds.length === 0) return
    if (!confirm(`선택한 ${checkedIds.length}건을 삭제하시겠습니까?`)) return
    try {
      await Promise.all(checkedIds.map((id) => deletePopup(id)))
      load(page, keyword, useYnFilter)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    }
  }

  const handleToggleUse = async (item: PopupItem) => {
    const next = item.use_yn === 'Y' ? 'N' : 'Y'
    try {
      await updatePopupUseYn(item.id, next)
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, use_yn: next } : i)))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '변경에 실패했습니다.')
    }
  }

  return (
    <div className="adm_wrap">
      <AdminSidebar />
      <div className="adm_content">
        <AdminHeader pageTitle="팝업 관리" />
        <main className="adm_main">
          <section className="adm_section">
            <div className="adm_toolbar">
              <form className="adm_search_form" onSubmit={handleSearch}>
                <div className="adm_search_row">
                  <label className="adm_search_label">사용여부</label>
                  <select
                    className="adm_search_select"
                    value={useYnFilter}
                    onChange={(e) => { setUseYnFilter(e.target.value); setPage(1) }}
                  >
                    <option value="">전체</option>
                    <option value="Y">사용</option>
                    <option value="N">미사용</option>
                  </select>
                  <label className="adm_search_label">제목</label>
                  <input
                    type="text"
                    className="adm_search_keyword"
                    placeholder="팝업 제목 검색"
                    value={inputKeyword}
                    onChange={(e) => setInputKeyword(e.target.value)}
                  />
                  <button type="submit" className="adm_search_btn">
                    <span className="material-icons">search</span>
                  </button>
                  <button type="button" className="adm_btn_secondary" onClick={handleReset}>초기화</button>
                </div>
              </form>
              <button className="adm_btn_primary" onClick={() => navigate('/admin/popup/write')}>
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
                    <th>제목</th>
                    <th style={{ width: '14%' }}>게시기간</th>
                    <th style={{ width: '10%' }}>사용여부</th>
                    <th style={{ width: '8%' }}>순서</th>
                    <th style={{ width: '12%' }}>등록일</th>
                    <th style={{ width: '14%' }}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} className="adm_table_empty">불러오는 중...</td></tr>
                  ) : error ? (
                    <tr><td colSpan={8} className="adm_table_empty">오류: {error}</td></tr>
                  ) : items.length === 0 ? (
                    <tr><td colSpan={8} className="adm_table_empty">등록된 팝업이 없습니다.</td></tr>
                  ) : items.map((item, idx) => (
                    <tr key={item.id}>
                      <td className="adm_td_center">
                        <input type="checkbox" checked={checkedIds.includes(item.id)} onChange={() => handleCheckOne(item.id)} />
                      </td>
                      <td className="adm_td_center">{total - (page - 1) * PAGE_SIZE - idx}</td>
                      <td>
                        <a
                          href="#"
                          className="adm_table_link"
                          onClick={(e) => { e.preventDefault(); navigate(`/admin/popup/edit/${item.id}`) }}
                        >
                          {item.title}
                        </a>
                      </td>
                      <td className="adm_td_center">
                        {item.period_start || item.period_end
                          ? `${item.period_start || ''} ~ ${item.period_end || ''}`
                          : '상시'}
                      </td>
                      <td className="adm_td_center">
                        <ToggleSwitch
                          checked={item.use_yn === 'Y'}
                          onChange={() => handleToggleUse(item)}
                          title={item.use_yn === 'Y' ? '사용 → 미사용 전환' : '미사용 → 사용 전환'}
                        />
                      </td>
                      <td className="adm_td_center">{item.sort_order ?? '-'}</td>
                      <td className="adm_td_center">{item.created_at?.split(' ')[0] ?? '-'}</td>
                      <td className="adm_td_center">
                        <div className="adm_action_btns">
                          <button
                            className="adm_btn_edit"
                            onClick={() => navigate(`/admin/popup/edit/${item.id}`)}
                          >수정</button>
                          <button
                            className="adm_btn_delete"
                            onClick={() => handleDelete(item.id, item.title)}
                          >삭제</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="adm_pagination">
              <div className="adm_pagination_left">
                {checkedIds.length > 0 && (
                  <button className="adm_btn_delete" onClick={handleBulkDelete}>
                    선택 삭제 ({checkedIds.length})
                  </button>
                )}
                <span className="adm_total_count">총 {total.toLocaleString()}건</span>
              </div>
              {totalPages > 1 && (
                <div className="adm_page_btns">
                  <button className="adm_page_btn" disabled={page <= 1} onClick={() => setPage(1)}>{'<<'}</button>
                  <button className="adm_page_btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{'<'}</button>
                  {(() => {
                    const delta = 4
                    const start = Math.max(1, page - delta)
                    const end = Math.min(totalPages, page + delta)
                    return Array.from({ length: end - start + 1 }, (_, i) => start + i).map((p) => (
                      <button key={p} className={`adm_page_btn ${p === page ? 'on' : ''}`} onClick={() => setPage(p)}>{p}</button>
                    ))
                  })()}
                  <button className="adm_page_btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{'>'}</button>
                  <button className="adm_page_btn" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>{'>>'}</button>
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
