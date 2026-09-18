import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { RENTAL_HALLS } from '@/api/rentals'
import PageHeader from '@/components/PageHeader'
import RentalForm from '@/components/rental/RentalForm'
import { PATHS } from '@/routes/paths'
import { toIsoDate } from '@/utils/date'

const YMD = /^\d{4}-\d{2}-\d{2}$/

/** 수요일 시작일 기준 종료일(다음 주 화요일) */
function weekEndOf(weekStart: string) {
  const date = new Date(`${weekStart}T00:00:00`)

  date.setDate(date.getDate() + 6)

  return toIsoDate(date)
}

/**
 * 대관 신청서 작성 페이지.
 *
 * /rental 표에서 [대관신청] 을 누르면
 *   /rental/apply?hall=hall2&week=2026-09-30
 * 으로 넘어옵니다.
 */
export default function RentalApplyPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const [done, setDone] = useState<string | null>(null)

  const hall = RENTAL_HALLS.find((item) => item.id === params.get('hall'))
  const weekStart = params.get('week') ?? ''

  const backButton = (
    <div className="rental-actions">
      <Link to={PATHS.rental} className="btn btn--pill btn--dark btn--lg">
        대관 페이지로
      </Link>
    </div>
  )

  // 잘못된 접근 — 전시장/기간이 없거나 형식이 어긋난 경우
  if (!hall || !YMD.test(weekStart)) {
    return (
      <>
        <PageHeader title="대관 신청" />

        <section className="section">
          <p className="rental-error">
            신청할 전시장과 전시기간이 선택되지 않았습니다.
          </p>
          {backButton}
        </section>
      </>
    )
  }

  const weekEnd = weekEndOf(weekStart)

  // 접수 완료
  if (done) {
    return (
      <>
        <PageHeader title="대관 신청" />

        <section className="section">
          <div role="status">
            <p className="rental-received">
              {done} 신청이 접수되었습니다.<br />접수일로부터 3일 이내에 심의 결과를
              개별 통보해 드립니다.
            </p>
          </div>

          {backButton}
        </section>
      </>
    )
  }

  return (
    <>
      <PageHeader title="대관 신청" />

      <section className="section">
        <h2 className="visually-hidden">대관 신청서</h2>

        <RentalForm
          hallId={hall.id}
          weekStart={weekStart}
          weekEnd={weekEnd}
          onCancel={() => navigate(PATHS.rental)}
          onDone={(label) => {
            setDone(label)
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
        />
      </section>
    </>
  )
}
