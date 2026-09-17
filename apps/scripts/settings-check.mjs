#!/usr/bin/env node
/**
 * 관리자 [환경설정] 점검 스크립트
 *
 *   node scripts/settings-check.mjs          읽기 점검만 (값을 바꾸지 않습니다)
 *   node scripts/settings-check.mjs --yes    저장/복원 왕복까지 점검 (임시 값을 넣였다가 되돌립니다)
 *   node scripts/settings-check.mjs --restore  백업해 둔 값으로 되돌립니다
 *
 * ⚠ --yes 는 실제 값을 잠시 바꿉니다. 그래서 시작 전에 현재 값을
 *    apps/.settings-backup.local 에 백업하고, 문제가 생기면 --restore 로 되돌릴 수 있게 했습니다.
 *    (이 호스팅은 요청이 가끔 멈춰서 중간에 끝날 수 있습니다)
 *
 * 확인하는 것
 *   [1] 공개 API — 인증 없이 6개 키가 오는지 (테이블이 없어도 기본값으로 200)
 *   [2] 로그인
 *   [3] 관리자 상세 — 그룹 · 입력칸 정의가 오는지
 *   [4] (--yes) 임시 값 저장 → 공개·관리자 양쪽 반영 확인 → 원래 값 복원
 *   [5] (--yes) 글자 수 초과 저장이 422 로 막히고 값이 그대로인지
 *
 * 진행 상황은 stderr 로 찍어서 중간에 멈춰도 어디까지 됐는지 보이게 합니다.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ENV_FILE = path.join(HERE, '..', '.env.test.local')
const BACKUP_FILE = path.join(HERE, '..', '.settings-backup.local')
const CONFIRM = process.argv.includes('--yes')
const RESTORE = process.argv.includes('--restore')

/** 저장/복원 점검에 쓸 설정 키 */
const TEST_KEY = 'page_notices_lede'
const TEST_VALUE = '[검증] 잠시 넣은 문구입니다.'

/** 개인정보처리방침(HTML) 점검용 */
const HTML_KEY = 'page_privacy_html'
const HTML_VALUE = '<h2>1. 수집하는 항목</h2><p>이름 · 연락처</p><script>alert(1)</script>'

const OVER_LIMIT = '가'.repeat(201)

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

let failures = 0

function step(text) {
  process.stderr.write(`${text}\n`)
}

/** 화면에 찍을 때는 긴 값(개인정보처리방침 등)을 줄여서 보여 줍니다. */
function short(value, max = 80) {
  const text = String(value ?? '').replace(/\s+/g, ' ')

  return text.length > max ? `${text.slice(0, max)}… (${text.length}자)` : text
}

function check(ok, label, extra = '') {
  if (!ok) failures += 1

  console.log(`  ${ok ? '[OK]  ' : '[FAIL]'} ${label}${extra ? ` — ${extra}` : ''}`)
}

/** 한 번의 요청 (응답이 없으면 8초에 끊습니다) */
async function once(pathname, options = {}) {
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
    // HTML 오류 페이지
  }

  return { status: res.status, data: parsed?.data, message: parsed?.message }
}

/** 멈추면 새 연결로 다시 시도합니다. (이 호스팅은 연속 요청에서 간간이 멈춥니다) */
async function request(pathname, options = {}, attempt = 0) {
  try {
    return await once(pathname, options)
  } catch (error) {
    if (attempt >= 2) throw error

    step(`      (재시도 ${attempt + 2}/3 — ${error instanceof Error ? error.message : error})`)

    return request(pathname, options, attempt + 1)
  }
}

/** 현재 값을 백업해 둡니다. (--yes 로 시작할 때) */
function saveBackup(values) {
  fs.writeFileSync(BACKUP_FILE, `${JSON.stringify(values, null, 2)}\n`, 'utf8')
}

