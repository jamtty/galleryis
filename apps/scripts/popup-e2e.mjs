#!/usr/bin/env node
/**
 * 팝업 기능 E2E 점검 — 관리자 API 를 직접 호출합니다.
 *
 *   node scripts/popup-e2e.mjs --yes
 *
 * ⚠ 실제 서버(운영 DB)에 테스트 팝업 2건을 만들고, 끝나면 그 건만 삭제합니다.
 *    - 삭제 대상은 이 실행에서 만든 id 뿐입니다.
 *    - 테스트 중 잠깐 use_yn='Y' 가 되어 공개 화면에 1x1 픽셀 이미지가 뜰 수 있습니다.
 *
 * 점검 항목
 *   1. 로그인 / 인증 차단(401)
 *   2. 기준 상태
 *   3. 등록 (이미지 첨부)
 *   4. 상세 · 이미지 URL 접근(200)
 *   5. 사용 토글 → 공개 목록(active) 포함
 *   6. 노출기간이 지난 팝업은 공개 목록에서 제외
 *   7. 검색어 · 노출기간 검색
 *   8. 수정 (제목 반영, 이미지 유지)
 *   9. 이미지 교체 (기존 파일 정리)
 *  10. 삭제 (이미지 파일도 함께 정리)
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
const CONFIRM = process.argv.includes('--yes')

/** 1x1 PNG */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
)

/** 2x2 PNG (교체 테스트용 — 파일이 실제로 바뀌었는지 구분) */
const PNG2 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8DwHwMDAwMDAwMAFh4C/e0AAAAASUVORK5CYII=',
  'base64',
)

const results = []

function check(name, condition, detail = '') {
  const ok = Boolean(condition)
  results.push({ name, ok })
  console.log(`  [${ok ? 'OK  ' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`)
  return ok
}

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
  if (form) body = form
  else if (json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(json)
  }

  const res = await fetch(url, { method, headers, body })
  const text = await res.text()

  let parsed = null
  try {
    parsed = JSON.parse(text)
  } catch {
    // PHP 오류 등으로 HTML 이 올 수 있습니다.
  }

  return { status: res.status, data: parsed?.data, message: parsed?.message, raw: text }
}

function payloadFor(over = {}) {
  return {
    title: '[자동점검] 팝업 기능 확인',
    url: 'https://example.com/e2e',
    link_target: '_blank',
    period_start: '',
    period_end: '',
    use_yn: 'N',
    sort_order: 1,
    img_pos_left: 0,
    img_pos_top: 0,
    ...over,
  }
}

function formFor(payload, files = [], id) {
  const form = new FormData()
  if (id !== undefined) form.set('id', String(id))
  form.set('payload', JSON.stringify(payload))

  for (const file of files) {
    form.append('image', new Blob([file.bytes], { type: 'image/png' }), file.name)
  }

  return form
}

/** 이미지 URL 이 아직 이미지로 응답하는지 (없으면 404 또는 SPA 폴백 HTML) */
async function imageInfo(url) {
  if (!url) return { status: 0, type: '', size: 0 }

  const res = await fetch(`${url}?t=${Date.now()}`)
  const buffer = await res.arrayBuffer()

  return {
    status: res.status,
    type: res.headers.get('content-type') ?? '',
    size: buffer.byteLength,
  }
}

