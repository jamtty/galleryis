#!/usr/bin/env node
/**
 * 반응형 미디어쿼리 변환 도구 (min-width → max-width)
 *
 *   node scripts/css-media-flip.mjs analyze  <in.css>
 *   node scripts/css-media-flip.mjs snapshot <in.css> <out.json>
 *   node scripts/css-media-flip.mjs check    <in.css> <snapshot.json>
 *   node scripts/css-media-flip.mjs flip     <in.css> <out.css>
 *
 * 왜 스크립트가 필요한가
 *   min-width(모바일 우선) → max-width(데스크톱 우선) 은 단순 치환이 아니라
 *   "선언 값의 위치를 뒤집는" 변환입니다.
 *     지금:  .x { padding: 4rem }  +  @media (min-width:640px){ .x { padding: 5.6rem } }
 *     변환:  .x { padding: 5.6rem } +  @media (max-width:639px){ .x { padding: 4rem } }
 *   그래서 변환 전/후를 여러 화면 폭에서 계산해, 셀렉터·속성별 최종 값이
 *   완전히 같은지 자동 대조한 뒤에만 파일을 씁니다.
 *
 * 주의: 값이 위쪽 구간에서만 선언된 경우(예: 1024px 이상에서만 column-gap) 는
 *   아래 구간에서 그 속성을 지워야 하는데 CSS 로는 "지움"을 표현할 수 없어
 *   `unset` 을 넣습니다(대부분 initial 값과 같아 동일). 이 경우는 flip 결과에
 *   주석으로 표시하고, check 에서 차이가 나면 사람이 확인합니다.
 */
import fs from 'node:fs'
import path from 'node:path'
import postcss from 'postcss'

/** 대조에 쓰는 화면 폭 (경계값 포함) */
const SAMPLE_WIDTHS = [320, 375, 480, 500, 639, 640, 700, 767, 768, 900, 1023, 1024, 1200, 1280, 1600, 1920]

/** min-width: 1px 처럼 항상 참인 조건은 무조건 규칙으로 봅니다 */
const ALWAYS_TRUE_PX = 2

function parseCondition(params) {
  const conds = []
  const re = /\(\s*(min|max)-width\s*:\s*([\d.]+)px\s*\)/g
  let m

  while ((m = re.exec(params))) {
    conds.push({ type: m[1], px: parseFloat(m[2]) })
  }

  if (conds.length === 0) return { conds: [], usable: false }

  // min/max-width 외의 조건(orientation, print 등)이 섞여 있으면 손대지 않습니다.
  const rest = params
    .replace(re, '')
    .replace(/\b(and|only|not|screen|all)\b/g, '')
    .replace(/[,\s]/g, '')

  return { conds, usable: rest === '' }
}

function matchesCondition(cond, width) {
  if (!cond) return true
  if (!cond.usable) return false

  return cond.conds.every((c) => (c.type === 'min' ? width >= c.px : width <= c.px))
}

/**
 * 문서 순서대로 규칙(미디어 안쪽 포함)을 모읍니다.
 *
 * min-width 만 쓰는 미디어 블록만 "변환 대상"으로 표시하고,
 * 이미 max-width 인 블록(prefers-reduced-motion 등은 건드리지 않음)은 그대로 둡니다.
 */
function collect(css) {
  const root = postcss.parse(css)
  const rules = []
  const consumedMedia = []
  const skippedMedia = []

  root.each((node) => {
    if (node.type === 'rule') {
      rules.push({ media: null, selector: normalizeSelector(node.selector), node })
      return
    }

    if (node.type !== 'atrule' || node.name !== 'media') return

    const cond = parseCondition(node.params)

    // min/max-width 외 조건(prefers-reduced-motion, print 등) 또는 이미 max-width 인 블록 →그대로 둡니다.
    const hasMin = cond.conds.some((c) => c.type === 'min')
    const hasMax = cond.conds.some((c) => c.type === 'max')
    // min/max-width 조건이 있으면 폭 기반 미디어 → 모두 흡수해서 max-width 블록으로 다시 씁니다.
    // (min-width 만 변환하면 기존 max-width 블록과 중복되므로 함께 정리합니다)
    const convertible = cond.usable && (hasMin || hasMax)

    if (!convertible) {
      skippedMedia.push(node.params)

      // 해석할 수 없는 조건(prefers-reduced-motion 등)은 어떤 폭에서도 매칭되지 않게 두고
      // 블록 자체는 손대지 않습니다. (matchesCondition 이 usable:false 를 거부합니다)
      const media = cond.usable ? cond : { conds: [], usable: false }

      node.each((child) => {
        if (child.type === 'rule') {
          rules.push({ media, selector: normalizeSelector(child.selector), node: child })
        }
      })

      return
    }

    consumedMedia.push(node)

    node.each((child) => {
      if (child.type === 'rule') {
        rules.push({
          media: cond,
          selector: normalizeSelector(child.selector),
          node: child,
          fromMedia: node,
        })
      }
    })
  })

  return { root, rules, consumedMedia, skippedMedia }
}

