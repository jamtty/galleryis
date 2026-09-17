import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  fetchPublicExhibitionList,
  type PublicExhibitionItem,
} from '@/api/exhibitions'
import ExhibitionGrid from '../components/ExhibitionGrid'
import PageHeader from '../components/PageHeader'
import { PATHS } from '../routes/paths'

/** 탭 — 분류별 목록 */
const STATUS_TABS = [
  { status: 'current', label: '현재 전시' },
  { status: 'upcoming', label: '예정 전시' },
  { status: 'past', label: '지난 전시' },
] as const

type Status = (typeof STATUS_TABS)[number]['status']

/** 한 화면에 보여 줄 전시 수 */
const PAGE_SIZE = 12

function toStatus(value: string | null): Status {
  const found = STATUS_TABS.find((tab) => tab.status === value)

  return found ? found.status : 'current'
}

type ListState = {
  /** 응답을 받은 조건 (`분류|페이지`) */
  key: string
  items: PublicExhibitionItem[]
  totalPages: number
  message?: string
}

const INITIAL_STATE: ListState = {
  key: '',
  items: [],
  totalPages: 1,
}

/**
 * 공개 — 전시 목록.
 *
 * 분류(현재 · 예정 · 지난)는 주소의 `?status=` 로 고르고, 페이지는 `?page=` 로 넘깁니다.
 * 지난 전시는 종료일이 지나면 서버가 자동으로 붙입니다.
 */
export default function ExhibitionsPage() {
  const [searchParams] = useSearchParams()

  const status = toStatus(searchParams.get('status'))
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1)
  const key = `${status}|${page}`

  const [list, setList] = useState<ListState>(INITIAL_STATE)

  useEffect(() => {
    let cancelled = false

    fetchPublicExhibitionList({ status, page, size: PAGE_SIZE })
      .then((res) => {
        if (cancelled) return

        setList({ key, items: res.items, totalPages: res.totalPages })
      })
      .catch((err: unknown) => {
        if (cancelled) return

        setList({
          key,
          items: [],
          totalPages: 1,
          message:
            err instanceof Error
              ? err.message
              : '전시 목록을 불러오지 못했습니다.',
        })
      })

    return () => {
      cancelled = true
    }
  }, [key, status, page])

  const loading = list.key !== key

  const tabHref = (value: Status) =>
    value === 'current' ? PATHS.exhibitions : `${PATHS.exhibitions}?status=${value}`

  const pageHref = (next: number) => {
    const params = new URLSearchParams()

    if (status !== 'current') params.set('status', status)
    if (next > 1) params.set('page', String(next))

    const query = params.toString()

    return query === '' ? PATHS.exhibitions : `${PATHS.exhibitions}?${query}`
  }

  // 페이지 번호 창 (최대 7개)
  const windowStart = Math.max(1, Math.min(page - 3, list.totalPages - 6))
  const pageNumbers = Array.from(
    { length: Math.min(7, list.totalPages) },
    (_, index) => windowStart + index,
  ).filter((number) => number <= list.totalPages)

  const emptyText = `${STATUS_TABS.find((tab) => tab.status === status)?.label ?? '전시'}가 없습니다.`

  return (
    <>
      <PageHeader title="전시">
        <nav className="tabs" aria-label="전시 구분">
          {STATUS_TABS.map((tab) => {
            const isActive = tab.status === status

            return (
              <Link
                key={tab.status}
                to={tabHref(tab.status)}
                aria-current={isActive ? 'page' : undefined}
                className={isActive ? 'tab is-active' : 'tab'}
              >
                {tab.label}
              </Link>
            )
          })}
        </nav>
      </PageHeader>

      <div className="page-body">
        {loading && <p className="page-note">불러오는 중입니다...</p>}

        {!loading && list.message && <p className="page-note">{list.message}</p>}

        {!loading && !list.message && (
          <ExhibitionGrid items={list.items} emptyText={emptyText} />
        )}

        {!loading && !list.message && list.totalPages > 1 && (
          <nav className="pager" aria-label="페이지 이동">
            {page <= 1 ? (
              <span className="pager__btn is-disabled">이전</span>
            ) : (
              <Link to={pageHref(page - 1)} className="pager__btn">
                이전
              </Link>
            )}

            {pageNumbers.map((number) => (
              <Link
                key={number}
                to={pageHref(number)}
                aria-current={number === page ? 'page' : undefined}
                className={number === page ? 'pager__btn is-active' : 'pager__btn'}
              >
                {number}
              </Link>
            ))}

            {page >= list.totalPages ? (
              <span className="pager__btn is-disabled">다음</span>
            ) : (
              <Link to={pageHref(page + 1)} className="pager__btn">
                다음
              </Link>
            )}
          </nav>
        )}
      </div>
    </>
  )
}
