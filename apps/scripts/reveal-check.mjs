#!/usr/bin/env node
/**
 * 스크롤 등장 효과 점검 — useScrollReveal(GSAP ScrollTrigger)
 *
 *   npm run dev  (다른 터미널에서 켜 둔 상태에서)
 *   node --experimental-websocket scripts/reveal-check.mjs
 *
 * 실제 브라우저(헤드리스 Chrome)로 공개 페이지를 위·아래로 훑으면서 확인합니다.
 *   ① 화면에 들어온 요소가 숨겨진 채 남아 있지 않은지 (내용이 안 보이면 치명적)
 *   ② 아직 화면 밖인 요소는 실제로 숨겨져 있는지 (효과가 살아 있는지)
 *   ③ 스크롤을 되돌리면 다시 사라지는지
 *
 * 문제가 있으면 종료 코드 1 로 끝납니다.
 *
 * 옵션
 *   --port 1212        개발 서버 포트
 *   --debug            위반 요소를 전부 출력
 *   --keep             끝나고 브라우저를 닫지 않음 (직접 열어 보려고 할 때)
 *   --shot 결과.png     화면을 찍고 바로 끝남 (팝업은 닫고 찍음)
 *   --ratio 0.45       --shot 의 두 번째 사진을 찍을 스크롤 위치 (0~1)
 *   --eval "식"         페이지에서 식을 하나 실행하고 값만 출력 (점검은 건너뜀)
 *   --path /주소        --shot · --eval 이 열 페이지 (기본 '/')
 *   --login            .env.test.local 관리자 계정으로 로그인해 관리자 화면도 볼 수 있게 함
 *   --width 375        뷰포트 너비 (기본 1440) — 모바일 레이아웃 확인용
 *   --height 812       뷰포트 높이 (기본 900)
 *   --mobile           모바일 기기로 봅니다 (터치 + 배율 2)
 *   --click "선택자"     --shot 전에 그 요소를 한 번 누릅니다 (서랍 펼친 모습 등)
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const argv = process.argv.slice(2)
const arg = (name, fallback) => {
  const index = argv.indexOf(name)

  return index === -1 ? fallback : argv[index + 1]
}

const PORT = Number(arg('--port', 1212))
const BASE = `http://localhost:${PORT}`
const DEBUG = argv.includes('--debug')
const KEEP = argv.includes('--keep')
/** --shot 결과.png — 메인 화면을 맨 위·중간에서 찍어 둡니다. */
const SHOT = arg('--shot', '')
/** --eval "식" — 페이지에서 식을 하나 실행하고 값만 출력합니다 (디버깅용). */
const EVAL = arg('--eval', '')
/** --path /주소 — --shot · --eval 이 열 페이지 (http 로 시작하면 그 주소 그대로 — 원본 사이트 비교용) */
const PATH_ARG = arg('--path', '/')

/** 페이지 주소 만들기 (절대 주소면 그대로) */
const urlFor = (path) => (path.startsWith('http') ? path : `${BASE}${path}`)
/** --login — 관리자 계정으로 로그인해 관리자 화면도 볼 수 있게 합니다 */
const LOGIN = argv.includes('--login')
/** --width / --height — 뷰포트 크기 (모바일 레이아웃 확인) */
const VIEW_WIDTH = Number(arg('--width', 1440))
const VIEW_HEIGHT = Number(arg('--height', 900))
/** --mobile — 터치 + 배율 2 로 모바일 기기처럼 */
const MOBILE = argv.includes('--mobile')
/** --click "선택자" — --shot 전에 눌러 볼 요소 (서랍 펼치기 등) */
const CLICK = arg('--click', '')
const DEBUG_PORT = 9333
/** ScrollTrigger 의 start 와 같은 기준 — 이 선을 넘어야 등장합니다. */
const START_RATIO = 0.88

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((path) => path && existsSync(path))

if (!CHROME) {
  console.error('Chrome(또는 Edge)을 찾을 수 없습니다. --keep 없이 경로를 알려주세요.')
  process.exit(1)
}

