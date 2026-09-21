import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import AdminHeader from './AdminHeader'
import AdminSidebar from './AdminSidebar'

type AdminPageProps = {
  /** 페이지 제목 (헤더에 표시) */
  title: string
  children: ReactNode
}

/**
 * 관리자 페이지 공통 레이아웃.
 * 사이드바 + 헤더 + 본문을 감싸고 admin.css 를 불러옵니다.
 *
 * 좁은 화면(≤767px)에서는 사이드바가 서랍이 되고, 헤더의 메뉴 버튼으로 열고 닫습니다.
 */
export default function AdminPage({ title, children }: AdminPageProps) {
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  /** 지금 서랍을 연 주소 — 다른 주소로 넘어가면 서랍을 닫습니다. */
  const [menuPath, setMenuPath] = useState(pathname)

  // 화면을 옮기면 서랍을 닫습니다. (effect 대신 렌더 중 상태 조정 — 연속 렌더 한 번)
  if (menuPath !== pathname) {
    setMenuPath(pathname)
    setMenuOpen(false)
  }

  // 서랍이 열려 있으면 Esc 로 닫습니다.
  useEffect(() => {
    if (!menuOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)

    return () => document.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  return (
    <div className={menuOpen ? 'adm_wrap is-menu-open' : 'adm_wrap'}>
      <AdminSidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="adm_content">
        <AdminHeader
          pageTitle={title}
          menuOpen={menuOpen}
          onMenuToggle={() => setMenuOpen((value) => !value)}
        />
        <main className="adm_main">{children}</main>
      </div>

      {/* 서랍이 열렸을 때 뒤를 어둡게 — 누르면 닫힙니다 */}
      {menuOpen && (
        <button
          type="button"
          className="adm_scrim"
          aria-label="메뉴 닫기"
          onClick={() => setMenuOpen(false)}
        />
      )}
    </div>
  )
}
