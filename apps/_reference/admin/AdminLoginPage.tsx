import { useState, useEffect } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuthStore, isTokenExpired } from '@/store/useAuthStore'
import { loginAdmin } from '@/api/auth'
import adminCssUrl from '@/assets/css/admin.css?url'

export default function AdminLoginPage() {
  const navigate = useNavigate()
  const { isAuthenticated, accessToken, setAuth } = useAuthStore()

  const [id, setId] = useState('')
  const [pw, setPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = adminCssUrl
    document.head.appendChild(link)
    return () => { document.head.removeChild(link) }
  }, [])

  if (isAuthenticated && !isTokenExpired(accessToken)) {
    return <Navigate to="/admin/banner" replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const result = await loginAdmin(id, pw)
      setAuth(
        {
          id: result.user.id,
          email: id,
          name: result.user.name,
          role: 'ADMIN',
          createdAt: new Date().toISOString(),
        },
        result.token,
      )
      navigate('/admin/banner', { replace: true })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '로그인에 실패했습니다.'
      alert(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin_login_wrap">
      <div className="admin_login_box">
        <h1 className="admin_login_title">로그인</h1>

        <form onSubmit={handleSubmit}>
          <div className="admin_login_field">
            <label htmlFor="admin_id">아이디</label>
            <div className="input_wrap">
              <input
                id="admin_id"
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="아이디를 입력하세요."
                required
                autoComplete="username"
              />
            </div>
          </div>

          <div className="admin_login_field">
            <label htmlFor="admin_pw">비밀번호</label>
            <div className="input_wrap">
              <input
                id="admin_pw"
                type={showPw ? 'text' : 'password'}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="비밀번호를 입력하세요."
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="btn_pw_toggle"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? '비밀번호 숨기기' : '비밀번호 보기'}
              >
                {showPw ? (
                  <span className="material-icons" style={{ fontSize: '2rem', color: '#9ca3af' }}>
                    visibility_off
                  </span>
                ) : (
                  <span className="material-icons" style={{ fontSize: '2rem', color: '#9ca3af' }}>
                    visibility
                  </span>
                )}
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
