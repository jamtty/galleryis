import { Navigate, createBrowserRouter } from 'react-router-dom'
import Layout from './components/Layout'
import RequireAdmin from './components/admin/RequireAdmin'
import AboutPage from './pages/AboutPage'
import ExhibitionDetailPage from './pages/ExhibitionDetailPage'
import ExhibitionsPage from './pages/ExhibitionsPage'
import HallsPage from './pages/HallsPage'
import HomePage from './pages/HomePage'
import NoticeDetailPage from './pages/NoticeDetailPage'
import NoticesPage from './pages/NoticesPage'
import NotFoundPage from './pages/NotFoundPage'
import PrivacyPage from './pages/PrivacyPage'
import RentalApplyPage from './pages/RentalApplyPage'
import RentalPage from './pages/RentalPage'
import VisitPage from './pages/VisitPage'
import AdminExhibitionFormPage from './pages/admin/AdminExhibitionFormPage'
import AdminExhibitionPage from './pages/admin/AdminExhibitionPage'
import AdminLoginPage from './pages/admin/AdminLoginPage'
import AdminMyPage from './pages/admin/AdminMyPage'
import AdminNoticeFormPage from './pages/admin/AdminNoticeFormPage'
import AdminNoticePage from './pages/admin/AdminNoticePage'
import AdminPopupFormPage from './pages/admin/AdminPopupFormPage'
import AdminPopupPage from './pages/admin/AdminPopupPage'
import AdminRentalEditPage from './pages/admin/AdminRentalEditPage'
import AdminRentalRequestPage from './pages/admin/AdminRentalRequestPage'
import AdminRentalSchedulePage from './pages/admin/AdminRentalSchedulePage'
import { PATHS } from './routes/paths'

/**
 * 라우트 테이블 — 실제 사이트와 동일한 구조.
 * 공통 레이아웃(헤더/푸터)은 pathless 라우트로 감싸고,
 * 각 페이지는 아직 내용이 없는 빈 페이지입니다.
 */
export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: PATHS.home, element: <HomePage /> },
      { path: PATHS.exhibitions, element: <ExhibitionsPage /> },
      { path: PATHS.exhibitionDetail, element: <ExhibitionDetailPage /> },
      { path: PATHS.halls, element: <HallsPage /> },
      { path: PATHS.rental, element: <RentalPage /> },
      { path: PATHS.rentalApply, element: <RentalApplyPage /> },
      { path: PATHS.about, element: <AboutPage /> },
      { path: PATHS.visit, element: <VisitPage /> },
      { path: PATHS.notices, element: <NoticesPage /> },
      { path: PATHS.noticeDetail, element: <NoticeDetailPage /> },
      { path: PATHS.privacy, element: <PrivacyPage /> },
      { path: PATHS.notFound, element: <NotFoundPage /> },
    ],
  },

  /* --------------------------------------------------------------------------
     관리자 — 공개 사이트의 헤더/푸터를 쓰지 않고 자체 레이아웃을 사용합니다.
     -------------------------------------------------------------------------- */
  {
    path: PATHS.admin,
    children: [
      { path: 'login', element: <AdminLoginPage /> },
      {
        element: <RequireAdmin />,
        children: [
          // 관리자 진입 시 바로 대관 신청 목록으로 보냅니다. (대시보드 없음)
          { index: true, element: <Navigate to={PATHS.adminRentals} replace /> },
          { path: 'rentals', element: <AdminRentalRequestPage /> },
          { path: 'rentals/edit/:id', element: <AdminRentalEditPage /> },
          { path: 'schedule', element: <AdminRentalSchedulePage /> },
          { path: 'exhibitions', element: <AdminExhibitionPage /> },
          { path: 'exhibitions/write', element: <AdminExhibitionFormPage /> },
          { path: 'exhibitions/edit/:id', element: <AdminExhibitionFormPage /> },
          { path: 'notices', element: <AdminNoticePage /> },
          { path: 'notices/write', element: <AdminNoticeFormPage /> },
          { path: 'notices/edit/:id', element: <AdminNoticeFormPage /> },
          { path: 'popups', element: <AdminPopupPage /> },
          { path: 'popups/write', element: <AdminPopupFormPage /> },
          { path: 'popups/edit/:id', element: <AdminPopupFormPage /> },
          { path: 'mypage', element: <AdminMyPage /> },
          { path: '*', element: <Navigate to={PATHS.adminRentals} replace /> },
        ],
      },
    ],
  },
])
