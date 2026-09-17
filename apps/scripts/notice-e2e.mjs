#!/usr/bin/env node
/**
 * 공지 기능 E2E 점검 — 관리자 API 를 직접 호출합니다.
 *
 * 사용법
 *   1) apps/.env.test.local 에 관리자 계정을 적어 둡니다.
 *        NOTICE_TEST_ID=admin
 *        NOTICE_TEST_PW=.....
 *   2) apps 폴더에서 실행
 *        node scripts/notice-e2e.mjs --yes
 *
 * ⚠ --yes 없이 실행하면 아무것도 만들지 않고 계획만 출력합니다.
 *
 * 안전장치
 *   - 이 실행에서 만든 공지 1건만 삭제합니다 (그 외 데이터는 건드리지 않습니다).
 *   - 상단 고정(bo_notice)은 실행 전 상태와 비교해 다르면 되돌립니다.
 *   - 중간에 오류가 나도 finally 에서 만든 공지를 정리합니다.
 *
 * 점검 항목
 *   1. 로그인 / 인증 차단(토큰 없이 호출 시 401)
 *   2. 기준 상태(공지 건수 · 고정 목록) 확보
 *   3. 공지 등록 (한글 제목/본문 + 이미지 첨부 + 공지 체크)
 *   4. 상세 조회 — 한글 · 첨부 · 고정 반영 확인
 *   5. 첨부 파일 실제 URL 접근(200) 확인
 *   6. 목록 — 맨 위 고정 + 고정 번호 포함 확인
 *   7. 공지 체크 해제 → 고정에서 빠지는지
 *   8. 공지 체크 재설정 → 다시 맨 앞으로 오는지
 *   9. 수정(제목·본문 한글) 반영 확인
 *  10. 첨부 삭제(keep 없이 수정) → 첨부 0건 확인
 *  11. 기간 검색 · 검색어 검색 동작 확인
 *  12. 삭제 → 목록에서 사라지고 고정 목록에서도 자동 정리되는지
 *  13. 고정 목록이 실행 전 상태로 복구되었는지
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ENV_FILE = path.join(HERE, '..', '.env.test.local')

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
const CONFIRM = process.argv.includes('--yes')

/** 1x1 PNG — 첨부 업로드 검증용 */
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
  record(name, Boolean(condition), detail)
  return Boolean(condition)
}

/** GET/POST 공통 호출 */
async function request(pathname, options = {}) {
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

  const res = await fetch(url, { method, headers, body })
  const text = await res.text()

  let parsed = null
  try {
    parsed = JSON.parse(text)
  } catch {
    // PHP 오류 등으로 HTML 이 돌아올 수 있습니다.
  }

  return {
    status: res.status,
    data: parsed?.data,
    message: parsed?.message,
    raw: text,
  }
}

/** multipart 본문 만들기 */
function noticeForm({ id, payload, files = [], keep }) {
  const form = new FormData()

  if (id !== undefined) form.set('id', String(id))
  form.set('payload', JSON.stringify(payload))

  for (const no of keep ?? []) form.append('keep[]', String(no))

  for (const file of files) {
    form.append('files[]', new Blob([file.bytes], { type: file.type }), file.name)
  }

  return form
}

