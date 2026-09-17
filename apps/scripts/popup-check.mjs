#!/usr/bin/env node
/**
 * 팝업 API 연결 확인 — 서버에 파일이 올라갔고 응답 형식이 맞는지 봅니다.
 *
 *   node scripts/popup-check.mjs
 *
 * 자격증명은 apps/.env.test.local 을 씁니다. (공지 점검 스크립트와 같은 파일)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ENV_FILE = path.join(HERE, '..', '.env.test.local')

function loadEnv(file) {
  const map = {}
  if (!fs.existsSync(file)) return map

  for (const line of fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue

    map[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
  }

  return map
}

const fileEnv = loadEnv(ENV_FILE)
const env = (key, fallback = '') => process.env[key] ?? fileEnv[key] ?? fallback
const BASE = env('NOTICE_TEST_BASE', 'https://galleryiscom.mycafe24.com/backend').replace(/\/+$/, '')

async function call(pathname, options = {}) {
  const res = await fetch(`${BASE}${pathname}`, options)
  const text = await res.text()

  let parsed = null
  try {
    parsed = JSON.parse(text)
  } catch {
    // PHP 오류 등으로 HTML 이 올 수 있습니다.
  }

  return {
    status: res.status,
    success: parsed?.success,
    message: parsed?.message,
    data: parsed?.data,
    raw: text.slice(0, 200).replace(/\s+/g, ' '),
  }
}

function report(label, result, detail) {
  console.log(`[${result.status}] ${label}`)
  console.log(`      ${detail ?? ''}`)
  if (result.raw && !result.message) console.log(`      raw: ${result.raw}`)
  console.log('')
}

const loginRes = await call('/api/auth/login.php', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify({ id: env('NOTICE_TEST_ID'), password: env('NOTICE_TEST_PW') }),
})

const token = loginRes.data?.token

report('관리자 로그인', loginRes, token ? '토큰 발급됨' : (loginRes.message ?? ''))

const authHeaders = { Accept: 'application/json', Authorization: `Bearer ${token}` }

// 공개 엔드포인트 — 인증 없이 불러야 합니다.
const active = await call('/api/popups/active.php')
report(
  '공개 팝업 목록 (인증 없음)',
  active,
  `success=${active.success} / ${Array.isArray(active.data) ? `${active.data.length}건` : (active.message ?? '')}`,
)

// 관리자 엔드포인트
const list = await call('/api/popups/list.php?page=1&size=15', { headers: authHeaders })
report(
  '관리자 팝업 목록',
  list,
  list.data
    ? `총 ${list.data.totalCount}건 / ${list.data.totalPages}페이지`
    : (list.message ?? ''),
)

// 인증 가드 확인
const anon = await call('/api/popups/list.php?page=1')
console.log(`[${anon.status}] 토큰 없이 관리자 목록 호출 → ${anon.status === 401 ? '차단 OK' : '차단 실패!'}`)
