import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { PATHS } from '@/routes/paths'
import { isTokenExpired, useAuthStore } from '@/store/useAuthStore'

/**
 * 관리자 라우트 가드.
 * 토큰이 없거나 만료됐으면 로그인 화면으로 보냅니다.
 */
export default function RequireAdmin() {
  const { isAuthenticated, accessToken } = useAuthStore()
  const location = useLocation()

  if (!isAuthenticated || isTokenExpired(accessToken)) {
    return (
      <Navigate
        to={PATHS.adminLogin}
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    )
  }

  return <Outlet />
}
