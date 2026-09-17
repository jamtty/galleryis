#!/usr/bin/env node
/**
 * 복사한 작품 이미지 파일명이 겹치지 않는지 확인합니다.
 *
 *   node scripts/exhibition-copy-name-check.mjs --yes [--source 2]
 *
 * ⚠ 실제 서버에 같은 전시를 **연속 2번** 복사하고, 확인 후 그 2건만 삭제합니다.
 *    - 파일명은 `시각_랜덤8_원래이름.ext` 규칙이라 같은 초에 복사해도 달라야 합니다.
 *    - 진행 상황은 stderr 로 찍어서 중간에 멈춰도 어디까지 됐는지 보이게 합니다.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ENV_FILE = path.join(HERE, '..', '.env.test.local')
const CONFIRM = process.argv.includes('--yes')

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

/** stderr 는 즉시 찍혀서 중간에 멈춰도 어디까지 됐는지 보입니다. */
function step(text) {
  process.stderr.write(`${text}\n`)
}

function optionValue(name) {
  const index = process.argv.indexOf(name)

  if (index < 0) return 0

  return Number(process.argv[index + 1] ?? 0) || 0
}

/** 한 번의 요청 (응답이 없으면 8초에 끊습니다) */
async function once(pathname, options) {
  const { method = 'GET', token, query, json } = options
  const url = new URL(`${BASE}${pathname}`)

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') continue
    url.searchParams.set(key, String(value))
  }

  const headers = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  let body
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(json)
  }

  const res = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(TIMEOUT_MS) })
  const text = await res.text()

  let parsed = null
  try {
    parsed = JSON.parse(text)
  } catch {
    // HTML 오류
  }

  return { status: res.status, data: parsed?.data, message: parsed?.message }
}

/** 멈추면 새 연결로 다시 시도합니다. */
async function request(pathname, options = {}, attempt = 0) {
  try {
    return await once(pathname, options)
  } catch (error) {
    if (attempt >= 2) throw error

    step(`      (재시도 ${attempt + 2}/3 — ${error instanceof Error ? error.message : error})`)

    return request(pathname, options, attempt + 1)
  }
}

/** 파일명만 뽑습니다. */
function names(detail) {
  return (detail?.files ?? []).map((file) => String(file.url).split('/').pop())
}

async function main() {
  if (!CONFIRM) {
    console.log('--yes 를 붙이면 전시 1건을 연속 2번 복사하고, 확인 후 삭제합니다.')
    return
  }

  step('[1] 로그인')

  const login = await request('/api/auth/login.php', {
    method: 'POST',
    json: { id: env('NOTICE_TEST_ID'), password: env('NOTICE_TEST_PW') },
  })

  const token = login.data?.token ?? ''

  if (!token) {
    console.log(`로그인 실패: ${login.status} ${login.message ?? ''}`)
    process.exitCode = 1
    return
  }

  const sourceId = optionValue('--source') || (await request('/api/exhibitions/list.php', { token, query: { page: 1, size: 1 } })).data?.items?.[0]?.id

  step(`[2] 원본 ${sourceId}번 조회`)

  const source = await request('/api/exhibitions/detail.php', { token, query: { id: sourceId } })
  const sourceNames = names(source.data)

  step(`      원본 파일 ${sourceNames.length}개`)

  step('[3] 연속 2번 복사 (같은 초에 만들어지도록)')

  const first = await request('/api/exhibitions/copy.php', { method: 'POST', token, json: { id: sourceId } })
  const second = await request('/api/exhibitions/copy.php', { method: 'POST', token, json: { id: sourceId } })

  const ids = [Number(first.data?.id ?? 0), Number(second.data?.id ?? 0)]

  step(`      복사본 id = ${ids.join(', ')}`)

  if (ids.some((id) => id <= 0)) {
    console.log(`복사 실패: ${first.message ?? ''} ${second.message ?? ''}`)
    process.exitCode = 1
    return
  }

  step('[4] 복사본 파일명 확인')

  const firstDetail = await request('/api/exhibitions/detail.php', { token, query: { id: ids[0] } })
  const secondDetail = await request('/api/exhibitions/detail.php', { token, query: { id: ids[1] } })

  const firstNames = names(firstDetail.data)
  const secondNames = names(secondDetail.data)
  const all = [...sourceNames, ...firstNames, ...secondNames]

  console.log(`\n원본  ${sourceId} : ${sourceNames.join(', ')}`)
  console.log(`복사1 ${ids[0]} : ${firstNames.join(', ')}`)
  console.log(`복사2 ${ids[1]} : ${secondNames.join(', ')}\n`)

  const duplicates = all.filter((name, index) => all.indexOf(name) !== index)
  const unique = new Set(all)

  console.log(`전체 ${all.length}개 / 서로 다른 파일명 ${unique.size}개`)
  console.log(duplicates.length === 0 ? '[OK] 파일명 중복 없음' : `[FAIL] 중복: ${[...new Set(duplicates)].join(', ')}`)

  step('[5] 복사본 정리')

  const removed = await request('/api/exhibitions/delete.php', { method: 'POST', token, json: { ids } })

  console.log(`\n정리 — 남은 복사본 ${removed.data?.deleted ?? 0}건 삭제 (이미지 ${removed.data?.files ?? 0}개)`)

  if (duplicates.length > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error('\n점검 중 오류:', error)
  process.exitCode = 1
})
