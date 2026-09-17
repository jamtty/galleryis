import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  fetchPublicExhibitionList,
  type PublicExhibitionItem,
} from '@/api/exhibitions'
import { fetchPublicNoticeList, type PublicNoticeItem } from '@/api/notices'
import ExhibitionGrid from '../components/ExhibitionGrid'
import HeroSlider from '../components/HeroSlider'
import NoticeList from '../components/NoticeList'
import SectionHead from '../components/SectionHead'
import { PATHS } from '../routes/paths'

/** “전체 보기 →” 링크 라벨 */
function ViewAll() {
  return (
    <>
      전체 보기
      <span aria-hidden="true">→</span>
    </>
  )
}

/** 홈 화면에 보여 줄 전시 건수 */
const HOME_CURRENT_COUNT = 8
const HOME_UPCOMING_COUNT = 4

/** 홈 화면에 보여 줄 소식 건수 */
const HOME_NOTICE_COUNT = 5

export default function HomePage() {
  /** 현재 전시 — null 이면 아직 불러오는 중 */
  const [current, setCurrent] = useState<PublicExhibitionItem[] | null>(null)
  /** 예정 전시 — null 이면 아직 불러오는 중 */
  const [upcoming, setUpcoming] = useState<PublicExhibitionItem[] | null>(null)
  /** 소식 — null 이면 아직 불러오는 중 */
  const [notices, setNotices] = useState<PublicNoticeItem[] | null>(null)

  useEffect(() => {
    let cancelled = false

    fetchPublicExhibitionList({ status: 'current', page: 1, size: HOME_CURRENT_COUNT })
      .then((res) => {
        if (!cancelled) setCurrent(res.items)
      })
      .catch(() => {
        // 전시를 못 불러와도 홈 화면은 그대로 보여 줍니다.
        if (!cancelled) setCurrent([])
      })

    fetchPublicExhibitionList({ status: 'upcoming', page: 1, size: HOME_UPCOMING_COUNT })
      .then((res) => {
        if (!cancelled) setUpcoming(res.items)
      })
      .catch(() => {
        if (!cancelled) setUpcoming([])
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    fetchPublicNoticeList({ page: 1, size: HOME_NOTICE_COUNT })
      .then((res) => {
        if (!cancelled) setNotices(res.items)
      })
      .catch(() => {
        // 소식을 못 불러와도 홈 화면은 그대로 보여 줍니다.
        if (!cancelled) setNotices([])
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      {/* 현재 전시 슬라이더 */}
      <HeroSlider items={current ?? []} />

      {/* 현재 전시 */}
      <section id="exhibitions" className="section section--hero scroll-anchor">
        <SectionHead title="현재 전시">
          <Link to={PATHS.exhibitions} className="section-head__action">
            <ViewAll />
          </Link>
        </SectionHead>
        <ExhibitionGrid
          items={current ?? []}
          emptyText="현재 전시가 없습니다."
        />
      </section>

      {/* 예정 전시 */}
      <section className="section section--plain">
        <SectionHead title="예정 전시">
          <Link
            to={`${PATHS.exhibitions}?status=upcoming`}
            className="section-head__action"
          >
            <ViewAll />
          </Link>
        </SectionHead>
        <ExhibitionGrid
          items={upcoming ?? []}
          emptyText="예정된 전시가 아직 없습니다."
        />
      </section>

      {/* 소식 */}
      <section id="notices" className="section section--notices scroll-anchor">
        <SectionHead title="소식">
          <Link to={PATHS.notices} className="section-head__action">
            <ViewAll />
          </Link>
        </SectionHead>
        <NoticeList items={notices ?? []} plain />

        {notices !== null && notices.length === 0 && (
          <p className="page-note">등록된 소식이 없습니다.</p>
        )}
      </section>
    </>
  )
}
