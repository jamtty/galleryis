import { useEffect, useState } from 'react'
import { fetchPublicNoticeList, type PublicNoticeItem } from '@/api/notices'
import { useSiteSettings } from '@/store/useSiteSettings'
import NoticeList from '../components/NoticeList'
import PageHeader from '../components/PageHeader'

/** 한 화면에 보여 줄 건수 */
const PAGE_SIZE = 10

type ListState = {
  /** 실제로 응답을 받은 페이지 번호 (0 = 아직 없음) */
  page: number
  items: PublicNoticeItem[]
  totalPages: number
  message?: string
}

const INITIAL_STATE: ListState = {
  page: 0,
  items: [],
  totalPages: 1,
}

/**
 * 공개 — 소식 목록.
 *
 * 서버의 공지 게시판(g4_write_notice)을 그대로 읽습니다.
 * 상단 고정 공지가 맨 위에 오고, 나머지는 최신순입니다.
 */
export default function NoticesPage() {
  const [page, setPage] = useState(1)
  const [list, setList] = useState<ListState>(INITIAL_STATE)
  /** 제목 아래 문구 — 관리자 [환경설정] 에서 고칩니다. */
  const { pageNoticesLede } = useSiteSettings()

  useEffect(() => {
    let cancelled = false

    fetchPublicNoticeList({ page, size: PAGE_SIZE })
      .then((res) => {
        if (cancelled) return

        setList({
          page: res.page,
          items: res.items,
          totalPages: res.totalPages,
        })
      })
      .catch((err: unknown) => {
        if (cancelled) return

        setList({
          page,
          items: [],
          totalPages: 1,
          message:
            err instanceof Error
              ? err.message
              : '소식 목록을 불러오지 못했습니다.',
        })
      })

    return () => {
      cancelled = true
    }
  }, [page])

  const loading = list.page !== page

  // 페이지 번호 창 (최대 7개)
  const windowStart = Math.max(1, Math.min(page - 3, list.totalPages - 6))
  const pageNumbers = Array.from(
    { length: Math.min(7, list.totalPages) },
    (_, index) => windowStart + index,
  ).filter((number) => number <= list.totalPages)

  return (
    <>
      <PageHeader title="소식" lede={pageNoticesLede} />

      <div className="page-body">
        {loading && <p className="page-note">불러오는 중입니다...</p>}

        {!loading && list.message && (
          <p className="page-note">{list.message}</p>
        )}

        {!loading && !list.message && list.items.length === 0 && (
          <p className="page-note">등록된 소식이 없습니다.</p>
        )}

        {!loading && !list.message && list.items.length > 0 && (
          <NoticeList items={list.items} />
        )}

        {!loading && list.totalPages > 1 && (
          <nav className="pager" aria-label="페이지 이동">
            <button
              type="button"
              className="pager__btn"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              이전
            </button>

            {pageNumbers.map((number) => (
              <button
                key={number}
                type="button"
                className={number === page ? 'pager__btn is-active' : 'pager__btn'}
                aria-current={number === page ? 'page' : undefined}
                onClick={() => setPage(number)}
              >
                {number}
              </button>
            ))}

            <button
              type="button"
              className="pager__btn"
              disabled={page >= list.totalPages}
              onClick={() => setPage(page + 1)}
            >
              다음
            </button>
          </nav>
        )}
      </div>
    </>
  )
}
