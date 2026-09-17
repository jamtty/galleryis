import type { ReactNode } from 'react'
import { useAdminStyles } from '@/hooks/useAdminStyles'
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
 */
export default function AdminPage({ title, children }: AdminPageProps) {
  useAdminStyles()

  return (
    <div className="adm_wrap">
      <AdminSidebar />
      <div className="adm_content">
        <AdminHeader pageTitle={title} />
        <main className="adm_main">{children}</main>
      </div>
    </div>
  )
}
