import { Link } from 'react-router-dom'
import type { PublicNoticeItem } from '@/api/notices'
import { formatDotDate } from '@/utils/date'
import { PATHS } from '../routes/paths'

type NoticeListProps = {
  items: readonly PublicNoticeItem[]
  /** 앞에서 몇 건만 보여 줄지 (홈 화면 등) */
  limit?: number
  /**
   * 공지 구분(뱃지 + 회색 배경) 없이 평범한 목록으로 보여 줍니다.
   * 홈 화면 소식 섹션에서 씁니다.
   */
  plain?: boolean
}

/** 소식 목록 — 홈 화면과 /notices 에서 함께 씁니다. */
export default function NoticeList({
  items,
  limit,
  plain = false,
}: NoticeListProps) {
  const visible = limit ? items.slice(0, limit) : items

  return (
    <ul className="notice-list">
      {visible.map((notice) => (
        <li
          key={notice.id}
          className={
            !plain && notice.pinned
              ? 'notice-list__item is-notice'
              : 'notice-list__item'
          }
        >
          <Link
            to={`${PATHS.notices}/${notice.id}`}
            className="notice-list__link"
          >
            {!plain && notice.pinned && (
              <span className="notice-list__badge">공지</span>
            )}
            <span className="notice-list__title">{notice.title}</span>
          </Link>

          {/* 날짜는 링크가 아닙니다 — 글씨에만 링크가 걸립니다. */}
          <span className="notice-list__date">
            {formatDotDate(notice.createdAt)}
          </span>
        </li>
      ))}
    </ul>
  )
}