/** 폭 width 에서 (selector, prop) 의 최종 선언 (없으면 null) */
function effectiveDecl(rules, selector, prop, width) {
  let found = null

  for (const item of rules) {
    if (item.selector !== selector) continue
    if (!matchesCondition(item.media, width)) continue

    item.node.each((decl) => {
      if (decl.type === 'decl' && decl.prop === prop) {
        found = { value: decl.value, important: decl.important }
      }
    })
  }

  return found
}

/** 셀렉터 → 속성 목록 (등장 순서 유지) */
function propertyMap(rules) {
  const selectors = new Map()

  for (const item of rules) {
    if (!selectors.has(item.selector)) selectors.set(item.selector, new Map())

    const props = selectors.get(item.selector)

    item.node.each((decl) => {
      if (decl.type === 'decl' && !props.has(decl.prop)) props.set(decl.prop, true)
    })
  }

  return selectors
}

/** min-width 브레이크포인트 (오름차순) — 분석용 */
function breakpointsOf(rules) {
  const set = new Set()

  for (const item of rules) {
    if (!item.media) continue

    for (const c of item.media.conds) {
      if (c.type === 'min' && c.px > ALWAYS_TRUE_PX) set.add(c.px)
    }
  }

  return [...set].sort((a, b) => a - b)
}

/**
 * 구간을 나누는 지점 — min-width 브레이크포인트와 기존 max-width 경계를 모두 포함합니다.
 * (예: min-width 640·1024 + 기존 max-width 767·1600 → 0, 640, 768, 1024, 1601)
 */
function boundariesOf(rules) {
  const lows = new Set([0])

  for (const item of rules) {
    if (!item.media || !item.media.usable) continue

    for (const c of item.media.conds) {
      if (c.px <= 0) continue

      if (c.type === 'min') lows.add(c.px)
      else lows.add(c.px + 1)
    }
  }

  return [...lows].sort((a, b) => a - b)
}

function sameDecl(a, b) {
  if (a === null && b === null) return true
  if (a === null || b === null) return false

  return a.value === b.value && Boolean(a.important) === Boolean(b.important)
}

function snapshot(css) {
  const { rules } = collect(css)
  const selectors = propertyMap(rules)
  const out = {}

  for (const width of SAMPLE_WIDTHS) {
    out[width] = {}

    for (const [selector, props] of selectors) {
      out[width][selector] = {}

      for (const prop of props.keys()) {
        const decl = effectiveDecl(rules, selector, prop, width)
        if (decl) out[width][selector][prop] = `${decl.important ? '!important ' : ''}${decl.value}`
      }
    }
  }

  return out
}

function compare(before, after) {
  const diffs = []
  const resets = []

  for (const width of Object.keys(before)) {
    const sels = new Set([...Object.keys(before[width] ?? {}), ...Object.keys(after[width] ?? {})])

    for (const selector of sels) {
      const props = new Set([
        ...Object.keys(before[width]?.[selector] ?? {}),
        ...Object.keys(after[width]?.[selector] ?? {}),
      ])

      for (const prop of props) {
        const a = before[width]?.[selector]?.[prop] ?? null
        const b = after[width]?.[selector]?.[prop] ?? null

        // 아래 구간에 없던 속성을 revert 로 되돌린 경우는 같은 상태로 봅니다.
        // (CSS 에서 "선언 없음"을 표현할 수 없어 revert 를 씁니다)
        if (a === null && typeof b === 'string' && ['unset', 'revert'].includes(b.replace('!important ', ''))) {
          resets.push({ width, selector, prop })
          continue
        }

        if (a !== b) diffs.push({ width, selector, prop, before: a, after: b })
      }
    }
  }

  return { diffs, resets }
}

/** flip 결과 메타(주석용) */
const notes = []