function ymd(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

async function main() {
  const id = env('NOTICE_TEST_ID')
  const pw = env('NOTICE_TEST_PW')

  console.log(`\n대상: ${BASE}`)

  if (!id || !pw) {
    console.log(`${ENV_FILE} 에 계정을 적어 주세요.`)
    process.exitCode = 1
    return
  }

  if (!CONFIRM) {
    console.log('\n--yes 를 붙이면 테스트 팝업 2건을 만들고 끝나면 지웁니다.')
    return
  }

  let token = ''
  const created = []

  try {
    console.log('\n[1] 로그인 · 인증')

    const anon = await request('/api/popups/list.php', { query: { page: 1 } })
    check('토큰 없이 목록 호출 차단(401)', anon.status === 401, `status=${anon.status}`)

    const login = await request('/api/auth/login.php', {
      method: 'POST',
      json: { id, password: pw },
    })

    token = login.data?.token ?? ''
    if (!check('관리자 로그인', token !== '', login.message ?? '')) return

    console.log('\n[2] 기준 상태')

    const before = await request('/api/popups/list.php', { token, query: { page: 1, size: 50 } })
    if (!check('목록 조회', Boolean(before.data), before.message ?? '')) return

    const baseCount = before.data.totalCount
    console.log(`      팝업 ${baseCount}건`)

    console.log('\n[3] 등록 (이미지 포함)')

    const create = await request('/api/popups/create.php', {
      method: 'POST',
      token,
      form: formFor(payloadFor(), [{ name: 'e2e-popup.png', bytes: PNG }]),
    })

    const popupId = Number(create.data?.id ?? 0)
    if (!check('팝업 등록', popupId > 0, create.data ? `id=${popupId}` : (create.message ?? ''))) return

    created.push(popupId)

    console.log('\n[4] 상세 · 이미지')

    const detail = await request('/api/popups/detail.php', { token, query: { id: popupId } })
    const first = detail.data ?? {}

    check('상세 조회', detail.status === 200 && first.id === popupId)
    check('제목 한글 정상', first.title === payloadFor().title, first.title ?? '')
    check('이미지 크기 기록', first.width > 0 && first.height > 0, `${first.width}×${first.height}`)

    const firstImage = first.imageUrl ?? ''
    const firstInfo = await imageInfo(firstImage)
    check('이미지 URL 접근(200 image)', firstInfo.status === 200 && firstInfo.type.includes('image'), `${firstImage} → ${firstInfo.status} ${firstInfo.type}`)

    console.log('\n[5] 사용 토글 → 공개 목록')

    const on = await request('/api/popups/display.php', { method: 'POST', token, json: { id: popupId, use_yn: 'Y' } })
    check('사용으로 변경', on.status === 200 && on.data?.useYn === 'Y', on.message ?? '')

    const activeOn = await request('/api/popups/active.php')
    check('공개 목록(active)에 포함', (activeOn.data ?? []).some((item) => item.id === popupId), `${(activeOn.data ?? []).length}건`)

    const off = await request('/api/popups/display.php', { method: 'POST', token, json: { id: popupId, use_yn: 'N' } })
    check('미사용으로 되돌리기', off.status === 200 && off.data?.useYn === 'N', off.message ?? '')

    const activeOff = await request('/api/popups/active.php')
    check('미사용은 공개 목록에서 제외', !(activeOff.data ?? []).some((item) => item.id === popupId))

    console.log('\n[6] 노출기간 필터')

    const yesterday = ymd(new Date(Date.now() - 86400000))

    const expired = await request('/api/popups/create.php', {
      method: 'POST',
      token,
      form: formFor(
        payloadFor({ title: '[자동점검] 기간 지난 팝업', use_yn: 'Y', period_end: yesterday }),
        [{ name: 'e2e-expired.png', bytes: PNG }],
      ),
    })

    const expiredId = Number(expired.data?.id ?? 0)
    check('기간 지난 팝업 등록', expiredId > 0, expired.message ?? '')

    if (expiredId > 0) {
      created.push(expiredId)

      const activeExpired = await request('/api/popups/active.php')
      check('기간이 지난 팝업은 공개 목록에서 제외', !(activeExpired.data ?? []).some((item) => item.id === expiredId))
    }

    console.log('\n[7] 검색')

    const byKeyword = await request('/api/popups/list.php', { token, query: { page: 1, size: 50, keyword: '자동점검' } })
    check('검색어 검색', (byKeyword.data?.items ?? []).some((item) => item.id === popupId), `${byKeyword.data?.totalCount ?? 0}건`)

    const byPeriod = await request('/api/popups/list.php', { token, query: { page: 1, size: 50, from: yesterday, to: ymd(new Date()) } })
    check('노출기간 검색(기간 지난 건 포함)', (byPeriod.data?.items ?? []).some((item) => item.id === popupId), `${byPeriod.data?.totalCount ?? 0}건`)

    console.log('\n[8] 수정 (제목 반영)')

    const editTitle = '[자동점검] 팝업 기능 확인 (수정)'
    const edit = await request('/api/popups/update.php', {
      method: 'POST',
      token,
      form: formFor(payloadFor({ title: editTitle }), [], popupId),
    })

    check('수정 저장', edit.status === 200, edit.message ?? '')

    const afterEdit = await request('/api/popups/detail.php', { token, query: { id: popupId } })
    check('제목 반영', afterEdit.data?.title === editTitle, afterEdit.data?.title ?? '')
    check('이미지 유지', afterEdit.data?.imageUrl === firstImage)

    console.log('\n[9] 이미지 교체')

    const replace = await request('/api/popups/update.php', {
      method: 'POST',
      token,
      form: formFor(payloadFor({ title: editTitle }), [{ name: 'e2e-popup-2.png', bytes: PNG2 }], popupId),
    })

    check('이미지 교체 저장', replace.status === 200, replace.message ?? '')

    const afterReplace = await request('/api/popups/detail.php', { token, query: { id: popupId } })
    const secondImage = afterReplace.data?.imageUrl ?? ''

    check('이미지 주소 변경', secondImage !== '' && secondImage !== firstImage, `${secondImage.split('/').pop() ?? ''}`)

    const secondInfo = await imageInfo(secondImage)
    check('새 이미지 접근(200 image)', secondInfo.status === 200 && secondInfo.type.includes('image'), `${secondInfo.status} ${secondInfo.type}`)
    check('크기 갱신(2×2)', afterReplace.data?.width === 2 && afterReplace.data?.height === 2, `${afterReplace.data?.width}×${afterReplace.data?.height}`)

    const oldInfo = await imageInfo(firstImage)
    check('기존 이미지 파일 정리', !oldInfo.type.includes('image'), `${oldInfo.status} ${oldInfo.type}`)

    console.log('\n[10] 삭제')

    const removed = await request('/api/popups/delete.php', { method: 'POST', token, json: { ids: created.slice() } })
    check('삭제', removed.status === 200, `deleted=${removed.data?.deleted ?? '-'} files=${removed.data?.files ?? '-'}`)

    created.length = 0

    const after = await request('/api/popups/list.php', { token, query: { page: 1, size: 50 } })
    check('목록에서 사라짐', !(after.data?.items ?? []).some((item) => item.id === popupId))
    check('건수 원복', after.data?.totalCount === baseCount, `${baseCount} → ${after.data?.totalCount ?? '-'}`)

    const activeAfter = await request('/api/popups/active.php')
    check('공개 목록에서도 제거', !(activeAfter.data ?? []).some((item) => item.id === popupId))

    const newImageInfo = await imageInfo(secondImage)
    check('이미지 파일도 삭제', !newImageInfo.type.includes('image'), `${newImageInfo.status} ${newImageInfo.type}`)
  } finally {
    if (created.length > 0 && token) {
      const cleanup = await request('/api/popups/delete.php', { method: 'POST', token, json: { ids: created } })
      check('중단 정리(만든 팝업 삭제)', cleanup.status === 200, `ids=${created.join(', ')}`)
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
