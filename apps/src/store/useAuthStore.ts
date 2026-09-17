import { useSyncExternalStore } from 'react'

/** 로그인한 관리자 정보 */
export type AdminUser = {
  id: string
  name: string
  role: string
  email?: string | null
}

export type AuthState = {
  accessToken: string | null
  /** 토큰 만료 시각 (ISO 8601) */
  expiresAt: string | null
  user: AdminUser | null
}

const STORAGE_KEY = 'galleryis.admin.auth'

const EMPTY: AuthState = { accessToken: null, expiresAt: null, user: null }

function readStorage(): AuthState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY

    const parsed = JSON.parse(raw) as Partial<AuthState>
    if (!parsed.accessToken || !parsed.user) return EMPTY

    return {
      accessToken: parsed.accessToken,
      expiresAt: parsed.expiresAt ?? null,
      user: parsed.user,
    }
  } catch {
    return EMPTY
  }
}

let state: AuthState = readStorage()
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function setState(next: AuthState) {
  state = next

  // 저장 실패(프라이빗 모드/용량 초과)는 무시합니다.
  try {
    if (next.accessToken && next.user) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } else {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    /* noop */
  }

  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return state
}

/** 토큰 만료 여부. 만료 시각을 알 수 없으면 만료로 간주합니다. */
export function isTokenExpired(token: string | null): boolean {
  if (!token || !state.expiresAt) return true
  return new Date(state.expiresAt).getTime() <= Date.now()
}

/** React 컴포넌트 밖(API 클라이언트)에서 토큰을 읽을 때 사용합니다. */
export function getAccessToken(): string | null {
  return state.accessToken
}

export function clearAuth() {
  setState(EMPTY)
}

export function useAuthStore() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  return {
    accessToken: snapshot.accessToken,
    expiresAt: snapshot.expiresAt,
    user: snapshot.user,
    isAuthenticated: Boolean(snapshot.accessToken),
    setAuth(user: AdminUser, token: string, expiresAt: string) {
      setState({ accessToken: token, expiresAt, user })
    },
    clearAuth,
  }
}
