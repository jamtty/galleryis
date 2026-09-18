#!/usr/bin/env node
/**
 * 전시장 API·자료 확인
 *
 *   node scripts/hall-check.mjs
 *
 * 확인하는 것
 *   ① 공개 목록(public_list.php) — 노출 중인 전시장과 사진 수
 *   ② 사진 파일 — 도면(sheetUrl)·첫 사진 URL 을 HEAD 로 확인 (uploads/hall/ 에 올라갔는지)
 *   ③ 관리자 목록·상세 — 로그인 필요 (apps/.env.test.local)
 *
 * ⚠ backend/sql/hall.sql 을 아직 실행하지 않았다면 ①이 0건으로 나옵니다. (정상)
 * ⚠ 사진 파일은 SFTP `uploads` 프로필로 올려야 합니다. (자동 업로드 아님)
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
const TIMEOUT_MS = 8000

function step(text) {
  process.stderr.write(`${text}\n`)
}

/** 한 번의 요청 (응답이 없으면 8초에 끊습니다) */
async function once(pathname, options = {}) {
  const { method = 'GET', token, query, form, json, url } = options
  const target = url ?? new URL(`${BASE}${pathname}`)

  if (!url) {
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value === undefined || value === null || value === '') continue
      target.searchParams.set(key, String(value))
    }
  }

  const headers = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  let body = form
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(json)
  }

  const res = await fetch(target, {
    method,
    headers,
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })

  const text = await res.text()

  let parsed = null
  try {
    parsed = JSON.parse(text)
  } catch {
    // HTML 오류
  }

  return { status: res.status, data: parsed?.data, message: parsed?.message, raw: text.slice(0, 200) }
}

/** 이 호스팅은 한 프로세스가 요청을 연속으로 보내면 멈출 때가 있어 새 연결로 재시도합니다. */
async function request(pathname, options = {}, attempt = 0) {
  try {
    return await once(pathname, options)
  } catch (error) {
    if (attempt >= 2) throw error

    step(`   (재시도 ${attempt + 2}/3 — ${error instanceof Error ? error.message : error})`)

    return request(pathname, options, attempt + 1)
  }
}

/** 파일이 실제로 있는지 (HEAD) */
async function head(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(TIMEOUT_MS) })

    return { ok: res.ok, status: res.status, type: res.headers.get('content-type') ?? '' }
  } catch (error) {
    return { ok: false, status: 0, type: error instanceof Error ? error.message : String(error) }
  }
}

const money = (value) => (value > 0 ? `₩ ${Number(value).toLocaleString('ko-KR')}` : '-')

/* -------------------------------------------------------------------------- */

step('[1] 공개 목록')

const publicList = await request('/api/halls/public_list.php')

if (!publicList.data) {
  console.log(`공개 목록 실패 — HTTP ${publicList.status} ${publicList.message ?? publicList.raw}`)
  process.exit(1)
}

const halls = publicList.data.items ?? []

console.log(`노출 중인 전시장 ${halls.length}개`)
console.log('')

for (const hall of halls) {
  console.log(`   ${hall.key} · ${hall.floor} · ${hall.name}`)
  console.log(`      규모  ${hall.spec}`)
  console.log(`      평수기 ${money(hall.pricePeak)} (${hall.monthPeak}) / 비수기 ${money(hall.priceOff)} (${hall.monthOff}) / 성수기 ${money(hall.priceHigh)} (${hall.monthHigh})`)
  console.log(`      안내  ${hall.priceNote}`)
  console.log(`      도면  ${hall.sheetUrl || '없음'} ${hall.planUrl ? `· 내려받기 ${hall.planUrl}` : ''}`)
  console.log(`      사진  ${hall.photos.length}장`)
}

if (halls.length === 0) {
  console.log('   (0건 — backend/sql/hall.sql 을 실행했는지, 노출이 Y 인지 확인하세요)')
}

/* -------------------------------------------------------------------------- */

if (halls.length > 0) {
  step('[2] 사진 파일 확인 (HEAD)')

  const first = halls[0]

  for (const [label, url] of [
    ['도면·조감도', first.sheetUrl],
    ['도면(내려받기)', first.planUrl],
    ['첫 사진', first.photos[0]?.url ?? ''],
  ]) {
    if (!url) {
      console.log(`   ${label} — 주소 없음`)
      continue
    }

    const res = await head(url)

    console.log(`   ${label} — HTTP ${res.status} ${res.type} · ${url}`)
  }
}

/* -------------------------------------------------------------------------- */

step('[3] 관리자 목록·상세')

const login = await request('/api/auth/login.php', {
  method: 'POST',
  json: { id: env('NOTICE_TEST_ID'), password: env('NOTICE_TEST_PW') },
})

const token = login.data?.token ?? ''

if (!token) {
  console.log(`   로그인 실패 — HTTP ${login.status} ${login.message ?? ''}`)
} else {
  const list = await request('/api/halls/list.php', { token })

  if (!list.data) {
    console.log(`   관리자 목록 실패 — HTTP ${list.status} ${list.message ?? list.raw}`)
  } else {
    const items = list.data.items ?? []

    console.log(`   관리자 목록 ${items.length}개`)

    for (const hall of items) {
      console.log(
        `      #${hall.id} ${hall.key} · ${hall.name} · ${hall.floor} · 사진 ${hall.photos.length}장 · 노출 ${hall.useYn}`,
      )
    }

    const firstId = items[0]?.id

    if (firstId) {
      const detail = await request('/api/halls/detail.php', { token, query: { id: firstId } })

      console.log(
        `   상세 #${firstId} — HTTP ${detail.status} ` +
          (detail.data ? `${detail.data.name} · 사진 ${detail.data.photos.length}장` : detail.message ?? detail.raw),
      )
    }
  }
}

/* -------------------------------------------------------------------------- */

step('[4] 나머지 엔드포인트 (파싱 확인)')

// detail.php · update.php 는 목록이 비어 있어도 파일이 살아 있는지 봅니다.
const detailProbe = await request('/api/halls/detail.php', { token, query: { id: 1 } })
const updateProbe = await request('/api/halls/update.php', { method: 'POST', token })

for (const [label, res] of [
  ['detail.php', detailProbe],
  ['update.php', updateProbe],
]) {
  // JSON 이 돌아오면 정상(안내·검증 메시지) · HTML 이나 빈 응답이면 문법 오류를 의심합니다.
  const shape = res.data || res.message ? 'JSON' : `비정상 응답 (${res.raw.slice(0, 60) || '빈 본문'})`

  console.log(`   ${label} → HTTP ${res.status} ${shape} ${res.message ?? ''}`)
}

console.log('')
console.log('전시장 API 확인 끝.')
console.log('   · 0건이면 phpMyAdmin 에서 backend/sql/hall.sql 을 실행하세요.')
console.log('   · 사진 HTTP 404 면 SFTP `uploads` 프로필로 uploads/hall/ 을 올려야 합니다.')