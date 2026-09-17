#!/usr/bin/env node
/**
 * 공지 저장 실패 원인 좁히기 — 어떤 입력이 500 을 내는지 하나씩 확인합니다.
 *
 *   node scripts/notice-probe.mjs --yes
 *
 * 케이스마다 공지를 1건 만들고 바로 삭제합니다.
 * (성공한 건만 삭제 대상이며, 실패한 건은 애초에 만들어지지 않습니다)
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

const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
)

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
    // HTML 오류
  }

  return { status: res.status, data: parsed?.data, message: parsed?.message, raw: text }
}

async function main() {
  const id = env('NOTICE_TEST_ID')
  const pw = env('NOTICE_TEST_PW')

  if (!id || !pw) {
    console.log(`${ENV_FILE} 에 계정을 적어 주세요.`)
    process.exitCode = 1
    return
  }

  if (!CONFIRM) {
    console.log('--yes 를 붙이면 케이스별로 공지 1건씩 만들고 바로 지웁니다.')
    return
  }

  const login = await request('/api/auth/login.php', { method: 'POST', json: { id, password: pw } })
  const token = login.data?.token

  if (!token) {
    console.log(`로그인 실패: ${login.status} ${login.message ?? ''}`)
    process.exitCode = 1
    return
  }

  console.log(`대상: ${BASE}\n`)

  /** 만들고 → 결과 확인 → 지우기 */
  async function probe(label, input, files = []) {
    const form = new FormData()
    form.set('payload', JSON.stringify(input))
    for (const file of files) {
      form.append('files[]', new Blob([file.bytes], { type: file.type }), file.name)
    }

    const res = await request('/api/notices/create.php', { method: 'POST', token, form })
    const wrId = Number(res.data?.id ?? 0)
    let detail = ''

    if (wrId > 0) {
      const detailRes = await request('/api/notices/detail.php', { token, query: { id: wrId } })
      const saved = detailRes.data ?? {}

      detail = `제목="${saved.title}" 본문="${String(saved.content ?? '').replace(/<[^>]*>/g, '')}" 첨부=${saved.files?.length ?? 0}건`

      const removed = await request('/api/notices/delete.php', { method: 'POST', token, json: { id: wrId } })
      detail += ` / 삭제=${removed.status === 200 ? 'OK' : `FAIL(${removed.status})`}`
    } else {
      detail = `${res.status} ${res.message ?? res.raw.slice(0, 200).replace(/\s+/g, ' ')}`
    }

    console.log(`[${wrId > 0 ? '성공' : '실패'}] ${label}`)
    console.log(`        ${detail}\n`)
  }

  const base = { link1: '', link2: '', pinned: 'N' }

  await probe('1) 영문만 · 첨부 없음', { ...base, title: 'probe ascii', content: '<p>plain ascii</p>' })

  await probe('2) 한글 · 첨부 없음', { ...base, title: '[점검] 한글 제목', content: '<p>한글 본문입니다.</p>' })

  await probe('3) 한글 + 이미지 첨부', { ...base, title: '[점검] 한글 + 첨부', content: '<p>첨부 함께 저장</p>' },
    [{ name: 'probe.png', type: 'image/png', bytes: PNG_BYTES }])

  await probe('4) 한글 + 링크', { ...base, link1: 'https://example.com/probe', title: '[점검] 링크', content: '<p>링크</p>' })

  await probe('5) 한글 + 이모지(✅)', { ...base, title: '[점검] 이모지', content: '<p>이모지 ✅ 확인</p>' })

  await probe('6) 한글 + 물결/화살표(※ · ~ →)', { ...base, title: '[점검] 특수문자 ※ ~ →', content: '<p>※ 특수문자 → 확인</p>' })

  await probe('7) 공지 체크(Y) 포함', { ...base, pinned: 'Y', title: '[점검] 고정 포함', content: '<p>고정 저장</p>' })

  // 8) 공지를 지우면 서버의 실제 첨부파일도 함께 지워지는지
  {
    const form = new FormData()
    form.set(
      'payload',
      JSON.stringify({ ...base, title: '[점검] 첨부 정리', content: '<p>파일 정리 확인</p>' }),
    )
    form.append('files[]', new Blob([PNG_BYTES], { type: 'image/png' }), 'probe-cleanup.png')

    const res = await request('/api/notices/create.php', { method: 'POST', token, form })
    const wrId = Number(res.data?.id ?? 0)

    if (wrId <= 0) {
      console.log(`[실패] 8) 첨부 파일 정리\n        생성 실패 ${res.status} ${res.message ?? ''}\n`)
    } else {
      const detailRes = await request('/api/notices/detail.php', { token, query: { id: wrId } })
      const url = detailRes.data?.files?.[0]?.url ?? ''

      /** 없는 파일도 SPA 폴백으로 200(HTML) 이 올 수 있어 내용 종류까지 봅니다. */
      async function fetchInfo(target) {
        if (!target) return { status: 0, type: '', size: 0 }

        const res = await fetch(target)
        const buffer = await res.arrayBuffer()

        return {
          status: res.status,
          type: res.headers.get('content-type') ?? '',
          size: buffer.byteLength,
        }
      }

      const before = await fetchInfo(url)
      const removed = await request('/api/notices/delete.php', { method: 'POST', token, json: { id: wrId } })
      // 캐시를 피하려고 쿼리를 붙여 다시 요청합니다.
      const after = await fetchInfo(url ? `${url}?t=${Date.now()}` : '')

      const stillImage = after.type.includes('image')
      const ok = before.type.includes('image') && !stillImage

      console.log(`[${ok ? '성공' : '확인 필요'}] 8) 첨부 파일 정리`)
      console.log(
        `        삭제 전 ${before.status} ${before.type} ${before.size}B`
          + ` → 삭제 후 ${after.status} ${after.type} ${after.size}B`
          + ` / deleted=${removed.data?.deleted ?? '-'} files=${removed.data?.files ?? '-'}`,
      )
      console.log(
        stillImage
          ? '        → 파일이 아직 남아 있습니다 (실제 삭제 실패)\n'
          : '        → 파일이 실제로 지워졌습니다 (폴백 HTML 응답)\n',
      )
    }
  }

  // 9) 본문의 저장 불가 문자(이모지 등)가 숫자 엔티티로 보존되는지
  {
    const emoji = '\u{1F600}' // 😀 — euc-kr 에 없는 4바이트 글자
    const symbol = '\uFFED' // euc-kr 에 없는 기호 (원본 공지에 있던 &#65517;)

    const form = new FormData()
    form.set(
      'payload',
      JSON.stringify({
        ...base,
        title: '[점검] 본문 문자 보존',
        content: `<p>이모지 ${emoji} 와 기호 ${symbol} 확인</p>`,
      }),
    )

    const res = await request('/api/notices/create.php', { method: 'POST', token, form })
    const wrId = Number(res.data?.id ?? 0)

    if (wrId <= 0) {
      console.log(`[실패] 9) 본문 문자 보존\n        ${res.status} ${res.message ?? ''}\n`)
    } else {
      const detailRes = await request('/api/notices/detail.php', { token, query: { id: wrId } })
      const saved = String(detailRes.data?.content ?? '')

      await request('/api/notices/delete.php', { method: 'POST', token, json: { id: wrId } })

      const ok = saved.includes('&#128512;') && saved.includes('&#65517;')

      console.log(`[${ok ? '성공' : '확인 필요'}] 9) 본문 문자 보존 (엔티티 변환)`)
      console.log(`        저장된 본문: ${saved}\n`)
    }
  }
}

main().catch((error) => {
  console.error('오류:', error)
  process.exitCode = 1
})
