import { useEffect, useMemo, useRef, useState } from 'react'
import { toIsoDate } from '@/utils/date'

/**
 * 관리자 전용 달력 입력.
 *
 * 날짜를 타이핑하지 않고 달력에서 고릅니다. (값은 YYYY-MM-DD)
 * 스타일은 admin.css 의 .adm_search_date / .adm_datepicker / .adm_cal* 입니다.
 *
 *   variant="search" 검색줄용 (기본) — .adm_search_date
 *   variant="form"   등록·수정 폼용     — .adm_form_input
 */
type DatePickerProps = {
  /** YYYY-MM-DD (빈 값이면 미선택) */
  value: string
  onChange: (value: string) => void
  /** 고를 수 있는 가장 이른 날 (YYYY-MM-DD) */
  minDate?: string
  /** 고를 수 있는 가장 늦은 날 (YYYY-MM-DD) */
  maxDate?: string
  placeholder?: string
  /** 입력칸 모양 (기본 'search') */
  variant?: 'search' | 'form'
  disabled?: boolean
  /** 마우스를 올렸을 때 안내 (연동 전 화면용) */
  title?: string
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const

/** 로컬 날짜 → YYYY-MM-DD (utils/date.ts 와 같은 규칙) */
const toYmd = toIsoDate
/** YYYY-MM-DD → Date (형식이 아니면 null) */
function parseYmd(value: string) {
  const parts = (value ?? '').split('-')

  if (parts.length !== 3) return null

  const year = Number(parts[0])
  const month = Number(parts[1])
  const day = Number(parts[2])

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null
  }

  const date = new Date(year, month - 1, day)

  return Number.isNaN(date.getTime()) ? null : date
}

/** 그 달 1일 */
function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export default function DatePicker({
  value,
  onChange,
  minDate,
  maxDate,
  placeholder = '날짜 선택',
  variant = 'search',
  disabled = false,
  title,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(() => monthStart(parseYmd(value) ?? new Date()))

  const wrapRef = useRef<HTMLDivElement>(null)

  // 바깥을 누르거나 ESC 를 누르면 닫습니다.
  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const today = toYmd(new Date())

  /** 1일 앞의 빈칸 수와 그 달의 날짜들 */
  const { blanks, days } = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1)
    const lastDay = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate()

    return {
      blanks: first.getDay(),
      days: Array.from({ length: lastDay }, (_, index) => index + 1),
    }
  }, [view])

  const isBlocked = (ymd: string) =>
    (Boolean(minDate) && ymd < String(minDate)) ||
    (Boolean(maxDate) && ymd > String(maxDate))

  const pick = (day: number) => {
    onChange(toYmd(new Date(view.getFullYear(), view.getMonth(), day)))
    setOpen(false)
  }

  const moveMonth = (step: number) => {
    setView((current) => new Date(current.getFullYear(), current.getMonth() + step, 1))
  }

  const toggle = () => {
    if (disabled) return

    // 열 때는 선택된 날짜(없으면 오늘)의 달을 보여 줍니다.
    setView(monthStart(parseYmd(value) ?? new Date()))
    setOpen((previous) => !previous)
  }

  return (
    <div
      className={
        variant === 'form' ? 'adm_datepicker adm_datepicker--form' : 'adm_datepicker'
      }
      ref={wrapRef}
    >
      <input
        type="text"
        className={variant === 'form' ? 'adm_form_input' : 'adm_search_date'}
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        readOnly
        disabled={disabled}
        title={title ?? '달력에서 날짜를 선택하세요.'}
        onClick={toggle}
      />

      {open && !disabled && (
        <div className="adm_calendar" role="dialog" aria-label="달력">
          <div className="adm_cal_header">
            <button
              type="button"
              className="adm_cal_nav"
              aria-label="이전 달"
              onClick={() => moveMonth(-1)}
            >
              ‹
            </button>

            <span className="adm_cal_title">
              {view.getFullYear()}년 {view.getMonth() + 1}월
            </span>

            <button
              type="button"
              className="adm_cal_nav"
              aria-label="다음 달"
              onClick={() => moveMonth(1)}
            >
              ›
            </button>
          </div>

          <div className="adm_cal_grid">
            {WEEKDAYS.map((label, index) => {
              const classes = ['adm_cal_label']

              if (index === 0) classes.push('is_sun')
              if (index === 6) classes.push('is_sat')

              return (
                <span key={label} className={classes.join(' ')}>
                  {label}
                </span>
              )
            })}

            {Array.from({ length: blanks }, (_, index) => (
              <span key={`blank-${index}`} className="adm_cal_cell is_empty" />
            ))}

            {days.map((day) => {
              const date = new Date(view.getFullYear(), view.getMonth(), day)
              const ymd = toYmd(date)
              const weekday = date.getDay()

              const classes = ['adm_cal_cell']

              if (weekday === 0) classes.push('is_sun')
              if (weekday === 6) classes.push('is_sat')
              if (ymd === today) classes.push('is_today')
              if (ymd === value) classes.push('is_selected')
              if (isBlocked(ymd)) classes.push('is_disabled')

              return (
                <button
                  key={day}
                  type="button"
                  className={classes.join(' ')}
                  onClick={() => pick(day)}
                >
                  {day}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
