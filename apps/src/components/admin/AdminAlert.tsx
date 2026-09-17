import { useEffect } from 'react'
import type { ReactNode } from 'react'

type AdminAlertProps = {
  /** 열려 있는지 */
  open: boolean
  title: string
  message?: ReactNode
  /** 확인 버튼 문구 (기본 '확인') */
  confirmText?: string
  /** [확인] 을 누르거나 바깥을 누르면 실행 (보통 목록으로 이동) */
  onClose: () => void
}

/**
 * 관리자 공통 안내 알럿.
 *
 * 처리 결과(등록·수정되었습니다 등)를 알리고 [확인] 을 누르면 다음 동작을 실행합니다.
 * 스타일은 삭제 확인 알럿(AdminConfirm)과 같은 .adm_confirm* 을 씁니다.
 */
export default function AdminAlert({
  open,
  title,
  message,
  confirmText = '확인',
  onClose,
}: AdminAlertProps) {
  // ESC 로도 닫습니다.
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="adm_confirm adm_alert"
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
      onClick={(event) => {
        // 바깥(어두운 영역)을 누르면 닫습니다.
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="adm_confirm__box">
        <p className="adm_confirm__title">{title}</p>

        {message && <div className="adm_confirm__message">{message}</div>}

        <div className="adm_confirm__actions">
          <button type="button" className="adm_btn_primary" onClick={onClose}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
