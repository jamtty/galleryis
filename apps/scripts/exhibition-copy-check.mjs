#!/usr/bin/env node
/**
 * 전시 복사 기능 점검.
 *
 *   node scripts/exhibition-copy-check.mjs --yes
 *   node scripts/exhibition-copy-check.mjs --yes --source 2   (원본 전시 지정)
 *   node scripts/exhibition-copy-check.mjs --yes --cleanup 3  (해당 전시 삭제 — 점검 잔여물 정리)
 *
 * ⚠ 실제 서버(운영 DB)에 전시 1건을 복사하고, 확인이 끝나면 그 복사본만 삭제합니다.
 *    - 복사본은 미사용(비노출)이라 공개 사이트에 뜨지 않습니다.
 *    - 마지막에 '원본 이미지가 그대로 남아 있는지'를 확인합니다.
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

const results = []

/** 응답이 없을 때 멈추지 않도록 8초 제한을 둡니다. */
const TIMEOUT_MS = 8000

/** --source <id> · --cleanup <id> */
function optionValue(name) {
  const index = process.argv.indexOf(name)

  if (index < 0) return 0

  return Number(process.argv[index + 1] ?? 0) || 0
}

function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok) })
  console.log(`  [${ok ? 'OK  ' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`)
}

/** 한 번의 요청 (응답이 없으면 TIMEOUT_MS 에 끊습니다) */
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

  return { status: res.status, data: parsed?.data, message: parsed?.message, raw: text.slice(0, 200) }
}

/**
 * 요청 — 이 호스팅에서는 응답이 멈추는 경우가 있어
 * 시간이 지나면 새 연결로 다시 시도합니다.
 */
async function request(pathname, options = {}, attempt = 0) {
  try {
    return await once(pathname, options)
  } catch (error) {
    if (attempt >= 2) throw error

    return request(pathname, options, attempt + 1)
  }
}

/**
 * 이미지가 실제로 이미지로 응답하는지.
 *
 * 큰 사진을 받으면 느리므로 HEAD 로 상태·형식만 봅니다.
 * (확인 실패는 false 로 돌려주고 스크립트는 계속 진행합니다)
 */
async function imageOk(url) {
  if (!url) return false

  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    return res.status === 200 && (res.headers.get('content-type') ?? '').includes('image')
  } catch {
    return false
  }
}

async function main() {
  if (!CONFIRM) {
    console.log('--yes 를 붙이면 전시 1건을 복사하고, 확인 후 복사본만 삭제합니다.')
    return
  }

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

  console.log(`\n대상: ${BASE}\n`)

  const cleanupId = optionValue('--cleanup')

  // 정리 모드 — 점검로 만들어진 전시를 지우고 끝냅니다.
  if (cleanupId > 0) {
    const removed = await request('/api/exhibitions/delete.php', { method: 'POST', token, json: { ids: [cleanupId] } })

    console.log(`\n[정리] ${cleanupId}번 삭제 — ${removed.status === 200 ? `OK (이미지 ${removed.data?.files ?? 0}개)` : (removed.message ?? '실패')}`)

    return
  }

  // 원본 — 지정된 번호가 있으면 그것, 없으면 (복사) 가 아닌 최신 전시
  const sourceId = optionValue('--source')
  const list = await request('/api/exhibitions/list.php', { token, query: { page: 1, size: 50 } })
  const items = list.data?.items ?? []
  const source = sourceId > 0
    ? items.find((item) => item.id === sourceId)
    : items.find((item) => !String(item.title).endsWith(' (복사)'))

  if (!source) {
    console.log('복사할 전시가 없습니다.')
    return
  }

  const leftovers = items.filter((item) => String(item.title).endsWith(' (복사)'))

  if (leftovers.length > 0) {
    console.log(`[참고] (복사) 로 끝나는 전시 ${leftovers.length}건 — ${leftovers.map((item) => item.id).join(', ')}`)
    console.log('       지우려면: node scripts/exhibition-copy-check.mjs --yes --cleanup <id>\n')
  }

  console.log(`[1] 원본 — id=${source.id} ${source.title}`)

  const before = await request('/api/exhibitions/detail.php', { token, query: { id: source.id } })
  const sourceImages = (before.data?.files ?? []).map((file) => file.url)

  console.log(`      작품 이미지 ${sourceImages.length}장\n`)

  console.log('[2] 복사')

  const copied = await request('/api/exhibitions/copy.php', { method: 'POST', token, json: { id: source.id } })
  const copyId = Number(copied.data?.id ?? 0)

  if (!check('복사 요청', copyId > 0, copied.data ? `새 전시 id=${copyId}` : (copied.message ?? ''))) return

  const after = await request('/api/exhibitions/detail.php', { token, query: { id: copyId } })
  const copy = after.data ?? {}
  const copyImages = (copy.files ?? []).map((file) => file.url)

  console.log('\n[3] 복사본 확인')
  check('제목에 (복사) 붙음', String(copy.title ?? '').endsWith(' (복사)'), copy.title ?? '')
  check('미사용(비노출) 상태', copy.useYn === 'N', `useYn=${copy.useYn}`)
  check('전시장소·작가명 동일', copy.place === before.data?.place && copy.artist === before.data?.artist)
  check('전시기간 동일', copy.startDate === before.data?.startDate && copy.endDate === before.data?.endDate)
  check('개요·약력 동일', copy.overview === before.data?.overview && copy.bio === before.data?.bio, `개요 ${String(copy.overview ?? '').length}자`)
  check('작품 이미지 수 동일', copyImages.length === sourceImages.length, `${sourceImages.length} → ${copyImages.length}`)
  check('이미지가 서로 다른 파일', copyImages.every((url) => !sourceImages.includes(url)))
  check('복사된 이미지 접근 OK', await imageOk(copyImages[0]), copyImages[0]?.split('/').pop() ?? '')

  const publicList = await request('/api/exhibitions/public_list.php', { query: { status: 'current', size: 48 } })
  check('공개 목록에는 안 나옴', !(publicList.data?.items ?? []).some((item) => item.id === copyId))

  console.log('\n[4] 복사본 삭제 후 원본 보존 확인')

  const removed = await request('/api/exhibitions/delete.php', { method: 'POST', token, json: { ids: [copyId] } })
  check('복사본 삭제', removed.status === 200, `deleted=${removed.data?.deleted ?? '-'} files=${removed.data?.files ?? '-'}`)

  check('원본 이미지 그대로 접근 OK', await imageOk(sourceImages[0]), sourceImages[0]?.split('/').pop() ?? '')
  check('복사된 이미지 파일 정리됨', !(await imageOk(copyImages[0])))

  const gone = await request('/api/exhibitions/detail.php', { token, query: { id: copyId } })
  check('복사본 조회 불가(404)', gone.status === 404)

  const failed = results.filter((item) => !item.ok)
  console.log(`\n=== 결과: 총 ${results.length}건 / 성공 ${results.length - failed.length} / 실패 ${failed.length} ===`)

  if (failed.length > 0) {
    for (const item of failed) console.log(`  - 실패: ${item.name}`)
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error('\n점검 중 오류:', error)
  process.exitCode = 1
})