if (typeof WebSocket === 'undefined') {
  console.error('이 스크립트는 --experimental-websocket 플래그가 필요합니다.')
  process.exit(1)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/* --------------------------------------------------------------------------
 * 개발 서버 · 브라우저 준비
 * ------------------------------------------------------------------------ */
try {
  const res = await fetch(BASE, { signal: AbortSignal.timeout(4000) })

  if (!res.ok) throw new Error(String(res.status))
} catch (error) {
  console.error(`${BASE} 에 연결하지 못했습니다 — npm run dev 를 먼저 실행하세요. (${error.message})`)
  process.exit(1)
}

const profile = mkdtempSync(join(tmpdir(), 'reveal-check-'))
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking',
    // 헤드리스에는 GPU 가 없어 소프트웨어 렌더러로 WebGL 을 씁니다 (3D 둘러보기 확인용)
    '--enable-unsafe-swiftshader',
    '--window-size=1440,900',    '--force-device-scale-factor=1',
    'about:blank',
  ],
  { stdio: 'ignore' },
)

const stopBrowser = () => {
  if (KEEP) return

  chrome.kill()

  try {
    rmSync(profile, { recursive: true, force: true })
  } catch {
    // 아직 잠겨 있으면 그냥 둡니다 (임시 폴더)
  }
}

/** CDP — 최소한의 WebSocket 클라이언트 */
async function attachBrowser(onEvent) {
  let socketUrl = ''

  for (let attempt = 0; attempt < 80 && !socketUrl; attempt += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)
      const info = await res.json()

      socketUrl = info.webSocketDebuggerUrl ?? ''
    } catch {
      // 아직 포트가 안 열렸습니다
    }

    if (!socketUrl) await sleep(200)
  }

  if (!socketUrl) throw new Error('헤드리스 Chrome 에 연결하지 못했습니다.')

  const socket = new WebSocket(socketUrl)
  const pending = new Map()
  let nextId = 1

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)

    if (message.method) {
      onEvent(message)

      return
    }

    const entry = pending.get(message.id)

    if (!entry) return

    pending.delete(message.id)

    if (message.error) entry.reject(new Error(message.error.message))
    else entry.resolve(message.result)
  })

  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', () => reject(new Error('CDP 소켓 오류')), { once: true })
  })

  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = nextId

      nextId += 1
      pending.set(id, { resolve, reject })
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }))
    })

  return { send, close: () => socket.close() }
}

/** 브라우저에서 올라온 오류 (스크롤 중 터지는 예외 확인) */
const exceptions = []
const consoleErrors = []
const browser = await attachBrowser((message) => {
  if (message.method === 'Runtime.exceptionThrown') {
    const details = message.params.exceptionDetails

    exceptions.push(details.exception?.description ?? details.text)
  }

  // React 개발 모드 경고 등도 여기로 올라옵니다 — 참고용으로만 모읍니다.
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
    consoleErrors.push(message.params.args.map((item) => item.description ?? item.value).join(' '))
  }
})

const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' })
const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true })
const send = (method, params) => browser.send(method, params, sessionId)

await send('Page.enable')
await send('Runtime.enable')

// 뷰포트 크기 (--width/--height/--mobile) — CSS 미디어 쿼리가 이 폭을 봅니다.
await send('Emulation.setDeviceMetricsOverride', {
  width: VIEW_WIDTH,
  height: VIEW_HEIGHT,
  deviceScaleFactor: MOBILE ? 2 : 1,
  mobile: MOBILE,
})

/** 페이지에서 식을 실행하고 값을 돌려받습니다. */
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  })

  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
  }

  return result.result.value
}

async function waitFor(expression, timeout = 8000) {
  const deadline = Date.now() + timeout

  while (Date.now() < deadline) {
    try {
      if (await evaluate(expression)) return true
    } catch {
      // 아직 문서가 바뀌는 중
    }

    await sleep(100)
  }

  return false
}

const shutdown = () => {
  browser.close()
  stopBrowser()
}

/** 화면을 한 장 저장합니다. */
async function captureScreenshot(file) {
  const { data } = await send('Page.captureScreenshot', { format: 'png' })

  writeFileSync(file, Buffer.from(data, 'base64'))
  console.log(`스크린샷: ${file}`)
}

