import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { PASSWORD_MIN_LENGTH, changePassword } from '@/api/auth'
import AdminAlert from '@/components/admin/AdminAlert'
import AdminPage from '@/components/admin/AdminPage'
import { PATHS } from '@/routes/paths'
import { useAuthStore } from '@/store/useAuthStore'

const EMPTY_FORM = { current: '', next: '', confirm: '' }

export default function AdminMyPage() {
  const navigate = useNavigate()
  const { user, clearAuth } = useAuthStore()

  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** 변경 완료 안내 알럿 문구 (null 이면 닫힘) */
  const [done, setDone] = useState<string | null>(null)

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (form.current === '') {
      setError('현재 비밀번호를 입력해 주세요.')
      return
    }

    if (form.next.length < PASSWORD_MIN_LENGTH) {
      setError(`새 비밀번호는 ${PASSWORD_MIN_LENGTH}자리 이상이어야 합니다.`)
      return
    }

    if (form.next !== form.confirm) {
      setError('새 비밀번호가 서로 일치하지 않습니다.')
      return
    }

    setLoading(true)

    try {
      await changePassword(form.current, form.next, form.confirm)
      setForm(EMPTY_FORM)

      // 서버가 기존 토큰을 모두 폐기하므로 재로그인이 필요합니다.
      // 안내 알럿을 닫을 때 clearAuth() 를 먼저 호출해야
      // 로그인 페이지가 다시 되돌리지 않습니다.
      setDone('비밀번호가 변경되었습니다.')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '비밀번호 변경에 실패했습니다.',
      )
    } finally {
      setLoading(false)
    }
  }

  /** 알럿을 닫으면 로그아웃하고 로그인 페이지로 보냅니다. */
  const goLogin = () => {
    clearAuth()
    navigate(PATHS.adminLogin, {
      replace: true,
      state: { notice: '새 비밀번호로 다시 로그인해 주세요.' },
    })
  }

  return (
    <AdminPage title="마이페이지">
      <section className="adm_section" style={{ maxWidth: '52rem' }}>
        <h2 className="adm_section_title">계정 정보</h2>

        <div className="adm_mypage_info">
          <div className="adm_mypage_row">
            <span className="adm_mypage_label">아이디</span>
            <span className="adm_mypage_value">{user?.id ?? '-'}</span>
          </div>
          <div className="adm_mypage_row">
            <span className="adm_mypage_label">이름</span>
            <span className="adm_mypage_value">{user?.name ?? '-'}</span>
          </div>
          <div className="adm_mypage_row">
            <span className="adm_mypage_label">권한</span>
            <span className="adm_mypage_value">{user?.role ?? '-'}</span>
          </div>
        </div>
      </section>

      <section className="adm_section" style={{ maxWidth: '52rem' }}>
        <h2 className="adm_section_title">비밀번호 변경</h2>

        <form className="adm_mypage_form" onSubmit={handleSubmit}>
          {error && <p className="admin_login_error">{error}</p>}

          <div className="adm_form_field">
            <label htmlFor="pw_current">현재 비밀번호</label>
            <input
              id="pw_current"
              type="password"
              name="current"
              value={form.current}
              onChange={handleChange}
              autoComplete="current-password"
              required
            />
          </div>

          <div className="adm_form_field">
            <label htmlFor="pw_next">
              새 비밀번호 <small>({PASSWORD_MIN_LENGTH}자리 이상)</small>
            </label>
            <input
              id="pw_next"
              type="password"
              name="next"
              value={form.next}
              onChange={handleChange}
              autoComplete="new-password"
              required
            />
          </div>

          <div className="adm_form_field">
            <label htmlFor="pw_confirm">새 비밀번호 확인</label>
            <input
              id="pw_confirm"
              type="password"
              name="confirm"
              value={form.confirm}
              onChange={handleChange}
              autoComplete="new-password"
              required
            />
          </div>

          <button type="submit" className="adm_btn_primary" disabled={loading}>
            {loading ? '변경 중...' : '비밀번호 변경'}
          </button>
        </form>
      </section>

      <AdminAlert open={done !== null} title={done ?? ''} onClose={goLogin} />
    </AdminPage>
  )
}
