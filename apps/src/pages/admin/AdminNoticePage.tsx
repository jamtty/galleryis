import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { deleteNotices, fetchNoticeList, type NoticeListItem } from '@/api/notices'
import AdminConfirm from '@/components/admin/AdminConfirm'
import AdminDateRange from '@/components/admin/AdminDateRange'
import AdminPage from '@/components/admin/AdminPage'
import { PATHS } from '@/routes/paths'
import { formatDotDate } from '@/utils/date'
import { listRowNumber } from '@/utils/list'

const COLUMNS = ['번호', '제목', '작성자', '작성일', '조회', '관리'] as const

/** 한 화면에 보여 줄 건수 */
const PAGE_SIZE = 15

/** 삭제 등 처리 결과 안내 */
type Notice = { tone: 'ok' | 'err'; text: string }

type ListState = {
  /** 실제로 응답을 받은 페이지 번호 (0 = 아직 없음) */
  page: number
  items: NoticeListItem[]
  totalCount: number
  totalPages: number
  message?: string
}

const INITIAL_STATE: ListState = {
  page: 0,
  items: [],
  totalCount: 0,
  totalPages: 1,
}

/**
 * 관리자 — 공지 목록.
 *
 * 그누보드4 공지 테이블(g4_write_notice)을 그대로 읽습니다.
 * [공지등록] 을 누르면 등록 페이지(/admin/notices/write)로 이동합니다.
 */
