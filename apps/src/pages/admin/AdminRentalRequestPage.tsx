import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  RENTAL_HALLS,
  deleteRental,
  fetchRentalList,
  type RentalListItem,
} from '@/api/rentals'
import AdminConfirm from '@/components/admin/AdminConfirm'
import AdminDateRange from '@/components/admin/AdminDateRange'
import AdminPage from '@/components/admin/AdminPage'
import { PATHS } from '@/routes/paths'
import { formatDotDate, formatDotRange } from '@/utils/date'
import { listRowNumber } from '@/utils/list'

const COLUMNS = [
  '번호',
  '신청자',
  '연락처',
  '신청 기간',
  '전시장',
  '상태',
  '신청일',
  '관리',
  '확인',
] as const

/** 한 화면에 보여 줄 건수 */
const PAGE_SIZE = 25

/**
 * 레거시 일정·점유 행은 목록에서 숨깁니다.
 * 대관 현황·중복 차단은 그 행들을 그대로 사용합니다.
 */
const LIST_SCOPE = 'applicant'

const STATUS_OPTIONS = [
  { value: '', label: '전체 상태' },
  { value: '1', label: '심사중' },
  { value: '2', label: '대관완료' },
] as const

type ListState = {
  /** 실제로 응답을 받은 페이지 번호 (0 = 아직 없음) */
  page: number
  items: RentalListItem[]
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

type Notice = { tone: 'ok' | 'err'; text: string }

export default function AdminRentalRequestPage() {
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [hall, setHall] = useState('')
  const [keywordInput, setKeywordInput] = useState('')
  /** 신청일 기간 (YYYY-MM-DD) */
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [list, setList] = useState<ListState>(INITIAL_STATE)
  const [reloadKey, setReloadKey] = useState(0)

  /** 체크박스로 고른 신청 번호 */
  const [checkedIds, setCheckedIds] = useState<number[]>([])
  /** 삭제 확인 중인 신청 번호 — 비어 있으면 확인 중이 아닙니다. */
  const [pending, setPending] = useState<number[]>([])
  const [deleting, setDeleting] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false

    fetchRentalList({
      page,
      size: PAGE_SIZE,
      keyword,
      status,
      hall,
      scope: LIST_SCOPE,
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
              : '대관 신청 목록을 불러오지 못했습니다.',
        })
      })

    return () => {
      cancelled = true
    }
  }, [page, keyword, status, hall, dateFrom, dateTo, reloadKey])

  const loading = list.page !== page

  /** 페이지를 바꾸면 선택·삭제 확인 상태를 먼저 초기화합니다. */
  const goPage = (next: number) => {
    setPending([])
    setPage(next)
  }

  const submitSearch = () => {
    setPending([])
    setKeyword(keywordInput.trim())
    setPage(1)
  }

  /** 검색 조건을 기본값(전체 전시장 · 전체 상태)으로 되돌립니다. */
  const resetSearch = () => {
    setKeywordInput('')
    setKeyword('')
    setStatus('')
    setHall('')
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

  const handleDelete = async (ids: number[]) => {
    if (ids.length === 0) return

    setDeleting(true)

    try {
      const result = await deleteRental(ids)

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
        text:
          err instanceof Error ? err.message : '신청을 삭제하지 못했습니다.',
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
    <AdminPage title="대관 신청">
      <section className="adm_section">
        <h2 className="adm_section_title">대관 신청 목록</h2>

        <div className="adm_toolbar">
          <div className="adm_search_form">
            <div className="adm_search_row">
              <AdminDateRange
                from={dateFrom}
                to={dateTo}
                label="신청일"
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
                placeholder="신청자 · 이메일"
                aria-label="검색어"
                onChange={(event) => setKeywordInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') submitSearch()
                }}
              />
              <select
                className="adm_search_select"
                aria-label="전시장"
                value={hall}
                onChange={(event) => {
                  setPending([])
                  setHall(event.target.value)
                  setPage(1)
                }}
              >
                <option value="">전체 전시장</option>
                {RENTAL_HALLS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
              <select
                className="adm_search_select"
                aria-label="상태"
                value={status}
                onChange={(event) => {
                  setPending([])
                  setStatus(event.target.value)
                  setPage(1)
                }}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
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
        </div>

        {list.message && <p className="adm_table_notice">{list.message}</p>}

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
                      : '접수된 대관 신청이 없습니다.'}
                  </td>
                </tr>
              )}

              {!loading &&
                list.items.map((item, index) => (
                  <tr key={item.id}>
                    <td className="adm_td_center">
                      <input
                        type="checkbox"
                        aria-label={`${item.id}번 선택`}
                        checked={checkedIds.includes(item.id)}
                        onChange={() => toggleOne(item.id)}
                      />
                    </td>
                    <td className="adm_td_center">
                      {listRowNumber(list.totalCount, list.page, PAGE_SIZE, index)}
                    </td>
                    <td>{item.applicant}</td>
                    <td>{item.phone || '-'}</td>
                    <td>{formatDotRange(item.periodStart, item.periodEnd)}</td>
                    <td>{item.hall || '-'}</td>
                    <td>
                      <span
                        className={
                          item.status === 'approved'
                            ? 'adm_badge_on'
                            : 'adm_badge_off'
                        }
                      >
                        {item.status === 'approved' ? '대관완료' : '심사중'}
                      </span>
                    </td>
                    <td>{formatDotDate(item.createdAt)}</td>
                    <td className="adm_td_center">
                      <div className="adm_action_btns">
                        <button
                          type="button"
                          className="adm_btn_edit"
                          onClick={() =>
                            navigate(
                              PATHS.adminRentalEdit.replace(
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
                    <td className="adm_td_center">
                      {/* 상세를 열면 자동으로 확인 처리되므로 상태만 글로 보여 줍니다. */}
                      <span
                        className={item.checked ? 'adm_txt_off' : 'adm_txt_new'}
                        title={item.checkedAt ? `확인함 (${item.checkedAt})` : ''}
                      >
                        {item.checked ? '확인' : '확인전'}
                      </span>
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

      {/* 삭제 확인 — 관리자 페이지에서 삭제는 항상 이 알럿을 거칩니다. */}
      <AdminConfirm
        open={pending.length > 0}
        title="신청을 삭제할까요?"
        message={
          <>
            {pending.length}건을 삭제합니다. 첨부파일도 함께 지워지며{' '}
            <strong>되돌릴 수 없습니다.</strong>
          </>
        }
        busy={deleting}
        onConfirm={() => void handleDelete(pending)}
        onCancel={() => setPending([])}
      />
    </AdminPage>
  )
}
