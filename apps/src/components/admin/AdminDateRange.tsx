import DatePicker from './DatePicker'

/**
 * 관리자 목록 검색 — 기간(시작일 ~ 종료일).
 *
 * `.adm_search_row` 안에서 그대로 쓰는 조각입니다.
 * (날짜를 고르면 반대쪽 날짜가 앞뒤로 뒤집히지 않도록 minDate/maxDate 를 겁니다)
 */
type AdminDateRangeProps = {
  /** YYYY-MM-DD */
  from: string
  /** YYYY-MM-DD */
  to: string
  onChange: (range: { from: string; to: string }) => void
  /** 기간이 무엇을 뜻하는지 (예: 신청일 · 등록일) */
  label?: string
  disabled?: boolean
  /** 마우스를 올렸을 때 안내 (연동 전 화면용) */
  title?: string
}

export default function AdminDateRange({
  from,
  to,
  onChange,
  label = '기간',
  disabled = false,
  title,
}: AdminDateRangeProps) {
  return (
    <>
      <span className="adm_search_label">{label}</span>

      <DatePicker
        value={from}
        onChange={(value) => onChange({ from: value, to })}
        maxDate={to || undefined}
        placeholder="시작일"
        disabled={disabled}
        title={title}
      />

      <span className="adm_search_label">~</span>

      <DatePicker
        value={to}
        onChange={(value) => onChange({ from, to: value })}
        minDate={from || undefined}
        placeholder="종료일"
        disabled={disabled}
        title={title}
      />
    </>
  )
}
