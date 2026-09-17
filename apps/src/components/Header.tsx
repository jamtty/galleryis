import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { NAV_ITEMS, PATHS, isNavItemActive } from '../routes/paths'
import Logo from './Logo'
import { CloseIcon, MenuIcon } from './icons'

export default function Header() {
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [renderedPath, setRenderedPath] = useState(pathname)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  // 경로가 바뀌면 모바일 메뉴를 닫습니다.
  // effect 대신 렌더 중 상태를 조정하는 React 권장 패턴을 사용합니다.
  if (renderedPath !== pathname) {
    setRenderedPath(pathname)
    setMenuOpen(false)
  }

  // Esc 로 메뉴 닫기
  useEffect(() => {
    if (!menuOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setMenuOpen(false)
      menuButtonRef.current?.focus()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  return (
    <>
      {menuOpen && (
        <div
          className="nav-scrim"
          aria-hidden="true"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <header className="site-header">
        <div className="site-header__inner">
          <Link
            to={PATHS.home}
            className="brand"
            onClick={() => window.scrollTo({ top: 0 })}
          >
            <Logo />
          </Link>

          <nav
            id="site-menu"
            aria-label="주요 메뉴"
            className={menuOpen ? 'main-nav is-open' : 'main-nav'}
          >
            {NAV_ITEMS.map((item) => {
              const active = isNavItemActive(item, pathname)
              return (
                <Link
                  key={item.id}
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={
                    active ? 'main-nav__link is-active' : 'main-nav__link'
                  }
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div className="site-header__actions">
            <button
              type="button"
              ref={menuButtonRef}
              className="menu-toggle"
              aria-label={menuOpen ? '닫기' : '메뉴'}
              aria-expanded={menuOpen}
              aria-controls="site-menu"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>
      </header>
    </>
  )
}
