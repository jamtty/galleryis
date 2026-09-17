#!/usr/bin/env node
/**
 * 공개 소식 API 확인 — 로그인 없이 부를 수 있어야 합니다.
 *
 *   node scripts/notice-public-check.mjs
 *
 * 상세를 열면 조회수가 1 올라가는지도 확인합니다. (실제 카운터가 증가합니다)
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

  return { status: res.status, success: parsed?.success, message: parsed?.message, data: parsed?.data, raw: text.slice(0, 200) }
}

const list = await call('/api/notices/public_list.php?page=1&size=5')
console.log(`[${list.status}] 공개 소식 목록 (인증 없음)`)

if (!list.data) {
  console.log(`      실패: ${list.message ?? list.raw}`)
  process.exitCode = 1
} else {
  console.log(`      총 ${list.data.totalCount}건 / ${list.data.totalPages}페이지`)
  for (const item of list.data.items) {
    console.log(`      · ${item.pinned ? '[공지] ' : ''}${item.id} ${item.title} (${item.createdAt.slice(0, 10)}, 조회 ${item.hit})`)
  }
  console.log('')

  // 첫 글 상세 + 조회수 증가 확인
  const first = list.data.items[0]
  if (first) {
    const before = await call(`/api/notices/public_detail.php?id=${first.id}`)
    const after = await call(`/api/notices/public_detail.php?id=${first.id}`)

    const content = String(after.data?.content ?? '')
    const hasTags = /<(p|div|br|h[1-6]|ul|ol|li|table|blockquote|img|hr|figure)\b/i.test(content)

    console.log(`[${after.status}] 공개 소식 상세 — id=${first.id}`)
    console.log(`      제목: ${after.data?.title}`)
    console.log(`      본문: ${content.length}자 / 줄바꿈 ${(content.match(/\n/g) ?? []).length}개 / 태그 있음: ${hasTags}`)
    console.log(`      첨부: ${after.data?.files?.length ?? 0}건`)
    console.log(`      이전글: ${after.data?.prev ? `${after.data.prev.id} ${after.data.prev.title}` : '없음'}`)
    console.log(`      다음글: ${after.data?.next ? `${after.data.next.id} ${after.data.next.title}` : '없음'}`)
    console.log(`      조회수 ${before.data?.hit} → ${after.data?.hit} (${(after.data?.hit ?? 0) === (before.data?.hit ?? 0) + 1 ? '증가 OK' : '증가하지 않음'})`)
    console.log('')
  }
}

const missing = await call('/api/notices/public_detail.php?id=99999999')
console.log(`[${missing.status}] 없는 소식 → ${missing.status === 404 ? '404 안내 OK' : '응답 확인 필요'} (${missing.message ?? ''})`)