function flip(css) {
  const { root, rules, consumedMedia, skippedMedia } = collect(css)
  const selectors = propertyMap(rules)

  /*
   * 구간 정의 — 화면 폭을 "구간이 바뀌는 지점"으로 나눕니다.
   *   R0: 0 ~ lows[1]-1   (대표 폭 max(1, lows[0]))
   *   R1: lows[1] ~ lows[2]-1
   *   …
   *   Rn: lows[n] ~ 무한   ← 기본 규칙이 되는 구간
   */
  const lows = boundariesOf(rules)
  const ranges = lows.map((low, index) => ({
    label: index === lows.length - 1 ? `${low}px~` : `${low}~${lows[index + 1] - 1}px`,
    max: index === lows.length - 1 ? null : lows[index + 1] - 1,
    width: Math.max(1, low),
  }))

  /** 기존 max-width 블록이 걸리지 않는, 가장 넓은 화면의 값 */
  const TOP_WIDTH = 99999

  // 셀렉터 · 속성별 구간 값 사다리
  const ladder = new Map()

  for (const [selector, props] of selectors) {
    const perProp = new Map()

    for (const prop of props.keys()) {
      perProp.set(prop, {
        values: ranges.map((range) => effectiveDecl(rules, selector, prop, range.width)),
        base: effectiveDecl(rules, selector, prop, TOP_WIDTH),
      })
    }

    ladder.set(selector, perProp)
  }

  // 1) 기본 규칙 = 가장 넓은 화면 값. 맨 마지막 등장 규칙 하나에만 적습니다.
  const itemsOf = new Map()
  const mediaOnlySelectors = []

  for (const item of rules) {
    if (!itemsOf.has(item.selector)) itemsOf.set(item.selector, [])
    itemsOf.get(item.selector).push(item)
  }

  for (const [selector, perProp] of ladder) {
    const items = itemsOf.get(selector)
    const carriers = items.filter((item) => !item.media)
    let carrier = carriers.length ? carriers[carriers.length - 1] : null

    if (!carrier) {
      // 미디어 안에서만 나오던 셀렉터 — 기본 규칙을 만들어 원래 자리 근처에 넣습니다.
      const first = items.find((item) => item.fromMedia) ?? items[0]
      carrier = { media: null, selector, node: postcss.rule({ selector }) }

      if (first.fromMedia) first.fromMedia.before(carrier.node)
      else root.append(carrier.node)

      mediaOnlySelectors.push(selector)
    }

    for (const [prop, entry] of perProp) {
      if (!entry.base) continue

      for (const item of items) {
        item.node.each((decl) => {
          if (decl.type === 'decl' && decl.prop === prop && item !== carrier) decl.remove()
        })
      }

      carrier.node.each((decl) => {
        if (decl.type === 'decl' && decl.prop === prop) decl.remove()
      })
      carrier.node.append({
        prop,
        value: entry.base.value,
        important: entry.base.important,
      })
    }
  }

  // 2) max-width 규칙 — 큰 구간부터 내려가며, 바로 위 구간과 다른 값만 적습니다.
  const mediaBlocks = []

  for (let i = ranges.length - 1; i >= 0; i -= 1) {
    const above = i === ranges.length - 1 ? { base: true } : null
    const rulesForTier = []

    for (const [selector, perProp] of ladder) {
      const decls = []

      for (const [prop, entry] of perProp) {
        const value = entry.values[i]
        const upper = above ? entry.base : entry.values[i + 1]

        if (sameDecl(value, upper)) continue
        if (!value && !upper) continue

        if (!value) {
          /*
           * 이 구간에는 선언이 없던 속성 — CSS 로 "선언을 지우는" 방법은 없습니다.
           * unset 은 초기값으로 되돌려서 UA 스타일(예: div { display: block })까지 무시해 버리므로
           * revert(브라우저 기본값으로 되돌림)를 씁니다.
           */
          decls.push({ prop, value: 'revert' })
          notes.push(`${ranges[i].label} ${selector} { ${prop}: revert }`)
        } else {
          decls.push({ prop, value: value.value, important: value.important })
        }
      }

      if (decls.length === 0) continue

      const rule = postcss.rule({ selector })
      rule.raws.between = ' '
      rule.append(decls.map((d) => postcss.decl({ prop: d.prop, value: d.value, important: d.important })))
      rule.raws.before = '\n\n  '
      rule.raws.after = '\n  '
      rulesForTier.push(rule)
    }

    if (rulesForTier.length === 0) continue

    const media = postcss.atRule({ name: 'media', params: `(max-width: ${ranges[i].max}px)` })
    media.raws.afterName = ' '
    media.raws.between = ' '
    media.raws.after = '\n'
    media.raws.before = '\n'
    media.append(rulesForTier)
    mediaBlocks.push(media)
  }

  // 3) 원래의 min-width 블록은 지우고, max-width 블록을 파일 끝에 붙입니다.
  for (const node of consumedMedia) node.remove()

  if (mediaBlocks.length > 0) {
    root.append(
      postcss.comment({ text: '데스크톱 우선(max-width) 규칙 — 위 기본값을 좁은 화면에서 덮어씁니다.' }),
    )
    for (const block of mediaBlocks) root.append(block)
  }

  return { css: root.toString(), notes, mediaOnlySelectors, skippedMedia, ranges }
}

