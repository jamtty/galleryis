#!/usr/bin/env node
/**
 * 반응형 레이아웃 점검 — 가로 넘침(레이아웃 깨짐) 찾기
 *
 *   npm run dev  (다른 터미널에서 켜 둔 상태에서)
 *   node scripts/layout-check.mjs                 공개 페이지 · 375/900 폭
 *   node scripts/layout-check.mjs --admin         관리자 페이지까지 (로그인 필요)
 *   node scripts/layout-check.mjs --width 375     폭 하나만
 *   node scripts/layout-check.mjs --path /halls   주소 하나만
 *
 * reveal-check.mjs 를 --width/--eval 로 불러서, 페이지가 뷰포트보다 넓어지는지 봅니다.
 *   · documentElement.scrollWidth > clientWidth  → 가로 스크롤 발생 (깨진 것)
 *   · 화면 밖으로 나간 요소를 찾아 알려 줍니다 (가로 스크롤 영역 안의 요소는 제외)
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const HERE = import.meta.dirname
const argv = process.argv.slice(2)
const arg = (name, fallback) => {
  const index = argv.indexOf(name)

  return index === -1 ? fallback : argv[index + 1]
}

const WITH_ADMIN = argv.includes('--admin')
const ONE_PATH = arg('--path', '')
const WIDTHS = arg('--width', '')
  ? arg('--width').split(',').map(Number)
  : [375, 900]

/** 화면 밖으로 나간 요소 찾기 (스크롤·클립 영역 안은 정상으로 봅니다) */
const PROBE = `(() => {
  const width = document.documentElement.clientWidth
  const scrollWidth = document.documentElement.scrollWidth
  const clipped = (el) => {
    for (let node = el.parentElement; node; node = node.parentElement) {
      const overflowX = getComputedStyle(node).overflowX
      if (overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'hidden') return true
    }
    return false
  }
  const out = []
  for (const el of document.querySelectorAll('body *')) {
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) continue
    // 화면 밖 왼쪽에 숨겨 둔 요소(서랍 등)는 넘침이 아닙니다.
    if (rect.right <= 0) continue
    if (rect.right <= width + 1 && rect.left >= -1) continue
    if (clipped(el)) continue
    const cls = typeof el.className === 'string' ? el.className : ''
    out.push(el.tagName.toLowerCase() + (cls ? '.' + cls.trim().split(/\\s+/).join('.') : '') + ' [' + Math.round(rect.left) + '~' + Math.round(rect.right) + ']')
    if (out.length >= 6) break
  }
  return { width, scrollWidth, overflow: scrollWidth > width + 1, out }
})()`

const PUBLIC_PATHS = [
  '/',
  '/exhibitions',
  '/exhibitions/21',
  '/rental',
  '/rental/apply?hall=hall1&week=2026-09-23',
  '/halls',
  '/halls/hall1/studio',
  '/about',
  '/notices',
  '/notices/131',
  '/privacy',
]

const ADMIN_PATHS = [
  '/admin/rentals',
  '/admin/rentals/edit/4373',
  '/admin/schedule',
  '/admin/exhibitions',
  '/admin/exhibitions/edit/21',
  '/admin/halls',
  '/admin/halls/edit/1',
  '/admin/notices',
  '/admin/notices/edit/131',
  '/admin/popups',
  '/admin/settings',
  '/admin/mypage',
]

const paths = ONE_PATH
  ? [ONE_PATH]
  : WITH_ADMIN
    ? ADMIN_PATHS
    : PUBLIC_PATHS

const reveal = join(HERE, 'reveal-check.mjs')

if (!existsSync(reveal)) {
  console.error('reveal-check.mjs 를 찾을 수 없습니다.')
  process.exit(1)
}

let bad = 0

for (const width of WIDTHS) {
  console.log(`\n=== 폭 ${width}px ===`)

  for (const path of paths) {
    const args = [
      '--experimental-websocket',
      reveal,
      '--width',
      String(width),
      '--path',
      path,
      '--eval',
      PROBE,
    ]

    if (WITH_ADMIN) args.push('--login')

    const run = spawnSync(process.execPath, args, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 8 })
    const text = `${run.stdout ?? ''}${run.stderr ?? ''}`

    // --login 이 찍는 안내 줄을 걷어내고 JSON 만 봅니다.
    const start = text.indexOf('{')

    if (start === -1) {
      console.log(`   ? ${path} — 결과를 읽지 못했습니다`)
      console.log(text.split('\n').slice(-3).join('\n'))
      bad++
      continue
    }

    const json = JSON.parse(text.slice(start, text.lastIndexOf('}') + 1))
    const mark = json.overflow ? '✗' : '·'

    console.log(
      `   ${mark} ${path} — ${json.width} / ${json.scrollWidth}${json.out.length ? ' : ' + json.out.join(' | ') : ''}`,
    )

    if (json.overflow) bad++
  }
}

console.log(bad === 0 ? '\n가로 넘침 없음' : `\n가로 넘침 ${bad}건`)

process.exit(bad === 0 ? 0 : 1)
