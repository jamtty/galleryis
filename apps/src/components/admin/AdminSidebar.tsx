import { Link, NavLink } from 'react-router-dom'
import { ADMIN_MENU_SECTIONS, PATHS } from '@/routes/paths'

type AdminSidebarProps = {
  /** 좁은 화면에서 메뉴를 펼쳤는지 (넓은 화면에서는 늘 보입니다) */
  open?: boolean
  /** 메뉴를 고르거나 바깥을 눌렀을 때 */
  onClose?: () => void
}

/** 관리자 좌측 사이드바 — 좁은 화면에서는 헤더의 메뉴 버튼으로 여는 서랍이 됩니다. */
export default function AdminSidebar({ open = false, onClose }: AdminSidebarProps) {
  return (
    <aside className={open ? 'adm_sidebar is-open' : 'adm_sidebar'}>
      <div className="adm_logo">
        <Link to={PATHS.adminRentals} onClick={onClose}>
          갤러리 이즈 관리자
        </Link>
      </div>

      <nav className="adm_nav" aria-label="관리자 메뉴">
        <ul>
          {ADMIN_MENU_SECTIONS.map((section, sectionIndex) => (
            <li
              key={section.label ?? `section-${sectionIndex}`}
              className="adm_nav_section"
            >
              {section.label && (
                <span className="adm_nav_section_label">{section.label}</span>
              )}

              <ul>
                {section.items.map((menu) => (
                  <li key={menu.to}>
                    <NavLink
                      to={menu.to}
                      onClick={onClose}
                      className={({ isActive }) => (isActive ? 'active' : '')}
                    >
                      <span className="material-icons" aria-hidden="true">
                        {menu.icon}
                      </span>
                      {menu.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}