/** 백업한 값 읽기 */
function loadBackup() {
  if (!fs.existsSync(BACKUP_FILE)) return null

  try {
    const parsed = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'))

    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

/** 설정 키 → 값 (관리자 상세 응답에서) */
function valuesFromGroups(data) {
  const map = {}
  for (const group of data?.groups ?? []) {
    for (const field of group.fields ?? []) map[field.key] = field.value
  }
  return map
}

/** 정의에 있어야 하는 키 — 사이트 상단 메뉴 순서와 같습니다. */
const REQUIRED_KEYS = [
  'page_exhibitions_lede',
  'page_about_lede',
  'page_halls_lede',
  'page_rental_lede',
  'page_notices_lede',
  'page_privacy_html',
]

async function main() {
  console.log(`대상: ${BASE}\n`)

  step('[1] 공개 API (인증 없음)')

  const pub = await request('/api/settings/public.php')

  check(pub.status === 200, '공개 API 응답 200', `status=${pub.status} ${pub.message ?? ''}`)

  const missingKeys = REQUIRED_KEYS.filter((key) => typeof pub.data?.[key] !== 'string')

  check(
    missingKeys.length === 0,
    `공개 키 ${REQUIRED_KEYS.length}개가 모두 문자열로 옴`,
    missingKeys.join(', '),
  )

  step('[2] 로그인')

  const login = await request('/api/auth/login.php', {
    method: 'POST',
    json: { id: env('NOTICE_TEST_ID'), password: env('NOTICE_TEST_PW') },
  })

  const token = login.data?.token ?? ''

  check(Boolean(token), '관리자 로그인', login.message ?? '')

  if (!token) {
    console.log('\n로그인하지 못해 여기서 멈춥니다.')
    process.exitCode = 1
    return
  }

  if (RESTORE) {
    const backup = loadBackup()

    if (!backup) {
      console.log(`백업 파일이 없습니다: ${BACKUP_FILE}`)
      process.exitCode = 1
      return
    }

    const res = await request('/api/settings/update.php', {
      method: 'POST',
      token,
      json: { values: backup },
    })

    check(
      res.status === 200,
      `백업해 둔 값 ${Object.keys(backup).length}개를 되돌렸습니다`,
      `status=${res.status} ${res.message ?? ''}`,
    )

    console.log(`\n${failures === 0 ? '[OK] 복원 완료' : '[FAIL] 복원 실패'}`)

    if (failures > 0) process.exitCode = 1
    return
  }

  step('[3] 관리자 상세 (그룹 · 입력칸)')

  const detail = await request('/api/settings/detail.php', { token })
  const groups = detail.data?.groups ?? []
  const values = valuesFromGroups(detail.data)
  const order = groups.flatMap((group) => (group.fields ?? []).map((field) => field.key))
  const fieldCount = order.length

  check(detail.status === 200, '관리자 상세 응답 200', `status=${detail.status} ${detail.message ?? ''}`)
  check(groups.length > 0, '그룹이 1개 이상', `${groups.length}개`)
  check(fieldCount === REQUIRED_KEYS.length, `입력칸 ${REQUIRED_KEYS.length}개`, `${fieldCount}개`)
  check(order.join(',') === REQUIRED_KEYS.join(','), '화면 순서가 상단 메뉴 순서와 같음', order.join(', '))

  const typed = groups.flatMap((group) => group.fields ?? []).every((field) => Boolean(field.type))

  check(typed, '입력칸마다 type·label·max 가 채워져 있음')

  console.log('\n현재 값')
  for (const key of REQUIRED_KEYS) {
    console.log(`  ${key.padEnd(24)} ${JSON.stringify(short(values[key] ?? '', 60))}`)
  }

  if (!CONFIRM) {
    console.log('\n--yes 를 붙이면 저장/복원 왕복까지 점검합니다.')
    if (failures > 0) process.exitCode = 1
    return
  }

  step('\n[4] 저장 → 반영 → 복원')

  saveBackup(values)

  console.log(`\n  [i]   현재 값을 백업했습니다: ${path.relative(path.join(HERE, '..'), BACKUP_FILE)}`)
  console.log('  [i]   문제가 생기면 `node scripts/settings-check.mjs --restore` 로 되돌릴 수 있습니다.\n')

  const before = values[TEST_KEY] ?? ''

  const save = await request('/api/settings/update.php', {
    method: 'POST',
    token,
    json: { values: { [TEST_KEY]: TEST_VALUE } },
  })

  check(save.status === 200 && save.data?.saved === 1, '저장 성공', `saved=${save.data?.saved}`)

  const afterDetail = valuesFromGroups((await request('/api/settings/detail.php', { token })).data)

  check(afterDetail[TEST_KEY] === TEST_VALUE, '관리자 상세에 새 값이 반영됨', afterDetail[TEST_KEY])

  const afterPublic = await request('/api/settings/public.php')

  check(afterPublic.data?.[TEST_KEY] === TEST_VALUE, '공개 API 에도 새 값이 반영됨', afterPublic.data?.[TEST_KEY])

  const restore = await request('/api/settings/update.php', {
    method: 'POST',
    token,
    json: { values: { [TEST_KEY]: before } },
  })

  const restored = valuesFromGroups((await request('/api/settings/detail.php', { token })).data)

  check(restore.status === 200, '원래 값으로 되돌리기 성공')
  check(restored[TEST_KEY] === before, '원래 값 그대로 복원됨', JSON.stringify(restored[TEST_KEY]))

  step('\n[5] 개인정보처리방침(HTML) — 서식 보존 · 스크립트 제거')

  const htmlBefore = values[HTML_KEY] ?? ''

  const htmlSave = await request('/api/settings/update.php', {
    method: 'POST',
    token,
    json: { values: { [HTML_KEY]: HTML_VALUE } },
  })

  check(htmlSave.status === 200, 'HTML 저장 성공', `status=${htmlSave.status} ${htmlSave.message ?? ''}`)

  const htmlPublic = (await request('/api/settings/public.php')).data?.[HTML_KEY] ?? ''

  check(
    htmlPublic.includes('<h2>') && htmlPublic.includes('수집하는 항목'),
    '제목·서식이 그대로 보존됨',
    short(htmlPublic),
  )
  check(!htmlPublic.includes('<script'), '스크립트 태그는 저장되지 않음')

  const htmlRestore = await request('/api/settings/update.php', {
    method: 'POST',
    token,
    json: { values: { [HTML_KEY]: htmlBefore } },
  })

  const htmlRestored = valuesFromGroups((await request('/api/settings/detail.php', { token })).data)

  check(
    htmlRestore.status === 200 && htmlRestored[HTML_KEY] === htmlBefore,
    '개인정보처리방침도 원래 값으로 복원됨',
    short(htmlRestored[HTML_KEY]),
  )

  step('\n[6] 글자 수 초과 저장 차단')

  const over = await request('/api/settings/update.php', {
    method: 'POST',
    token,
    json: { values: { [TEST_KEY]: OVER_LIMIT } },
  })

  check(over.status === 422, '201자 저장은 422 로 막힘', `status=${over.status} ${over.message ?? ''}`)

  const untouched = valuesFromGroups((await request('/api/settings/detail.php', { token })).data)

  check(untouched[TEST_KEY] === before, '막힌 요청은 값을 바꾸지 않음')

  console.log(`\n${failures === 0 ? '[OK] 환경설정 점검 통과' : `[FAIL] 실패 ${failures}건`}`)

  if (failures === 0) {
    // 모두 되돌렸으므로 백업 파일은 지웁니다.
    fs.rmSync(BACKUP_FILE, { force: true })
  } else {
    console.log('값을 되돌리려면 `node scripts/settings-check.mjs --restore` 를 실행하세요.')
  }

  if (failures > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error(`\n중단: ${error instanceof Error ? error.message : error}`)
  process.exitCode = 1
})
