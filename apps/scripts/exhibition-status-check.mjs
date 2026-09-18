#!/usr/bin/env node
/**
 * 전시 분류가 날짜와 맞는지 확인합니다. (읽기 전용 — 아무것도 바꾸지 않습니다)
 *
 *   node scripts/exhibition-status-check.mjs
 *
 * 공개 목록을 받아, 각 전시의 기간과 **오늘 날짜**로 기대 분류를 계산해 응답의 분류와 비교합니다.
 * 서버는 목록·상세를 조회할 때마다 분류를 자동 갱신하므로, 여기서 어긋나면 어딘가 고장난 것입니다.
 *
 *   오늘 > 종료일   → past     (지난전시)
 *   오늘 < 시작일   → upcoming (예정전시)
 *   그 외          → current  (현재전시)
 *
 * 기준일은 응답의 `Date` 헤더(서버 시각)를 KST 로 환산해 씁니다. (자정 전후 오차 방지)
 * 자격증명이 필요 없습니다. (공개 API 만 호출)
 */
const BASE = (process.env.NOTICE_TEST_BASE ?? 'https://galleryiscom.mycafe24.com/backend').replace(/\/+$/, '')
const TIMEOUT_MS = 8000

const TABS = [
  { status: 'current', label: '현재전시' },
  { status: 'upcoming', label: '예정전시' },
  { status: 'past', label: '지난전시' },
]

function step(text) {
  process.stderr.write(`${text}\n`)
}

/** 한 번의 요청 (응답이 없으면 8초에 끊습니다) */
async function once(pathname, query = {}) {
  const url = new URL(`${BASE}${pathname}`)

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    url.searchParams.set(key, String(value))
  }

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })

  const text = await res.text()

  let parsed = null
  try {
    parsed = JSON.parse(text)
  } catch {
    // HTML 오류
  }

  return {
    status: res.status,
    data: parsed?.data,
    message: parsed?.message,
    /** 서버 시각 (Date 헤더) */
    date: res.headers.get('date') ?? '',
  }
}

/** 이 호스팅은 한 프로세스가 요청을 연속으로 보내면 멈출 때가 있어 새 연결로 재시도합니다. */
async function request(pathname, query = {}, attempt = 0) {
  try {
    return await once(pathname, query)
  } catch (error) {
    if (attempt >= 2) throw error

    step(`   (재시도 ${attempt + 2}/3 — ${error instanceof Error ? error.message : error})`)

    return request(pathname, query, attempt + 1)
  }
}

/** 서버 시각을 KST 기준 YYYY-MM-DD 로 */
function kstDate(header) {
  const parsed = header ? new Date(header) : new Date()

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(parsed)
}

/** 서버 규칙과 같은 계산 */
function expectedStatus(item, today) {
  if (item.endDate && String(item.endDate) < today) return 'past'
  if (item.startDate && String(item.startDate) > today) return 'upcoming'

  return 'current'
}

const failures = []
const LABEL = { current: '현재전시', upcoming: '예정전시', past: '지난전시' }

step('[1] 전체 목록')

const all = await request('/api/exhibitions/public_list.php', { status: '', size: 48 })

if (!all.data) {
  console.log(`전체 목록을 받지 못했습니다. (HTTP ${all.status} ${all.message ?? ''})`)
  process.exit(1)
}

const today = kstDate(all.date)
const items = all.data.items ?? []

console.log(`전시 ${all.data.totalCount}건 · 기준일 ${today} (서버 시각 ${all.date})`)
console.log('')

for (const item of items) {
  const expected = expectedStatus(item, today)
  const actual = String(item.status)
  const ok = expected === actual

  if (!ok) failures.push(`${item.id} ${item.title} — 기대 ${LABEL[expected]} / 응답 ${LABEL[actual]}`)

  console.log(
    `   ${ok ? '✓' : '✗'} ${String(item.id).padStart(3)} | ${(LABEL[actual] ?? actual).padEnd(6)} | ` +
      `${item.startDate} ~ ${item.endDate} | ${item.title}`,
  )
}

step('[2] 분류 탭')

const counts = {}

for (const tab of TABS) {
  const res = await request('/api/exhibitions/public_list.php', { status: tab.status, size: 48 })

  if (!res.data) {
    failures.push(`${tab.label} 탭을 받지 못했습니다. (HTTP ${res.status} ${res.message ?? ''})`)
    continue
  }

  counts[tab.status] = res.data.totalCount

  const wrong = (res.data.items ?? []).filter((item) => String(item.status) !== tab.status)

  for (const item of wrong) {
    failures.push(`${tab.label} 탭에 다른 분류가 있습니다 — ${item.id} ${item.title} (${item.status})`)
  }

  console.log(`   ${tab.label} ${res.data.totalCount}건${wrong.length ? ` — ✗ 다른 분류 ${wrong.length}건` : ''}`)
}

// 탭 합계 = 전체 건수 여야 합니다.
const sum = TABS.reduce((total, tab) => total + (counts[tab.status] ?? 0), 0)

console.log('')
console.log(`   합계 ${sum}건 / 전체 ${all.data.totalCount}건`)

if (sum !== all.data.totalCount) {
  failures.push(`탭 합계(${sum})와 전체 건수(${all.data.totalCount})가 다릅니다.`)
}

console.log('')

if (failures.length === 0) {
  console.log('모두 통과 — 분류가 날짜와 일치합니다.')
  process.exit(0)
}

console.log(`문제 ${failures.length}건`)
for (const failure of failures) console.log(`  · ${failure}`)

process.exit(1)
