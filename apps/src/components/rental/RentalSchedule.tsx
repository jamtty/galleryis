import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  RENTAL_HALLS,
  RENTAL_STATUS_LABELS,
  RENTAL_UNITS,
  fetchAvailabilityRange,
  type RentalStatus,
  type RentalUnit,
  type RentalWeek,
} from '@/api/rentals'
import { PATHS } from '@/routes/paths'
import { formatDotDate, formatDotRange } from '@/utils/date'

/**
 * 대관신청 구분 순서 — 이미지와 동일하게
 * 대관완료(승인) → 심사중(대기) → 신청가능 순으로 둡니다.
 */
const FILTER_ORDER: RentalStatus[] = ['approved', 'pending', 'available']

type LoadState = {
  /** 실제로 응답을 받은 기간 단위 (null = 아직 없음) */
  unit: RentalUnit | null
  status: 'ok' | 'error'
  weeks: RentalWeek[]
  last: boolean
  edge: string
  message?: string
}

const INITIAL_STATE: LoadState = {
  unit: null,
  status: 'ok',
  weeks: [],
  last: false,
  edge: '',
}

function weekLabel(week: RentalWeek) {
  return formatDotRange(week.start, week.end)
}

type RentalScheduleProps = {
  /** 대관신청을 새 창으로 엽니다 (관리자 화면용) */
  newWindow?: boolean
  /** 처음 보여 줄 검색 기간 (기본 6개월) */
  defaultUnit?: RentalUnit
}

/** 전시 기간 확인 및 신청 — 기간 검색 + 대관신청 구분 + 전시장별 주간 표 */
export default function RentalSchedule({
  newWindow = false,
  defaultUnit = '6m',
}: RentalScheduleProps) {
  const navigate = useNavigate()

  const [unit, setUnit] = useState<RentalUnit>(defaultUnit)
  const [state, setState] = useState<LoadState>(INITIAL_STATE)
  const [visible, setVisible] = useState<Record<RentalStatus, boolean>>({
    approved: true,
    pending: true,
    available: true,
  })

  useEffect(() => {
    let cancelled = false

    fetchAvailabilityRange(unit)
      .then((res) => {
        if (cancelled) return
        setState({
          unit,
          status: 'ok',
          weeks: res.weeks,
          last: res.last,
          edge: res.edge,
        })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setState({
          unit,
          status: 'error',
          weeks: [],
          last: true,
          edge: '',
          message:
            err instanceof Error
              ? err.message
              : '대관 일정을 불러오지 못했습니다.',
        })
      })

    return () => {
      cancelled = true
    }
  }, [unit])

  // 응답을 받은 단위와 현재 단위가 다르면 로딩으로 봅니다.
  const loading = state.unit !== unit
  const weeks = loading ? [] : state.weeks

  const toggle = (status: RentalStatus) => {
    setVisible((current) => ({ ...current, [status]: !current[status] }))
  }

  const apply = (hallId: string, week: RentalWeek) => {
    const query = new URLSearchParams({ hall: hallId, week: week.start })
    const to = `${PATHS.rentalApply}?${query.toString()}`

    // 관리자 화면에서는 일정 표를 띄워 둔 채 신청서를 새 창으로 엽니다.
    if (newWindow) {
      window.open(to, '_blank', 'noopener,noreferrer')
      return
    }

    navigate(to)
  }

  return (
    <>
      {/* 전시기간 검색 */}
      <div className="rental-filter">
        <div className="rental-filter__row">
          <span className="rental-filter__label">전시기간 검색</span>
          <div className="rental-chips">
            {RENTAL_UNITS.map((item) => (
              <button
                key={item.value}
                type="button"
                className={[
                  'rental-chip',
                  'rental-chip--period',
                  item.value === unit ? 'is-on' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-pressed={item.value === unit}
                onClick={() => setUnit(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="rental-filter__note">
            ※ 전시기간이 신청 검색은 최대 2년 입니다.
          </p>

          {/* 지금 표에 나오는 기간 */}
          {weeks.length > 0 && (
            <p className="rental-filter__range">
              <span className="rental-filter__date">
                {formatDotDate(weeks[0].start)}
              </span>
              <span className="rental-filter__tilde" aria-hidden="true">
                ~
              </span>
              <span className="rental-filter__date">
                {formatDotDate(weeks[weeks.length - 1].end)}
              </span>
            </p>
          )}
        </div>

        {/* 대관신청 구분 */}
        <div className="rental-filter__row">
          <span className="rental-filter__label">대관신청 구분</span>
          <div className="rental-chips">
            {FILTER_ORDER.map((status) => (
              <button
                key={status}
                type="button"
                className={[
                  'rental-chip',
                  `rental-chip--${status}`,
                  visible[status] ? 'is-on' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-pressed={visible[status]}
                onClick={() => toggle(status)}
              >
                {RENTAL_STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && <p className="rental-hint">일정을 불러오는 중입니다...</p>}

      {!loading && state.status === 'error' && (
        <p className="rental-error">{state.message}</p>
      )}

      {!loading && state.status === 'ok' && weeks.length > 0 && (
        <div className="rental-table-wrap">
          <table className="rental-table">
            <caption className="visually-hidden">
              전시 기간 확인 및 신청
            </caption>
            <thead>
              <tr>
                <th scope="col" className="rental-table__corner">
                  전시기간
                </th>
                {RENTAL_HALLS.map((hall) => (
                  <th key={hall.id} scope="col">
                    {hall.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week) => (
                <tr key={week.start}>
                  <th scope="row" className="rental-table__week">
                    {weekLabel(week)}
                  </th>
                  {RENTAL_HALLS.map((hall) => {
                    const status: RentalStatus =
                      week.halls[hall.id] ?? 'available'

                    // 구분 필터에서 끈 상태는 빈 칸으로 둡니다.
                    if (!visible[status]) {
                      return (
                        <td key={hall.id}>
                          <span className="rental-cell is-off" />
                        </td>
                      )
                    }

                    if (status === 'available') {
                      return (
                        <td key={hall.id}>
                          <button
                            type="button"
                            className="rental-cell rental-cell--available"
                            onClick={() => apply(hall.id, week)}
                          >
                            대관신청
                          </button>
                        </td>
                      )
                    }

                    return (
                      <td key={hall.id}>
                        <span className={`rental-cell rental-cell--${status}`} />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && state.status === 'ok' && weeks.length === 0 && (
        <p className="rental-hint">
          {state.edge
            ? `${state.edge.slice(0, 4)}년 12월 31일까지 안내할 수 있습니다.`
            : '표시할 대관 일정이 없습니다.'}
        </p>
      )}
    </>
  )
}
