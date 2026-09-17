import { useEffect, useSyncExternalStore } from 'react'
import {
  DEFAULT_SETTINGS,
  fetchPublicSettings,
  toSiteSettings,
  type SiteSettings,
} from '@/api/settings'

/**
 * 공개 사이트 설정값 저장소.
 *
 * 여러 페이지가 같은 값을 쓰기 때문에 한 번만 받아서 나눠 씁니다.
 * 값을 받기 전에는 기본값으로 그리므로 문구가 잠깐 비었다가 채워집니다.
 */
let state: SiteSettings = DEFAULT_SETTINGS
let started = false

const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
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

function load() {
  if (started) return

  started = true

  fetchPublicSettings()
    .then((raw) => {
      state = toSiteSettings(raw)
      emit()
    })
    .catch(() => {
      // 값을 못 받아도 기본값으로 그대로 보여 줍니다.
    })
}

/** 공개 화면에서 쓰는 설정값 */
export function useSiteSettings(): SiteSettings {
  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  useEffect(() => {
    load()
  }, [])

  return value
}