/** .env 형태 파일을 읽습니다. (값을 그대로 출력하지는 않습니다) */
function readEnvFile(file) {
  const map = {}

  if (!existsSync(file)) return map

  for (const line of readFileSync(file, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith('#')) continue

    const eq = trimmed.indexOf('=')

    if (eq <= 0) continue

    map[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
  }

  return map
}

/**
 * 관리자 화면을 보기 위해 로그인 토큰을 브라우저 저장소에 넣습니다.
 * 자격증명은 apps/.env.test.local 에서 읽으므로 명령줄에 남지 않습니다.
 */
async function signIn() {
  const envDir = join(import.meta.dirname, '..')
  const local = readEnvFile(join(envDir, '.env.test.local'))
  const devEnv = readEnvFile(join(envDir, '.env.development.local'))

  // 개발 서버가 쓰는 API 주소 (운영 빌드면 같은 출처의 /backend)
  const api = String(devEnv.VITE_API_BASE ?? '/backend').replace(/\/+$/, '')
  const apiUrl = api.startsWith('http') ? api : `${BASE}${api}`

  const res = await fetch(`${apiUrl}/api/auth/login.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ id: local.NOTICE_TEST_ID ?? '', password: local.NOTICE_TEST_PW ?? '' }),
    signal: AbortSignal.timeout(15000),
  })

  const json = await res.json().catch(() => null)

  if (!json?.data?.token) {
    throw new Error(`관리자 로그인에 실패했습니다. (HTTP ${res.status} ${json?.message ?? ''})`)
  }

  const auth = {
    accessToken: json.data.token,
    expiresAt: json.data.expiresAt ?? null,
    user: json.data.user,
  }

  // 앱과 같은 출처에서 저장소를 채운 뒤 대상 페이지로 이동해야 합니다.
  await send('Page.navigate', { url: `${BASE}/` })
  await waitFor("!!document.querySelector('.app-shell')")
  await evaluate(`localStorage.setItem('galleryis.admin.auth', ${JSON.stringify(JSON.stringify(auth))})`)

  console.log(`관리자 로그인 완료 (${auth.user?.id ?? '?'}) — 브라우저 저장소에 토큰을 넣었습니다.`)
}

if (LOGIN) await signIn()

/* --eval "식" — 페이지에서 식을 하나 실행하고 값만 보고 끝냅니다 (디버깅용) */
if (EVAL) {
  await send('Page.navigate', { url: urlFor(PATH_ARG) })
  await waitFor("!!document.querySelector('.app-shell') || !!document.body")
  await sleep(2500)

  console.log(JSON.stringify(await evaluate(EVAL), null, 2))
  shutdown()
  process.exit(0)
}

/* --shot 결과.png — 화면을 찍고 바로 끝냅니다 (보통 --path 와 함께) */
if (SHOT) {
  await send('Page.navigate', { url: urlFor(PATH_ARG) })
  await waitFor("!!document.querySelector('.app-shell') || !!document.body")
  await sleep(2500)

  // 팝업이 화면을 가리면 확인이 어려우니 닫아 둡니다.
  await evaluate("document.querySelector('.popup_close_btn')?.click()")
  await sleep(300)

  // --click "선택자" — 눌러서 펼친 상태를 찍습니다.
  if (CLICK) {
    await evaluate(`document.querySelector(${JSON.stringify(CLICK)})?.click()`)
    await sleep(600)
  }

  await captureScreenshot(SHOT)

  await scrollTo(
    await evaluate(
      `(document.documentElement.scrollHeight - window.innerHeight) * ${Number(arg('--ratio', 0.45))}`,
    ),
  )
  // 지연 로딩(loading=lazy) 이미지와 progressive JPEG 이 다 그려질 때까지
  await sleep(2500)
  await captureScreenshot(SHOT.replace(/\.png$/i, '-scrolled.png'))

  shutdown()
  process.exit(0)
}

/* --------------------------------------------------------------------------
 * 페이지 안에서 도는 점검식
 *
 * GSAP 이 걸어 둔 요소는 인라인 opacity 를 갖습니다(autoAlpha).
 * 화면에 들어왔는데(opacity 기준선 위) 숨겨져 있으면 위반입니다.
 * ------------------------------------------------------------------------ */
const auditExpression = `(() => {
  const vh = window.innerHeight
  const border = vh * ${START_RATIO}

  const path = (el) => {
    const parts = []
    let node = el

    while (node && node !== document.body && parts.length < 4) {
      const cls = [...node.classList].slice(0, 2).join('.')
      parts.unshift(node.tagName.toLowerCase() + (cls ? '.' + cls : ''))
      node = node.parentElement
    }

    return parts.join(' > ')
  }

  const animated = [...document.querySelectorAll('*')].filter((el) => el.style.opacity !== '')
  const inViewHidden = []
  let hiddenOutside = 0

  for (const el of animated) {
    const rect = el.getBoundingClientRect()
    const onScreen = rect.width > 0 && rect.bottom > 0 && rect.top < border
    const hidden = Number(el.style.opacity) < 0.05 || el.style.visibility === 'hidden'

    if (!hidden) continue

    if (onScreen) inViewHidden.push(path(el))
    else hiddenOutside += 1
  }

  return {
    animated: animated.length,
    hiddenOutside,
    inViewHidden,
    scrollY: Math.round(window.scrollY),
    maxScroll: Math.round(document.documentElement.scrollHeight - vh),
  }
})()`

/** 요소의 문서 기준 위치 */
const offsetOf = (selector) =>
  evaluate(
    `(() => { const el = document.querySelector('${selector}'); return el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : -1 })()`,
  )

/** 특정 요소가 지금 보이는지 (불투명 + 화면 안) */
const visibleNow = (selector) =>
  evaluate(`(() => {
    const el = document.querySelector('${selector}')
    if (!el) return null

    const rect = el.getBoundingClientRect()

    return {
      opacity: Number(el.style.opacity === '' ? 1 : el.style.opacity),
      onScreen: rect.bottom > 0 && rect.top < window.innerHeight,
    }
  })()`)

async function scrollTo(y) {
  await evaluate(`window.scrollTo(0, ${Math.round(y)})`)
  // 등장 애니메이션(0.9s)이 끝난 뒤에 봅니다.
  await sleep(1150)
}

/* --------------------------------------------------------------------------
 * 점검
 * ------------------------------------------------------------------------ */
const failures = []
const rows = []

async function checkPage(path) {
  await send('Page.navigate', { url: `${BASE}${path}` })

  const mounted = await waitFor("location.pathname === '" + path + "' && !!document.querySelector('.app-shell')")

  if (!mounted) {
    rows.push([path, '—', '—', '페이지가 뜨지 않음'])
    failures.push(`${path} — 페이지를 열지 못했습니다.`)
    return
  }

  // 폰트 · 목록(API)까지 붙고 ScrollTrigger 가 자리를 잡을 때까지
  await sleep(1000)

  const seed = await evaluate('Math.round(document.documentElement.scrollHeight - window.innerHeight)')
  const maxScroll = Math.max(seed, 0)
  const positions = [...new Set([0, 0.25, 0.5, 0.75, 1].map((ratio) => Math.round(maxScroll * ratio)))]

  let animated = 0
  let everHiddenOutside = 0
  const violations = []

  for (const y of positions) {
    await scrollTo(y)

    const audit = await evaluate(auditExpression)

    animated = Math.max(animated, audit.animated)
    everHiddenOutside += audit.hiddenOutside

    for (const element of audit.inViewHidden) violations.push(`y=${audit.scrollY} ${element}`)
  }

  rows.push([
    path,
    animated,
    everHiddenOutside > 0 ? `있음 (${everHiddenOutside})` : '없음',
    violations.length === 0 ? '통과' : `가려진 채 남음 ${violations.length}건`,
  ])

  if (violations.length > 0) {
    failures.push(`${path} — 화면에 들어왔는데 숨겨진 요소\n      ${violations.slice(0, DEBUG ? violations.length : 5).join('\n      ')}`)
  }

  if (animated === 0) failures.push(`${path} — 등장 대상이 하나도 없습니다 (훅이 안 걸렸을 수 있음)`)
  if (everHiddenOutside === 0 && maxScroll > 800) failures.push(`${path} — 화면 밖 요소가 모두 보입니다 (효과가 안 걸렸을 수 있음)`)
}

for (const path of ['/', '/exhibitions', '/notices', '/rental', '/about', '/privacy']) {
  await checkPage(path)
}

/* 스크롤을 되돌리면 다시 사라지는지 (전시 카드 기준) ---------------------- */
await send('Page.navigate', { url: `${BASE}/` })
await waitFor("!!document.querySelector('.app-shell')")
await sleep(1200)

const gridTop = await offsetOf('.exhibition-grid')
/** 묶음 규칙은 컨테이너가 아니라 자식 카드에 걸립니다. */
const CARD = '.exhibition-grid > *'

if (gridTop < 0) {
  rows.push(['/ (되돌림)', '—', '—', '건너뜀 (전시 카드 없음)'])
} else {
  await scrollTo(gridTop - 200)

  const shown = await visibleNow(CARD)

  await scrollTo(Math.max(gridTop - (await evaluate('window.innerHeight')) + 40, 0))

  const hiddenAgain = await visibleNow(CARD)

  const ok = shown?.onScreen && shown.opacity > 0.9 && hiddenAgain?.opacity < 0.05

  rows.push([
    '/ (되돌림)',
    '—',
    '—',
    ok ? '통과' : `등장 ${shown?.opacity} → 되돌림 ${hiddenAgain?.opacity}`,
  ])

  if (!ok) {
    failures.push(
      `/ — 스크롤 되돌림 동작이 어긋납니다 (등장 opacity ${shown?.opacity}, 되돌림 opacity ${hiddenAgain?.opacity})`,
    )
  }
}

/* 모션 줄이기(prefers-reduced-motion) 에서는 아무것도 숨기지 않는지 -------- */
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
await send('Page.navigate', { url: `${BASE}/notices` })
await waitFor("!!document.querySelector('.app-shell')")
await sleep(800)

const reduced = await evaluate(auditExpression)
const reducedOk = reduced.animated === 0 && reduced.inViewHidden.length === 0

rows.push([
  '모션 줄이기',
  reduced.animated,
  '—',
  reducedOk ? '통과' : `대상 ${reduced.animated} · 가려짐 ${reduced.inViewHidden.length}`,
])

if (!reducedOk) {
  failures.push(
    `prefers-reduced-motion — 등장 효과를 끄면 안 되는데 대상 ${reduced.animated}건이 잡힘 (가려진 요소 ${reduced.inViewHidden.length}건)`,
  )
}

await send('Emulation.setEmulatedMedia', { features: [] })

/* --------------------------------------------------------------------------
 * 결과
 * ------------------------------------------------------------------------ */
console.log('')
console.log('스크롤 등장 효과 점검 (GSAP ScrollTrigger)')
console.log('='.repeat(72))

for (const [path, animated, outside, note] of rows) {
  console.log(
    `${path.padEnd(12)} 대상 ${String(animated).padStart(4)}  화면밖 숨김 ${String(outside).padEnd(12)} ${note}`,
  )
}

console.log('='.repeat(72))

if (exceptions.length > 0) {
  console.log(`브라우저 예외 ${exceptions.length}건`)
  for (const error of exceptions.slice(0, DEBUG ? exceptions.length : 3)) console.log(`  · ${error}`)
  failures.push(`브라우저에서 JS 예외가 올라왔습니다 (${exceptions.length}건)`)
}

if (consoleErrors.length > 0) {
  console.log(`(참고) console.error ${consoleErrors.length}건`)
  for (const error of consoleErrors.slice(0, DEBUG ? consoleErrors.length : 2)) console.log(`  · ${error}`)
}

if (failures.length === 0) {
  console.log('모두 통과 — 화면에 들어온 요소는 보이고, 화면을 벗어나면 다시 숨겨집니다.')
} else {
  console.log(`문제 ${failures.length}건`)
  for (const failure of failures) console.log(`  · ${failure}`)
}

shutdown()

process.exit(failures.length === 0 ? 0 : 1)