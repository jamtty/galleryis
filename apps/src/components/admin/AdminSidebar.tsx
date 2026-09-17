import { Link, NavLink } from 'react-router-dom'
import { ADMIN_MENU_SECTIONS, PATHS } from '@/routes/paths'

/** 관리자 좌측 사이드바 */
export default function AdminSidebar() {
  return (
    <aside className="adm_sidebar">
      <div className="adm_logo">
        <Link to={PATHS.adminRentals}>갤러리 이즈 관리자</Link>
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
