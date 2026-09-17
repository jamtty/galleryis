#!/usr/bin/env node
/**
 * 공개 전시 API 확인 — 로그인 없이 부를 수 있어야 합니다.
 *
 *   node scripts/exhibition-public-check.mjs
 *
 * 첫 전시 상세를 열어 조회수가 오르는지도 확인합니다. (실제 카운터가 증가합니다)
 */
const BASE = (process.env.NOTICE_TEST_BASE ?? 'https://galleryiscom.mycafe24.com/backend').replace(/\/+$/, '')

async function call(pathname) {
  const res = await fetch(`${BASE}${pathname}`, { headers: { Accept: 'application/json' } })
  const text = await res.text()

  let parsed = null
  try {
    parsed = JSON.parse(text)
  } catch {
    // HTML 오류
  }

  return { status: res.status, message: parsed?.message, data: parsed?.data, raw: text.slice(0, 200) }
}

for (const status of ['current', 'upcoming', 'past', '']) {
  const label = status === '' ? '전체' : status
  const res = await call(`/api/exhibitions/public_list.php?size=5&status=${status}`)

  if (!res.data) {
    console.log(`[${res.status}] ${label} — 실패: ${res.message ?? res.raw}`)
    continue
  }

  console.log(`[${res.status}] ${label} — 총 ${res.data.totalCount}건 / ${res.data.totalPages}페이지`)

  for (const item of res.data.items) {
    console.log(
      `      · ${item.id} ${item.title} | ${item.startDate} ~ ${item.endDate} | ${item.place} | ${item.statusLabel} | 이미지 ${item.imageUrl ? '있음' : '없음'}`,
    )
  }
}

console.log('')

const list = await call('/api/exhibitions/public_list.php?size=5&status=current')
const first = list.data?.items?.[0]

if (first) {
  const before = await call(`/api/exhibitions/public_detail.php?id=${first.id}`)
  const after = await call(`/api/exhibitions/public_detail.php?id=${first.id}`)
  const detail = after.data ?? {}

  const images = (detail.files ?? []).filter((file) => file.isImage)
  const imageUrl = images[0]?.url ?? ''

  if (imageUrl) {
    const res = await fetch(imageUrl)

    console.log(`[${res.status}] 대표 이미지 접근 — ${imageUrl.split('/').pop()}`)
  }

  console.log(`[${after.status}] 공개 전시 상세 — id=${first.id}`)
  console.log(`      제목: ${detail.title} / 작가: ${detail.artist} / 장소: ${detail.place}`)
  console.log(`      기간: ${detail.startDate} ~ ${detail.endDate} (${detail.statusLabel})`)
  console.log(`      개요: ${String(detail.overview ?? '').length}자 / 약력: ${String(detail.bio ?? '').length}자`)
  console.log(`      파일: ${(detail.files ?? []).length}건 (이미지 ${images.length}건)`)
  console.log(`      조회수 ${before.data?.hit} → ${after.data?.hit} (${(after.data?.hit ?? 0) === (before.data?.hit ?? 0) + 1 ? '증가 OK' : '증가하지 않음'})`)
  console.log('')
}

const missing = await call('/api/exhibitions/public_detail.php?id=99999999')
console.log(`[${missing.status}] 없는 전시 → ${missing.status === 404 ? '404 안내 OK' : '응답 확인 필요'} (${missing.message ?? ''})`)
