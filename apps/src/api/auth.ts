import type { AdminUser } from '@/store/useAuthStore'
import { apiRequest } from './client'

export type LoginResult = {
  token: string
  /** 토큰 만료 시각 (ISO 8601) */
  expiresAt: string
  user: AdminUser
}

/** 관리자 로그인 */
export function loginAdmin(id: string, password: string) {
  return apiRequest<LoginResult>('/api/auth/login.php', {
    method: 'POST',
    body: { id, password },
    auth: false,
  })
}

/** 로그아웃 (서버에 저장된 토큰 무효화) */
export function logoutAdmin() {
  return apiRequest<null>('/api/auth/logout.php', { method: 'POST' })
}

/** 새 비밀번호 최소 길이 — backend/api/auth/password.php 와 동일하게 유지하세요. */
export const PASSWORD_MIN_LENGTH = 4

/** 비밀번호 변경 (성공 시 서버가 기존 토큰을 모두 폐기하므로 재로그인이 필요합니다) */
export function changePassword(
  currentPassword: string,
  newPassword: string,
  newPasswordConfirm: string,
) {
  return apiRequest<null>('/api/auth/password.php', {
    method: 'POST',
    body: { currentPassword, newPassword, newPasswordConfirm },
  })
}
