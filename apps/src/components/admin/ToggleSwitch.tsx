type ToggleSwitchProps = {
  /** 켜짐 여부 (use_yn === 'Y') */
  checked: boolean
  /** 클릭 시 호출 — 다음 값으로 전환합니다. */
  onChange: () => void
  disabled?: boolean
  /** 마우스를 올렸을 때 안내 문구 */
  title?: string
}

/**
 * 관리자 목록용 스위치 토글.
 *
 * 사용/미사용처럼 두 값만 있는 항목에 씁니다.
 * 클릭하면 onChange 만 부르고, 실제 상태는 부모가 정합니다. (낙관적 갱신)
 * 스타일은 admin.css 의 .adm_switch 입니다.
 */
export default function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  title,
}: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={title}
      className={checked ? 'adm_switch on' : 'adm_switch'}
      onClick={onChange}
      disabled={disabled}
      title={title}
    >
      <span className="adm_switch_knob" />
    </button>
  )
}