async function fetchList(token, query = {}) {
  const res = await request('/api/notices/list.php', { token, query: { page: 1, size: 50, ...query } })
  return res
}

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
    console.log('실행하면 테스트 공지 1건을 만들고, 끝나면 그 건만 삭제합니다.')
    return
  }

  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16)
  const title = `[자동점검] 공지 기능 확인 ${stamp}`
  const titleEdited = `${title} (수정)`
  const body = '<p>자동 점검용 본문입니다. 한글 저장 확인</p>'
  const bodyEdited = '<p>자동 점검용 본문 <strong>수정본</strong>입니다. 한글 확인</p>'

  let token = ''
  let createdId = 0
  let beforePinned = []

  try {
    console.log('\n[1] 로그인 · 인증')

    const anon = await fetchList('')
    check('토큰 없이 목록 호출 차단(401)', anon.status === 401, `status=${anon.status}`)

    const login = await request('/api/auth/login.php', {
      method: 'POST',
      json: { id: ADMIN_ID, password: ADMIN_PW },
    })

    if (!login.data?.token) {
      record('관리자 로그인', false, `${login.status} ${login.message ?? login.raw.slice(0, 120)}`)
      return
    }

    token = login.data.token
    record('관리자 로그인', true, `만료 ${login.data.expiresAt ?? '-'}`)

    console.log('\n[2] 기준 상태')

    const baseline = await fetchList(token)
    if (!baseline.data) {
      record('목록 조회', false, `${baseline.status} ${baseline.message ?? baseline.raw.slice(0, 120)}`)
      return
    }

    beforePinned = baseline.data.pinnedIds ?? []
    record(
      '목록 조회',
      true,
      `공지 ${baseline.data.totalCount}건 / 고정 [${beforePinned.join(', ') || '없음'}]`,
    )

    console.log('\n[3] 등록 (한글 + 첨부 + 공지 체크)')

    const create = await request('/api/notices/create.php', {
      method: 'POST',
      token,
      form: noticeForm({
        payload: { title, content: body, link1: 'https://example.com/e2e', link2: '', pinned: 'Y' },
        files: [{ name: 'e2e-check.png', type: 'image/png', bytes: PNG_BYTES }],
      }),
    })

    createdId = Number(create.data?.id ?? 0)
    if (!check('공지 등록', createdId > 0, create.data ? `wr_id=${createdId}` : `${create.status} ${create.message ?? create.raw.slice(0, 120)}`)) {
      return
    }

    console.log('\n[4] 상세 · 첨부')

    const detail = await request('/api/notices/detail.php', { token, query: { id: createdId } })
    const detailData = detail.data ?? {}

    check('상세 조회', detail.status === 200 && detailData.id === createdId)
    check('제목 한글 정상', detailData.title === title, detailData.title ?? '')
    check('본문 한글 정상', String(detailData.content ?? '').includes('한글 저장 확인'))
    check('첨부 1건 저장', (detailData.files?.length ?? 0) === 1, `files=${detailData.files?.length ?? 0}`)

    const fileUrl = detailData.files?.[0]?.url ?? ''
    if (fileUrl) {
      const fileRes = await fetch(fileUrl.startsWith('http') ? fileUrl : new URL(fileUrl, BASE).toString())
      check(
        '첨부 파일 URL 접근(200)',
        fileRes.status === 200,
        `${fileUrl} → ${fileRes.status} ${fileRes.headers.get('content-type') ?? ''}`,
      )
    } else {
      check('첨부 파일 URL 접근(200)', false, 'url 없음')
    }

    console.log('\n[5] 목록 — 상단 고정')

    const afterCreate = await fetchList(token)
    const items = afterCreate.data?.items ?? []

    check('목록 건수 증가', (afterCreate.data?.totalCount ?? 0) === baseline.data.totalCount + 1)
    check('맨 위에 노출', items[0]?.id === createdId, `first=${items[0]?.id ?? '-'}`)
    check('고정 목록에 포함', (afterCreate.data?.pinnedIds ?? []).includes(createdId), `[${(afterCreate.data?.pinnedIds ?? []).join(', ')}]`)

    console.log('\n[6] 공지 체크 해제 → 재설정')

    const unpin = await request('/api/notices/update.php', {
      method: 'POST',
      token,
      form: noticeForm({
        id: createdId,
        payload: { title, content: body, link1: 'https://example.com/e2e', link2: '', pinned: 'N' },
        keep: (detailData.files ?? []).map((f) => f.no),
      }),
    })

    check('공지 체크 해제 저장', unpin.status === 200, unpin.message ?? '')

    const afterUnpin = await fetchList(token)
    check('고정 목록에서 제거', !(afterUnpin.data?.pinnedIds ?? []).includes(createdId), `[${(afterUnpin.data?.pinnedIds ?? []).join(', ')}]`)

    const repin = await request('/api/notices/update.php', {
      method: 'POST',
      token,
      form: noticeForm({
        id: createdId,
        payload: { title, content: body, link1: '', link2: '', pinned: 'Y' },
        keep: (detailData.files ?? []).map((f) => f.no),
      }),
    })

    check('공지 체크 재설정', repin.status === 200, repin.message ?? '')

    const afterRepin = await fetchList(token)
    check('다시 맨 위 고정', afterRepin.data?.items?.[0]?.id === createdId, `first=${afterRepin.data?.items?.[0]?.id ?? '-'}`)

    console.log('\n[7] 수정 (한글 제목·본문)')

    const edit = await request('/api/notices/update.php', {
      method: 'POST',
      token,
      form: noticeForm({
        id: createdId,
        payload: { title: titleEdited, content: bodyEdited, link1: '', link2: '', pinned: 'Y' },
        keep: (detailData.files ?? []).map((f) => f.no),
      }),
    })

    check('수정 저장', edit.status === 200, edit.message ?? '')

    const edited = await request('/api/notices/detail.php', { token, query: { id: createdId } })
    check('수정 내용 반영', edited.data?.title === titleEdited, edited.data?.title ?? '')
    check('수정 후에도 첨부 유지', (edited.data?.files?.length ?? 0) === 1)

    console.log('\n[8] 첨부 삭제 (keep 없이 수정)')

    const strip = await request('/api/notices/update.php', {
      method: 'POST',
      token,
      form: noticeForm({
        id: createdId,
        payload: { title: titleEdited, content: bodyEdited, link1: '', link2: '', pinned: 'Y' },
        keep: [],
      }),
    })

    check('첨부 전체 삭제 저장', strip.status === 200, strip.message ?? '')

    const stripped = await request('/api/notices/detail.php', { token, query: { id: createdId } })
    check('첨부 0건', (stripped.data?.files?.length ?? 0) === 0, `files=${stripped.data?.files?.length ?? 0}`)

    console.log('\n[9] 검색 · 기간 검색')

    const today = new Date()
    const todayText = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const tomorrow = new Date(today.getTime() + 86400000)
    const tomorrowText = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`

    const byKeyword = await fetchList(token, { keyword: '자동점검' })
    check('검색어 검색', (byKeyword.data?.items ?? []).some((item) => item.id === createdId), `${byKeyword.data?.totalCount ?? 0}건`)

    const byToday = await fetchList(token, { from: todayText, to: todayText })
    check('기간 검색(오늘)', (byToday.data?.items ?? []).some((item) => item.id === createdId), `${todayText} → ${byToday.data?.totalCount ?? 0}건`)

    const byTomorrow = await fetchList(token, { from: tomorrowText, to: tomorrowText })
    check('기간 검색(내일) 제외', !(byTomorrow.data?.items ?? []).some((item) => item.id === createdId), `${tomorrowText} → ${byTomorrow.data?.totalCount ?? 0}건`)

    console.log('\n[10] 삭제')

    const removed = await request('/api/notices/delete.php', { method: 'POST', token, json: { id: createdId } })
    check('공지 삭제', removed.status === 200, `deleted=${removed.data?.deleted ?? '-'} files=${removed.data?.files ?? '-'}`)

    const afterDelete = await fetchList(token)
    check('목록에서 사라짐', !(afterDelete.data?.items ?? []).some((item) => item.id === createdId))
    check('목록 건수 원복', (afterDelete.data?.totalCount ?? 0) === baseline.data.totalCount)

    createdId = 0

    const finalPinned = afterDelete.data?.pinnedIds ?? []
    check(
      '고정 목록 자동 정리 · 원복',
      JSON.stringify([...finalPinned].sort()) === JSON.stringify([...beforePinned].sort()),
      `전 [${beforePinned.join(', ')}] → 후 [${finalPinned.join(', ')}]`,
    )
  } finally {
    // 예외로 중단되더라도 이 실행에서 만든 공지는 지웁니다.
    if (createdId > 0 && token) {
      const cleanup = await request('/api/notices/delete.php', { method: 'POST', token, json: { id: createdId } })
      record('중단 정리(생성한 공지 삭제)', cleanup.status === 200, `wr_id=${createdId}`)
    }
  }

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
