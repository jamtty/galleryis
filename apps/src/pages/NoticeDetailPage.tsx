import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchPublicNoticeDetail, type PublicNoticeDetail } from '@/api/notices'
import { formatDotDate } from '@/utils/date'
import { renderBodyHtml } from '@/utils/html'
import PageHeader from '../components/PageHeader'
import { PATHS } from '../routes/paths'

/** 첨부 파일 크기 표기 */
function formatBytes(bytes: number) {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`
  if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`

  return `${(bytes / 1048576).toFixed(1)} MB`
}

/**
 * 공개 — 소식 상세.
 *
 * 서버에서 공지 1건을 읽어 옵니다. 열면 조회수가 1 올라갑니다.
 * 옛 글은 태그 없이 평문으로 저장돼 있어 renderBodyHtml 로 줄바꿈을 살립니다.
 */
export default function NoticeDetailPage() {
  const { id } = useParams<{ id: string }>()

  const noticeId = Number(id)
  const valid = Number.isInteger(noticeId) && noticeId > 0

  const [notice, setNotice] = useState<PublicNoticeDetail | null>(null)
  const [loading, setLoading] = useState(valid)
  const [error, setError] = useState<string | null>(
    valid ? null : '소식 번호가 올바르지 않습니다.',
  )

  useEffect(() => {
    if (!valid) return

    let cancelled = false

    fetchPublicNoticeDetail(noticeId)
      .then((res) => {
        if (cancelled) return

        setNotice(res)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return

        setError(
          err instanceof Error ? err.message : '소식을 불러오지 못했습니다.',
        )
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [noticeId, valid])

  if (loading) {
    return (
      <>
        <PageHeader title="소식" />
        <div className="page-body">
          <p className="page-note">불러오는 중입니다...</p>
        </div>
      </>
    )
  }

  if (error || notice === null) {
    return (
      <>
        <PageHeader title="소식" />
        <div className="page-body">
          <p className="page-note">{error ?? '소식을 찾을 수 없습니다.'}</p>

          <div className="notice-detail__actions">
            <Link to={PATHS.notices} className="btn btn--pill btn--outline btn--lg">
              목록으로
            </Link>
          </div>
        </div>
      </>
    )
  }

  const links = [
    { index: 1, url: notice.link1 },
    { index: 2, url: notice.link2 },
  ].filter((item) => item.url !== '')

  return (
    <>
      {/* 서브 페이지 공통 타이틀 — 게시판 제목은 본문 위에 따로 보여 줍니다. */}
      <PageHeader title="소식" />

      <div className="page-body">
        <article className="notice-detail">
          <header className="notice-detail__head">
            <h2 className="notice-detail__title">
              {notice.pinned && (
                <span className="notice-detail__badge">공지</span>
              )}
              {notice.title}
            </h2>

            <p className="notice-detail__meta">
              {[
                formatDotDate(notice.createdAt),
                `조회 ${notice.hit.toLocaleString()}`,
                notice.author,
              ]
                .filter((value) => value !== '')
                .join(' · ')}
            </p>
          </header>

          <div
            className="notice-detail__body rich-text"
            dangerouslySetInnerHTML={{ __html: renderBodyHtml(notice.content) }}
          />

          {links.length > 0 && (
            <ul className="notice-detail__links">
              {links.map((item) => (
                <li key={item.index}>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="notice-detail__link"
                  >
                    {item.url}
                  </a>
                </li>
              ))}
            </ul>
          )}

          {notice.files.length > 0 && (
            <ul className="notice-detail__files">
              {notice.files.map((file) => (
                <li key={file.no} className="notice-detail__file">
                  {/* 링크는 파일명에만 — 줄 전체가 눌리지 않게 합니다. */}
                  {file.url ? (
                    <a
                      href={file.url}
                      download={file.name}
                      className="notice-detail__file_name"
                    >
                      {file.name}
                    </a>
                  ) : (
                    <span className="notice-detail__file_name">
                      {file.name}
                    </span>
                  )}

                  <span className="notice-detail__file_size">
                    {formatBytes(file.size)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>

        <nav className="notice-nav" aria-label="이전 · 다음 소식">
          <ul className="notice-nav__list">
            <li className="notice-nav__row">
              <span className="notice-nav__label">이전글</span>
              {notice.prev ? (
                <Link
                  to={`${PATHS.notices}/${notice.prev.id}`}
                  className="notice-nav__link"
                >
                  {notice.prev.title}
                </Link>
              ) : (
                <span className="notice-nav__empty">이전 글이 없습니다.</span>
              )}
            </li>

            <li className="notice-nav__row">
              <span className="notice-nav__label">다음글</span>
              {notice.next ? (
                <Link
                  to={`${PATHS.notices}/${notice.next.id}`}
                  className="notice-nav__link"
                >
                  {notice.next.title}
                </Link>
              ) : (
                <span className="notice-nav__empty">다음 글이 없습니다.</span>
              )}
            </li>
          </ul>
        </nav>

        <div className="notice-detail__actions">
          <Link to={PATHS.notices} className="btn btn--pill btn--outline btn--lg">
            목록으로
          </Link>
        </div>
      </div>
    </>
  )
}
