import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { logoutAdmin } from '@/api/auth'
import { PATHS } from '@/routes/paths'
import { useAuthStore } from '@/store/useAuthStore'

type AdminHeaderProps = {
  pageTitle: string
}

/** 관리자 상단 헤더 (페이지 제목 + 사용자 메뉴) */
export default function AdminHeader({ pageTitle }: AdminHeaderProps) {
  const navigate = useNavigate()
  const { user, clearAuth } = useAuthStore()
  const [open, setOpen] = useState(false)
  const userRef = useRef<HTMLDivElement>(null)

  // 바깥 클릭 / Esc 로 드롭다운 닫기
  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      if (!userRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const handleLogout = async () => {
    try {
      await logoutAdmin()
    } catch {
      // 서버 토큰 정리에 실패해도 로컬 세션은 반드시 정리합니다.
    }
    clearAuth()
    navigate(PATHS.adminLogin, { replace: true })
  }

  return (
    <header className="adm_header">
      <h1 className="adm_page_title">{pageTitle}</h1>

      <div className="adm_user" ref={userRef}>
        <button
          type="button"
          className="adm_user_btn"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="material-icons" aria-hidden="true">
            account_circle
          </span>
          {user?.name ?? user?.id ?? '관리자'}
          <span className="material-icons" aria-hidden="true">
            expand_more
          </span>
        </button>

        {open && (
          <ul className="adm_dropdown" role="menu">
            <li role="none">
              <Link to={PATHS.adminMyPage} role="menuitem">
                마이페이지
              </Link>
            </li>
            <li role="none">
              <button type="button" role="menuitem" onClick={handleLogout}>
                로그아웃
              </button>
            </li>
          </ul>
        )}
      </div>
    </header>
  )
}