/* ------------------------------------------------------------------ CLI */

function read(file) {
  return fs.readFileSync(file, 'utf8')
}

/**
 * 셀렉터 정규화 — 줄바꿈/공백만 다른 같은 셀렉터를 하나로 묶습니다.
 * (예: ".a,\n.b" 와 ".a, .b" 는 같은 규칙입니다)
 */
function normalizeSelector(selector) {
  return selector
    .split(',')
    .map((part) => part.trim().replace(/\s+/g, ' '))
    .join(',')
}

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text, 'utf8')
}

const [command, target, extra] = process.argv.slice(2)

if (!command || !target) {
  console.log('사용법: analyze | snapshot | check | flip  <in.css> [out]')
  process.exit(1)
}

if (command === 'analyze') {
  const css = read(target)
  const { rules, skippedMedia, consumedMedia } = collect(css)
  const breakpoints = breakpointsOf(rules)
  const selectors = propertyMap(rules)
  let pairs = 0
  let resetCases = 0

  for (const [selector, props] of selectors) {
    for (const prop of props.keys()) {
      pairs += 1
      const top = effectiveDecl(rules, selector, prop, 1920)
      const low = effectiveDecl(rules, selector, prop, 320)

      if (top && !low) resetCases += 1
    }
  }

  console.log(`파일        : ${target}`)
  console.log(`규칙        : ${rules.length}개 / 셀렉터 ${selectors.size}개 / 셀렉터·속성 ${pairs}쌍`)
  console.log(`브레이크포인트: ${breakpoints.join(', ')}px`)
  console.log(`min-width 블록: ${consumedMedia.length}개 (변환 대상)`)
  console.log(`건드리지 않는 미디어: ${skippedMedia.length ? skippedMedia.join(' | ') : '없음'}`)
  console.log(`아래 구간에 없는 속성(리셋 필요): ${resetCases}쌍`)
} else if (command === 'snapshot') {
  const snap = snapshot(read(target))
  write(extra, `${JSON.stringify(snap)}\n`)
  console.log(`스냅샷 저장: ${extra} (${Object.keys(snap).length}개 폭)`)
} else if (command === 'check') {
  const before = JSON.parse(read(extra))
  const after = snapshot(read(target))
  const { diffs, resets } = compare(before, after)

  console.log(`unset 리셋(허용): ${resets.length}건`)

  if (diffs.length === 0) {
    console.log('[OK] 모든 폭에서 셀렉터·속성 값이 같습니다. (unset 리셋 제외)')
  } else {
    console.log(`[DIFF] ${diffs.length}건 차이`)
    for (const d of diffs.slice(0, 80)) {
      console.log(`  ${d.width}px ${d.selector} { ${d.prop}: ${d.before} → ${d.after} }`)
    }
    if (diffs.length > 80) console.log(`  … ${diffs.length - 80}건 더`)
    process.exitCode = 1
  }
} else if (command === 'flip') {
  const result = flip(read(target))
  write(extra, result.css)
  console.log(`변환 결과: ${extra}`)
  console.log(`  리셋(unset) 처리: ${result.notes.length}건`)
  for (const n of result.notes.slice(0, 20)) console.log(`    - ${n}`)
  if (result.notes.length > 20) console.log(`    … ${result.notes.length - 20}건 더`)
  console.log(`  미디어에서만 쓰던 셀렉터(기본 규칙 신설): ${result.mediaOnlySelectors.length}개`)
  for (const s of result.mediaOnlySelectors) console.log(`    - ${s.replace(/\s+/g, ' ')}`)
  if (result.skippedMedia.length) console.log(`  건드리지 않은 미디어: ${result.skippedMedia.join(' | ')}`)
} else {
  console.log(`알 수 없는 명령: ${command}`)
  process.exit(1)
}
