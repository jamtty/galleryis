import { apiRequest } from './client'

/**
 * 영문 번역 (기계 번역) API — backend/api/translate/*.php
 *
 * 관리자 [영문 번역] 화면만 씁니다. 공개 화면은 각 도메인 API 가 함께 내려 주는
 * 영문 값(*En)을 그냥 쓰면 되므로 이 주소를 부를 일이 없습니다.
 */

/** 번역 대상 — backend/lib/translation.php 의 TRANSLATION_ENTITY_LABELS 와 같습니다 */
export type TranslateTarget = 'exhibition' | 'notice' | 'hall' | 'popup' | 'setting'

/** 'missing' 아직 없는 것 · 'stale' 원문이 바뀐 것 · 'all' 그 항목을 강제로 다시 */
export type TranslateScope = 'missing' | 'stale' | 'all'

export type TranslateTargetStatus = {
  entity: TranslateTarget
  /** 화면에 쓰는 이름 (전시 · 공지 …) */
  label: string
  /** 항목 수 (전시 12편 · 공지 40건 …) */
  items: number
  /** 번역할 값의 수 (전시 1편 = 전시명·작가명·개요·약력 4개) */
  total: number
  done: number
  missing: number
  stale: number
}

export type TranslateStatus = {
  /** 번역 키가 설정되어 있는지 */
  enabled: boolean
  provider: string
  /** 'Google Cloud Translation' 같은 표시용 이름 */
  providerLabel: string
  /** 번역 표가 만들어져 있는지 (backend/sql/translation.sql) */
  tableReady: boolean
  /** 표가 없을 때 안내 문구 */
  message: string
  targets: TranslateTargetStatus[]
}

export type TranslateRunResult = {
  target: TranslateTarget
  /** 이번 요청에서 처리한 항목 수 */
  processed: number
  done: number
  skipped: number
  failed: number
  /** 남은 것 + 원문 바뀐 것 */
  remaining: number
  samples: { ref: string; label: string; done: number; failed: number }[]
}

/** 번역 현황 (대상별 남은 수) */
export function fetchTranslateStatus() {
  return apiRequest<TranslateStatus>('/api/translate/status.php')
}

/**
 * 번역 실행 — 한 번에 `limit` 항목까지.
 *
 * 남은 것이 없어질 때까지 화면이 이 주소를 되풀이해 부릅니다.
 * (한 번에 다 하면 번역 서비스를 기다리는 시간이 길어져 요청이 끊깁니다)
 */
export function runTranslate(
  target: TranslateTarget,
  only: TranslateScope = 'missing',
  limit = 5,
  ref = '',
) {
  return apiRequest<TranslateRunResult>('/api/translate/run.php', {
    method: 'POST',
    body: { target, only, limit, ref },
  })
}
