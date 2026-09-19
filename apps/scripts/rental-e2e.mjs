#!/usr/bin/env node
/**
 * 대관 신청 E2E 점검 — 공개 접수 API 를 실제로 호출합니다.
 *
 * 사용법
 *   1) apps/.env.test.local 에 관리자 계정을 적어 둡니다.
 *        NOTICE_TEST_ID=admin
 *        NOTICE_TEST_PW=.....
 *   2) apps 폴더에서 실행
 *        node scripts/rental-e2e.mjs --yes
 *
 * ⚠ --yes 없이 실행하면 계획만 출력하고 아무것도 만들지 않습니다.
 *
 * 안전장치
 *   - **이 실행에서 만든 신청 1건만** 지웁니다 (레거시 대관 기록은 건드리지 않습니다).
 *   - 중간에 오류가 나도 finally 에서 만든 신청을 정리합니다.
 *   - 이미 찬 칸은 조회만 하고 신청하지 않습니다 (409 확인용).
 *
 * 점검 항목
 *   1. 가용성(공개) — 빈 칸 하나와 이미 찬 칸 하나를 찾습니다
 *   2. 찬 칸으로 신청 → 409 (중복 차단, 아무것도 저장되지 않음)
 *   3. 원본 화면의 낱말 그대로(kind=degree · genre=western) 보내면 422
 *      → shared/backend.ts 의 매핑(thesis · 서양화)이 왜 필요한지 확인
 *   4. 어댑터가 만드는 모양으로 첨부 1장과 함께 신청 → 200
 *   5. 상세 조회 — 전시구분 · 장르 · 전시장 · 기간(7일) · 첨부가 저장된 모양
 *   6. 첨부 파일 실제 URL 접근(200) 확인
 *   7. 일정에 심사중으로 나타나는지
 *   8. 토큰 없이 삭제 차단(401)
 *   9. 삭제 → 일정에서 사라지고 그 칸이 다시 신청가능
 *
 * '전시구분' 낱말에 대해
 *   원본 화면은 solo · group · degree 를 보내고, 우리 백엔드(그리고 레거시
 *   g4_write_order)는 solo · group · thesis 를 씁니다. 이 스크립트의 [3] 이
 *   그 차이를, [4] 이후가 매핑된 결과를 확인합니다.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ENV_FILE = path.join(HERE, '..', '.env.test.local')
const CONFIRM = process.argv.includes('--yes')

/** .env.test.local 을 KEY=VALUE 로 읽습니다. */
function loadEnvFile(file) {
  const map = {}
  if (!fs.existsSync(file)) return map

  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue

    map[trimmed.slice(0, eq).trim()] = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, '')
  }

  return map
}

const fileEnv = loadEnvFile(ENV_FILE)
const env = (key, fallback = '') => process.env[key] ?? fileEnv[key] ?? fallback

const BASE = env('NOTICE_TEST_BASE', 'https://galleryiscom.mycafe24.com/backend').replace(/\/+$/, '')
const ADMIN_ID = env('NOTICE_TEST_ID')
const ADMIN_PW = env('NOTICE_TEST_PW')
const TIMEOUT_MS = 8000

/** 1x1 PNG — 포트폴리오 첨부 검증용 */
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
)

const results = []

function record(name, ok, detail = '') {
  results.push({ name, ok })
  console.log(`  [${ok ? 'OK  ' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`)
}

/** 실패해도 계속 진행하고 결과만 모읍니다. */
function check(name, condition, detail = '') {
  // 인자 순서를 바꿔 쓰면(조건, 이름) 판정이 늘 통과가 되어 버립니다 → 여기서 막습니다.
  if (typeof name !== 'string') {
    throw new Error(`check(이름, 조건, 설명) 순서가 아닙니다: ${String(name)}`)
  }

  record(name, Boolean(condition), detail)
  return Boolean(condition)
}

/** 진행 상황은 stderr 로 (중간에 멈춰도 어디까지 됐는지 보이게) */
function step(text) {
  process.stderr.write(`${text}\n`)
}

