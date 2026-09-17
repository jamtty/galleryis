import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { loginAdmin } from '@/api/auth'
import { useAdminStyles } from '@/hooks/useAdminStyles'
import { PATHS } from '@/routes/paths'
import { isTokenExpired, useAuthStore } from '@/store/useAuthStore'

type LocationState = { from?: string; notice?: string }

export default function AdminLoginPage() {
  useAdminStyles()

  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, accessToken, setAuth } = useAuthStore()

  const [id, setId] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const locationState = location.state as LocationState | null

  // 로그인 후에는 대관 신청 목록으로 보냅니다. (로그인 전 접근했던 경로가 있으면 그쪽으로)
  const redirectTo = locationState?.from ?? PATHS.adminRentals
  const notice = locationState?.notice

  // 이미 로그인되어 있으면 되돌려 보냅니다.
  if (isAuthenticated && !isTokenExpired(accessToken)) {
    return <Navigate to={redirectTo} replace />
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const result = await loginAdmin(id.trim(), password)
      setAuth(result.user, result.token, result.expiresAt)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin_login_wrap">
      <div className="admin_login_box">
        <h1 className="admin_login_title">관리자 로그인</h1>

        <form onSubmit={handleSubmit} noValidate>
          {notice && <p className="admin_session_expired_msg">{notice}</p>}
          {error && <p className="admin_login_error">{error}</p>}

          <div className="admin_login_field">
            <label htmlFor="admin_id">아이디</label>
            <div className="input_wrap">
              <input
                id="admin_id"
                type="text"
                value={id}
                onChange={(event) => setId(event.target.value)}
                placeholder="아이디를 입력하세요."
                autoComplete="username"
                autoFocus
                required
              />
            </div>
          </div>

          <div className="admin_login_field">
            <label htmlFor="admin_pw">비밀번호</label>
            <div className="input_wrap">
              <input
                id="admin_pw"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="비밀번호를 입력하세요."
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="btn_pw_toggle"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
              >
                <span className="material-icons" aria-hidden="true">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          <button type="submit" className="btn_admin_login" disabled={loading}>
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  )
}
