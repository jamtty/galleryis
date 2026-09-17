import { useState } from 'react'
import AdminHeader from '@/components/admin/AdminHeader'
import AdminSidebar from '@/components/admin/AdminSidebar'
import { useAuthStore } from '@/store/useAuthStore'
import { changePassword } from '@/api/auth'

export default function AdminMyPage() {
  const { user } = useAuthStore()
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.next !== form.confirm) {
      alert('새 비밀번호가 일치하지 않습니다.')
      return
    }
    if (form.next.length < 6) {
      alert('새 비밀번호는 6자 이상이어야 합니다.')
      return
    }
    setLoading(true)
    try {
      await changePassword(form.current, form.next, form.confirm)
      alert('비밀번호가 변경되었습니다.')
      setForm({ current: '', next: '', confirm: '' })
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '비밀번호 변경에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="adm_wrap">
      <AdminSidebar />

      <div className="adm_content">
        <AdminHeader pageTitle="마이페이지" />

        <main className="adm_main">
          {/* 계정 정보 */}
          <section className="adm_section" style={{ maxWidth: '52rem' }}>
            <h3 className="adm_section_title">계정 정보</h3>
            <div className="adm_mypage_info">
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

          {/* 비밀번호 변경 */}
          <section className="adm_section" style={{ maxWidth: '52rem' }}>
            <h3 className="adm_section_title">비밀번호 변경</h3>
            <form className="adm_mypage_form" onSubmit={handleSubmit}>
              <div className="adm_form_field">
                <label>현재 비밀번호</label>
                <input
                  type="password"
                  name="current"
                  value={form.current}
                  onChange={handleChange}
                  autoComplete="current-password"
                  required
                />
              </div>
              <div className="adm_form_field">
                <label>
                  새 비밀번호 <small>(6자 이상)</small>
                </label>
                <input
                  type="password"
                  name="next"
                  value={form.next}
                  onChange={handleChange}
                  autoComplete="new-password"
                  required
                />
              </div>
              <div className="adm_form_field">
                <label>새 비밀번호 확인</label>
                <input
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
        </main>
      </div>
    </div>
  )
}