/** 한 번의 요청 — 응답이 없으면 8초에 끊습니다. */
async function once(pathname, options = {}) {
  const { method = 'GET', token, query, json, form } = options
  const url = new URL(`${BASE}${pathname}`)

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') continue
    url.searchParams.set(key, String(value))
  }

  const headers = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  let body
  if (form) {
    body = form
  } else if (json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(json)
  }

  const res = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(TIMEOUT_MS) })
  const text = await res.text()

  let parsed = null
  try {
    parsed = JSON.parse(text)
  } catch {
    // HTML 오류 페이지일 수 있습니다.
  }

  return {
    status: res.status,
    data: parsed?.data,
    message: parsed?.message,
    raw: text,
  }
}

/** 이 호스팅은 연속 요청에서 간간이 멈춥니다 → 새 연결로 다시 시도합니다. */
async function request(pathname, options = {}, attempt = 0) {
  try {
    return await once(pathname, options)
  } catch (error) {
    if (attempt >= 2) throw error

    step(`      (재시도 ${attempt + 2}/3 — ${error instanceof Error ? error.message : error})`)

    return request(pathname, options, attempt + 1)
  }
}

/* --------------------------------------------------------------------------
   신청서 만들기
   -------------------------------------------------------------------------- */

/**
 * 어댑터(shared/backend.ts) 가 백엔드로 보내는 모양 그대로.
 *
 * 화면은 `degree` · `western` 을 보내고 어댑터가 `thesis` · `서양화` 로 옮깁니다.
 * 여기서는 그 **옮긴 뒤** 값을 씁니다.
 */
function bookingPayload({ hallId, weekStart, kind = 'thesis', genre = '서양화' }) {
  return {
    hall_id: hallId,
    week_start: weekStart,
    applicant: {
      name: '[검증] 대관 E2E',
      email: 'rental-e2e@example.com',
      phone: '010-0000-0000',
      postcode: '03146',
      address1: '서울특별시 종로구 인사동길 52-1',
      address2: '3층',
    },
    exhibition: {
      kind,
      genre,
      genre_other: '',
      artist_count: undefined,
      work_count: 5,
      memo: '전시명 : [검증] E2E 전시\n작가명 : 검증 작가',
    },
    terms_version: '2026-08-17',
  }
}

function bookingForm(payload, files = []) {
  const form = new FormData()
  form.set('payload', JSON.stringify(payload))

  for (const file of files) {
    form.append(file.field, new Blob([file.bytes], { type: file.type }), file.name)
  }

  return form
}

/** 주 목록에서 조건에 맞는 칸 하나 (없으면 null) */
function firstCell(weeks, want) {
  for (const week of weeks) {
    for (const [hallId, cell] of Object.entries(week.halls ?? {})) {
      if (cell && want(cell.status)) {
        return { hallId, weekStart: week.start, weekEnd: week.end, status: cell.status }
      }
    }
  }

  return null
}