export default function AdminNoticePage() {
  const navigate = useNavigate()

  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [keywordInput, setKeywordInput] = useState('')
  /** 작성일 기간 (YYYY-MM-DD) */
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [list, setList] = useState<ListState>(INITIAL_STATE)
  const [reloadKey, setReloadKey] = useState(0)

  /** 체크박스로 고른 공지 번호 */
  const [checkedIds, setCheckedIds] = useState<number[]>([])
  /** 삭제 확인 중인 공지 번호 — 비어 있으면 확인 중이 아닙니다. */
  const [pending, setPending] = useState<number[]>([])
  const [deleting, setDeleting] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  useEffect(() => {
    let cancelled = false

    fetchNoticeList({
      page,
      size: PAGE_SIZE,
      keyword,
      from: dateFrom,
      to: dateTo,
    })
      .then((res) => {
        if (cancelled) return
        setCheckedIds([])
        setList({
          page: res.page,
          items: res.items,
          totalCount: res.totalCount,
          totalPages: res.totalPages,
        })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setList({
          page,
          items: [],
          totalCount: 0,
          totalPages: 1,
          message:
            err instanceof Error
              ? err.message
              : '공지 목록을 불러오지 못했습니다.',
        })
      })

    return () => {
      cancelled = true
    }
  }, [page, keyword, dateFrom, dateTo, reloadKey])

  const loading = list.page !== page

  const submitSearch = () => {
    setPending([])
    setKeyword(keywordInput.trim())
    setPage(1)
  }

  const resetSearch = () => {
    setKeywordInput('')
    setKeyword('')
    setDateFrom('')
    setDateTo('')
    setPending([])
    setNotice(null)
    setPage(1)
  }

  const allChecked =
    list.items.length > 0 &&
    list.items.every((item) => checkedIds.includes(item.id))

  const toggleAll = () => {
    setPending([])
    setCheckedIds(allChecked ? [] : list.items.map((item) => item.id))
  }

  const toggleOne = (id: number) => {
    setPending([])
    setCheckedIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    )
  }

  /** 페이지를 바꾸면 선택·삭제 확인 상태를 먼저 비웁니다. */
  const goPage = (next: number) => {
    setPending([])
    setPage(next)
  }

  const handleDelete = async (ids: number[]) => {
    if (ids.length === 0) return

    setDeleting(true)

    try {
      const result = await deleteNotices(ids)

      setPending([])
      setCheckedIds([])
      setNotice({
        tone: 'ok',
        text: `${result.deleted}건을 삭제했습니다. (첨부 ${result.files}개)`,
      })
      setReloadKey((value) => value + 1)
    } catch (err: unknown) {
      setNotice({
        tone: 'err',
        text: err instanceof Error ? err.message : '공지를 삭제하지 못했습니다.',
      })
    } finally {
      setDeleting(false)
    }
  }

  // 페이지 번호 창 (최대 7개)
  const windowStart = Math.max(1, Math.min(page - 3, list.totalPages - 6))
  const pageNumbers = Array.from(
    { length: Math.min(7, list.totalPages) },
    (_, index) => windowStart + index,
  ).filter((number) => number <= list.totalPages)

  return (
    <AdminPage title="공지">
      <section className="adm_section">
        <h2 className="adm_section_title">공지 목록</h2>

        <div className="adm_toolbar">
          <div className="adm_search_form">
            <div className="adm_search_row">
              <AdminDateRange
                from={dateFrom}
                to={dateTo}
                label="작성일"
                onChange={({ from, to }) => {
                  setPending([])
                  setDateFrom(from)
                  setDateTo(to)
                  setPage(1)
                }}
              />
            </div>

            <div className="adm_search_row">
              <span className="adm_search_label">검색</span>
              <input
                type="text"
                value={keywordInput}
                placeholder="제목 · 내용"
                aria-label="검색어"
                onChange={(event) => setKeywordInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') submitSearch()
                }}
              />
              <button
                type="button"
                className="adm_btn_secondary"
                onClick={submitSearch}
              >
                검색
              </button>
              <button
                type="button"
                className="adm_btn_secondary"
                onClick={resetSearch}
              >
                초기화
              </button>
            </div>
          </div>

          <button
            type="button"
            className="adm_btn_primary"
            onClick={() => navigate(PATHS.adminNoticeForm)}
          >
            공지등록
          </button>
        </div>

        {notice && (
          <p
            className={
              notice.tone === 'ok'
                ? 'adm_table_notice adm_notice_ok'
                : 'adm_table_notice adm_notice_err'
            }
          >
            {notice.text}
          </p>
        )}

        {list.message && <p className="adm_table_notice">{list.message}</p>}

        {loading && <p className="adm_table_notice">불러오는 중입니다...</p>}

        <div className="adm_table_wrap">
          <table className="adm_table">
            <thead>
              <tr>
                <th style={{ width: '4%' }}>
                  <input
                    type="checkbox"
                    aria-label="전체 선택"
                    checked={allChecked}
                    onChange={toggleAll}
                  />
                </th>
                {COLUMNS.map((column) => (
                  <th key={column} scope="col">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && list.items.length === 0 && (
                <tr>
                  <td className="adm_table_empty" colSpan={COLUMNS.length + 1}>
                    {list.message
                      ? '목록을 불러오지 못했습니다.'
                      : '등록된 공지가 없습니다.'}
                  </td>
                </tr>
              )}

              {!loading &&
                list.items.map((item, index) => (
                  <tr key={item.id} className={item.pinned ? 'is_notice' : undefined}>
                    <td className="adm_td_center">
                      <input
                        type="checkbox"
                        aria-label={`${item.id}번 선택`}
                        checked={checkedIds.includes(item.id)}
                        onChange={() => toggleOne(item.id)}
                      />
                    </td>
                    <td className="adm_td_center">
                      {item.pinned ? (
                        <span className="adm_notice_tag">공지</span>
                      ) : (
                        listRowNumber(list.totalCount, list.page, PAGE_SIZE, index)
                      )}
                    </td>
                    <td className="adm_td_left">{item.title}</td>
                    <td className="adm_td_center">{item.author || '-'}</td>
                    <td className="adm_td_center">
                      {formatDotDate(item.createdAt)}
                    </td>
                    <td className="adm_td_center">{item.hit.toLocaleString()}</td>
                    <td className="adm_td_center">
                      <div className="adm_action_btns">
                        <button
                          type="button"
                          className="adm_btn_edit"
                          onClick={() =>
                            navigate(
                              PATHS.adminNoticeEdit.replace(
                                ':id',
                                String(item.id),
                              ),
                            )
                          }
                        >
                          상세
                        </button>

                        <button
                          type="button"
                          className="adm_btn_delete"
                          onClick={() => {
                            setNotice(null)
                            setPending([item.id])
                          }}
                        >
                          삭제
                        </button>
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
              <button
                type="button"
                className="adm_btn_delete"
                onClick={() => {
                  setNotice(null)
                  setPending(checkedIds)
                }}
              >
                선택 삭제 ({checkedIds.length})
              </button>
            )}

            <span className="adm_total_count">
              총 {list.totalCount.toLocaleString()}건
            </span>
          </div>

          {list.totalPages > 1 && (
            <div className="adm_page_btns">
              <button
                type="button"
                className="adm_page_btn"
                disabled={page <= 1}
                aria-label="이전 페이지"
                onClick={() => goPage(Math.max(1, page - 1))}
              >
                ‹
              </button>

              {pageNumbers.map((number) => (
                <button
                  key={number}
                  type="button"
                  className={
                    number === page ? 'adm_page_btn active' : 'adm_page_btn'
                  }
                  onClick={() => goPage(number)}
                >
                  {number}
                </button>
              ))}

              <button
                type="button"
                className="adm_page_btn"
                disabled={page >= list.totalPages}
                aria-label="다음 페이지"
                onClick={() => goPage(Math.min(list.totalPages, page + 1))}
              >
                ›
              </button>
            </div>
          )}

          <div className="adm_pagination_right" />
        </div>
      </section>

      {/* 삭제 확인 — 되돌릴 수 없으므로 항상 이 알럿을 거칩니다. */}
      <AdminConfirm
        open={pending.length > 0}
        title="공지를 삭제할까요?"
        message={
          <>
            {pending.length}건을 삭제합니다. 첨부파일도 함께 지워지며{' '}
            <strong>되돌릴 수 없습니다.</strong>
          </>
        }
        busy={deleting}
        onConfirm={() => handleDelete(pending)}
        onCancel={() => setPending([])}
      />
    </AdminPage>
  )
}
