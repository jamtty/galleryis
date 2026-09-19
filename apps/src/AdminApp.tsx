import { Navigate, Route, Routes } from 'react-router'
import RequireAdmin from '@/components/admin/RequireAdmin'
import AdminExhibitionFormPage from '@/pages/admin/AdminExhibitionFormPage'
import AdminExhibitionPage from '@/pages/admin/AdminExhibitionPage'
import AdminHallFormPage from '@/pages/admin/AdminHallFormPage'
import AdminHallPage from '@/pages/admin/AdminHallPage'
import AdminLoginPage from '@/pages/admin/AdminLoginPage'
import AdminMyPage from '@/pages/admin/AdminMyPage'
import AdminNoticeFormPage from '@/pages/admin/AdminNoticeFormPage'
import AdminNoticePage from '@/pages/admin/AdminNoticePage'
import AdminPopupFormPage from '@/pages/admin/AdminPopupFormPage'
import AdminPopupPage from '@/pages/admin/AdminPopupPage'
import AdminRentalEditPage from '@/pages/admin/AdminRentalEditPage'
import AdminRentalRequestPage from '@/pages/admin/AdminRentalRequestPage'
import AdminRentalSchedulePage from '@/pages/admin/AdminRentalSchedulePage'
import AdminSettingPage from '@/pages/admin/AdminSettingPage'
import { PATHS } from '@/routes/paths'

/**
 * 관리자 화면의 라우트.
 *
 * 예전에는 이 앱 전체를 createBrowserRouter 로 묶었지만, 공개 사이트는
 * 원본과 같은 구조(<Routes> 를 App 안에서 선언)를 쓰므로 관리자만 떼어 냈습니다.
 * 관리자 화면 자체는 그대로입니다 — 공개 사이트의 헤더·푸터를 쓰지 않고,
 * admin.css/common.css 도 관리자 라우트에서만 불러옵니다.
 */
export default function AdminApp() {
  return (
    <Routes>
      <Route path={PATHS.adminLogin} element={<AdminLoginPage />} />

      <Route path={PATHS.admin}>
        <Route element={<RequireAdmin />}>
          {/* 관리자 진입 시 바로 대관 신청 목록으로 보냅니다. (대시보드 없음) */}
          <Route index element={<Navigate to={PATHS.adminRentals} replace />} />
          <Route path="rentals" element={<AdminRentalRequestPage />} />
          <Route path="rentals/edit/:id" element={<AdminRentalEditPage />} />
          <Route path="schedule" element={<AdminRentalSchedulePage />} />
          <Route path="exhibitions" element={<AdminExhibitionPage />} />
          <Route path="exhibitions/write" element={<AdminExhibitionFormPage />} />
          <Route
            path="exhibitions/edit/:id"
            element={<AdminExhibitionFormPage />}
          />
          <Route path="halls" element={<AdminHallPage />} />
          <Route path="halls/edit/:id" element={<AdminHallFormPage />} />
          <Route path="notices" element={<AdminNoticePage />} />
          <Route path="notices/write" element={<AdminNoticeFormPage />} />
          <Route path="notices/edit/:id" element={<AdminNoticeFormPage />} />
          <Route path="popups" element={<AdminPopupPage />} />
          <Route path="popups/write" element={<AdminPopupFormPage />} />
          <Route path="popups/edit/:id" element={<AdminPopupFormPage />} />
          <Route path="settings" element={<AdminSettingPage />} />
          <Route path="mypage" element={<AdminMyPage />} />
          <Route path="*" element={<Navigate to={PATHS.adminRentals} replace />} />
        </Route>
      </Route>
    </Routes>
  )
}