/** 날짜 차이(일) */
function daysBetween(from, to) {
  const a = new Date(`${from}T00:00:00`)
  const b = new Date(`${to}T00:00:00`)

  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

/** 일정에서 그 칸의 상태 */
async function cellStatus(hallId, weekStart) {
  const res = await request('/api/rentals/availability.php', { query: { page: 0 } })
  const week = (res.data?.weeks ?? []).find((w) => w.start === weekStart)

  return week?.halls?.[hallId]?.status ?? null
}

/* --------------------------------------------------------------------------
   점검
   -------------------------------------------------------------------------- */

async function main() {
  console.log(`\n대상 서버: ${BASE}`)
  console.log(`계정: ${ADMIN_ID || '(미설정)'}`)

  if (!ADMIN_ID || !ADMIN_PW) {
    console.log(`\n${ENV_FILE} 에 NOTICE_TEST_ID / NOTICE_TEST_PW 를 적어 주세요.`)
    process.exitCode = 1
    return
  }

  if (!CONFIRM) {
    console.log('\n--yes 가 없어서 아무것도 실행하지 않았습니다.')
    console.log('실행하면 대관 신청 1건을 만들어 확인하고, 끝나면 그 건만 삭제합니다.')
    console.log('(이미 찬 칸은 조회만 하고, 중복 차단 409 만 확인합니다)')
    return
  }

  let token = ''
  let createdId = 0

  try {
    step('[1] 가용성 (공개)')

    console.log('\n[1] 가용성 (공개)')

    const avail = await request('/api/rentals/availability.php', { query: { page: 0 } })
    const weeks = avail.data?.weeks ?? []

    check('일정 조회', avail.status === 200 && weeks.length > 0, `주 ${weeks.length}개`)

    const free = firstCell(weeks, (status) => status === 'available')
    const taken = firstCell(weeks, (status) => status !== 'available')

    check('신청가능한 칸을 찾음', Boolean(free), free ? `${free.weekStart} ${free.hallId}` : '')
    check('이미 찬 칸을 찾음', Boolean(taken), taken ? `${taken.weekStart} ${taken.hallId} (${taken.status})` : '')

    if (!free) {
      console.log('\n빈 칸이 없어 여기서 멈춥니다 (대관 일정이 모두 찬 상태).')
      process.exitCode = 1
      return
    }

    step('[2] 로그인')

    console.log('\n[2] 로그인')

    const login = await request('/api/auth/login.php', {
      method: 'POST',
      json: { id: ADMIN_ID, password: ADMIN_PW },
    })

    token = login.data?.token ?? ''

    // 토큰 자체는 찍지 않습니다 (터미널·로그에 남지 않게).
    if (!check('관리자 로그인', Boolean(token), `만료 ${login.data?.expiresAt ?? '-'}`)) {
      process.exitCode = 1
      return
    }

    console.log('\n[3] 중복 차단 (409)')

    if (taken) {
      const dup = await request('/api/rentals/bookings.php', {
        method: 'POST',
        form: bookingForm(bookingPayload({ hallId: taken.hallId, weekStart: taken.weekStart })),
      })

      check(
        '이미 찬 칸 신청은 409 로 막힘',
        dup.status === 409,
        `status=${dup.status} ${dup.message ?? ''}`,
      )
    } else {
      record('이미 찬 칸 신청은 409 로 막힘', true, '찬 칸이 없어 건너뜀')
    }

    console.log('\n[4] 원본 낱말 그대로 (매핑 없이)')

    const raw = await request('/api/rentals/bookings.php', {
      method: 'POST',
      form: bookingForm(
        bookingPayload({ hallId: free.hallId, weekStart: free.weekStart, kind: 'degree', genre: 'western' }),
      ),
    })

    check(
      'kind=degree 로 보내면 422 (매핑이 필요했던 이유)',
      raw.status === 422,
      `status=${raw.status} ${raw.message ?? ''}`,
    )

    console.log('\n[5] 어댑터 모양으로 신청 (첨부 1장)')

    const created = await request('/api/rentals/bookings.php', {
      method: 'POST',
      form: bookingForm(bookingPayload({ hallId: free.hallId, weekStart: free.weekStart }), [
        { field: 'portfolio[]', bytes: PNG_BYTES, type: 'image/png', name: 'e2e-portfolio.png' },
      ]),
    })

    createdId = Number(created.data?.id ?? 0)

    check(
      '신청 접수 (thesis · 서양화)',
      created.status === 200 && createdId > 0,
      `status=${created.status} id=${createdId} ${created.message ?? ''}`,
    )

    if (!createdId) {
      process.exitCode = 1
      return
    }

    console.log('\n[6] 저장된 모양 확인')

    const detail = await request('/api/rentals/detail.php', { token, query: { id: createdId } })
    const data = detail.data

    check('상세 조회', detail.status === 200 && Boolean(data), `status=${detail.status}`)

    if (data) {
      check('전시장이 그대로 저장됨', data.hallId === free.hallId, `${data.hallId} (${data.hall})`)

      check(
        '전시구분이 레거시 낱말로 저장됨',
        data.exhibition?.kind === 'thesis' && data.exhibition?.kind_label === '석·박사 청구전',
        `${data.exhibition?.kind} / ${data.exhibition?.kind_label}`,
      )

      check(
        '장르가 한글 낱말로 저장됨',
        data.exhibition?.genre === '서양화',
        `wr_2 = ${JSON.stringify(data.exhibition?.genre)}`,
      )

      check('작품 수 저장', data.exhibition?.work_count === 5, String(data.exhibition?.work_count))

      check(
        '기간(수~화 7일) 이 그대로 저장됨',
        data.weekStart === free.weekStart && daysBetween(data.weekStart, data.weekEnd) === 6,
        `${data.weekStart} ~ ${data.weekEnd}`,
      )

      check(
        '전시명·작가명이 메모에 남음',
        (data.exhibition?.memo ?? '').includes('전시명'),
        JSON.stringify((data.exhibition?.memo ?? '').split('\n')[0]),
      )

      check(
        '포트폴리오 1장이 포트폴리오로 저장됨',
        (data.files?.portfolio ?? []).length === 1 && (data.files?.bio ?? []).length === 0,
        `portfolio=${(data.files?.portfolio ?? []).length} bio=${(data.files?.bio ?? []).length}`,
      )

      const fileUrl = data.files?.portfolio?.[0]?.url ?? ''
      check('첨부 주소가 만들어짐', Boolean(fileUrl), fileUrl)

      console.log('\n[7] 첨부 파일 URL')

      if (fileUrl) {
        const head = await fetch(fileUrl, { method: 'HEAD', signal: AbortSignal.timeout(TIMEOUT_MS) })
        check('첨부 URL 이 200 으로 열림', head.status === 200, `${head.status} ${head.headers.get('content-type') ?? ''}`)
      }
    }

    console.log('\n[8] 일정 반영')

    const afterCreate = await cellStatus(free.hallId, free.weekStart)
    check('신청한 칸이 심사중으로 바뀜', afterCreate === 'pending', String(afterCreate))

    console.log('\n[9] 인증 차단')

    const anon = await request('/api/rentals/delete.php', { method: 'POST', json: { ids: [createdId] } })
    check('토큰 없이 삭제 차단(401)', anon.status === 401, `status=${anon.status}`)

    console.log('\n[10] 삭제 (정리)')

    const removed = await request('/api/rentals/delete.php', {
      method: 'POST',
      token,
      json: { ids: [createdId] },
    })

    check(
      '만든 신청을 지움',
      removed.status === 200 && removed.data?.deleted === 1,
      `deleted=${removed.data?.deleted} files=${removed.data?.files}`,
    )

    if (removed.status === 200 && removed.data?.deleted === 1) {
      createdId = 0
    }

    const afterDelete = await cellStatus(free.hallId, free.weekStart)
    check('그 칸이 다시 신청가능', afterDelete === 'available', String(afterDelete))
  } finally {
    // 중간에 오류가 났어도 이 실행에서 만든 신청은 지웁니다.
    if (createdId && token) {
      step(`\n[정리] 신청 ${createdId} 을 지웁니다`)

      const cleanup = await request('/api/rentals/delete.php', {
        method: 'POST',
        token,
        json: { ids: [createdId] },
      }).catch(() => null)

      record(
        '오류 정리 — 만든 신청 삭제',
        cleanup?.data?.deleted === 1,
        cleanup ? `deleted=${cleanup.data?.deleted}` : '삭제 실패 — 관리자 화면에서 확인하세요',
      )
    } else if (createdId) {
      record('오류 정리 — 만든 신청 삭제', false, `신청 ${createdId} 이 남아 있습니다 (로그인 실패)`)
    }  }

  const failed = results.filter((item) => !item.ok).length

  console.log(`\n${failed === 0 ? '[OK] 대관 신청 E2E 통과' : `[FAIL] 실패 ${failed}건`}`)

  if (failed > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error(`\n중단: ${error instanceof Error ? error.message : error}`)
  process.exitCode = 1
})
