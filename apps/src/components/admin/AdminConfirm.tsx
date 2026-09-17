import type { ReactNode } from 'react'

type AdminConfirmProps = {
  /** 열려 있는지 */
  open: boolean
  title: string
  message: ReactNode
  /** 확인 버튼 문구 (기본 '삭제') */
  confirmText?: string
  /** 처리 중이면 버튼을 막습니다 */
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * 관리자 공통 확인 알럿.
 *
 * 삭제처럼 되돌릴 수 없는 동작 전에 **반드시** 띄웁니다.
 * 바깥 영역 또는 [취소] 를 누르면 닫히고, [확인] 을 눌러야 실행됩니다.
 */
export default function AdminConfirm({
  open,
  title,
  message,
  confirmText = '삭제',
  busy = false,
  onConfirm,
  onCancel,
}: AdminConfirmProps) {
  if (!open) return null

  return (
    <div
      className="adm_confirm"
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
      onClick={(event) => {
        // 바깥(어두운 영역)을 누르면 취소
        if (event.target === event.currentTarget && !busy) onCancel()
      }}
    >
      <div className="adm_confirm__box">
        <p className="adm_confirm__title">{title}</p>
        <div className="adm_confirm__message">{message}</div>

        <div className="adm_confirm__actions">
          <button
            type="button"
            className="adm_btn_secondary"
            disabled={busy}
            onClick={onCancel}
          >
            취소
          </button>
          <button
            type="button"
            className="adm_btn_delete"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? '처리 중...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
