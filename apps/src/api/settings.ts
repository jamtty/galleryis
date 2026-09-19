import { apiRequest } from './client'

/**
 * 사이트 환경설정 API — backend/lib/setting.php (site_setting 테이블).
 *
 * 공개 화면은 public.php 만 토큰 없이 부르고, 관리자 화면은 detail/update 를 씁니다.
 *
 * 새 설정을 추가할 때
 *   1) backend/lib/setting.php 의 setting_definitions() 에 한 줄 추가 (관리자 화면은 자동 반영)
 *   2) 공개 화면에서 쓴다면 아래 SETTING_KEYS 와 DEFAULT_SETTINGS 에 같은 키를 추가
 */

/** 공개 사이트에서 쓰는 설정 키 (설정 키 → 화면에서 쓰는 이름) */
export const SETTING_KEYS = {
  pagePrivacyHtml: 'page_privacy_html',
} as const

export type SiteSettings = Record<keyof typeof SETTING_KEYS, string>

/**
 * 서버에 값이 없거나 응답이 실패했을 때 쓸 기본값.
 * (backend/lib/setting.php 의 default 와 같게 유지하세요)
 */
export const DEFAULT_SETTINGS: SiteSettings = {
  pagePrivacyHtml: '',
}

/** 공개 설정값 (인증 없음) — { 설정키: 값 } */
export function fetchPublicSettings() {
  return apiRequest<Record<string, string>>('/api/settings/public.php', {
    auth: false,
  })
}

/** 공개 응답(설정 키 → 값) 을 화면에서 쓰는 이름으로 바꿉니다. */
export function toSiteSettings(raw: Record<string, string> | null | undefined): SiteSettings {
  const next: SiteSettings = { ...DEFAULT_SETTINGS }

  if (!raw) return next

  for (const [name, key] of Object.entries(SETTING_KEYS)) {
    const value = raw[key]

    if (typeof value === 'string') next[name as keyof SiteSettings] = value
  }

  return next
}

/* --------------------------------------------------------------------------
   관리자 — 입력칸 정의를 서버에서 받아 그립니다.
   -------------------------------------------------------------------------- */

/** 입력칸 종류 (서버가 모르는 값을 보내면 화면에서는 text 로 처리합니다) */
export type SettingFieldType = 'text' | 'textarea' | 'html'

export type SettingField = {
  key: string
  label: string
  type: SettingFieldType
  /** 입력칸 아래 도움말 */
  hint: string
  /** 최대 글자 수 */
  max: number
  required: boolean
  value: string
}

export type SettingGroup = {
  key: string
  label: string
  help: string
  fields: SettingField[]
}

/** 관리자 — 그룹 · 입력칸 정의 · 현재 값 */
export function fetchSettingGroups() {
  return apiRequest<{ groups: SettingGroup[] }>('/api/settings/detail.php')
}

/** 관리자 — 저장 (설정 키 → 값) */
export function updateSettings(values: Record<string, string>) {
  return apiRequest<{ saved: number; values: Record<string, string> }>(
    '/api/settings/update.php',
    { method: 'POST', body: { values } },
  )
}
