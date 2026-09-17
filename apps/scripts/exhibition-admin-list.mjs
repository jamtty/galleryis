#!/usr/bin/env node
/**
 * 관리자 전시 목록을 그대로 출력합니다. (점검·정리용)
 *
 *   node scripts/exhibition-admin-list.mjs        목록
 *   node scripts/exhibition-admin-list.mjs 3     3번 전시 상세(첨부 포함)
 *
 * 자격증명은 apps/.env.test.local 을 씁니다.
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

const login = await fetch(`${BASE}/api/auth/login.php`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify({ id: env('NOTICE_TEST_ID'), password: env('NOTICE_TEST_PW') }),
  signal: AbortSignal.timeout(15000),
}).then((res) => res.json())

const token = login?.data?.token
const args = process.argv.slice(2)
const detailId = Number(args[0] ?? 0)

if (!token) {
  console.log(`로그인 실패: ${login?.message ?? ''}`)
  process.exitCode = 1
} else if (detailId > 0) {
  const res = await fetch(`${BASE}/api/exhibitions/detail.php?id=${detailId}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  })
  const body = await res.json()
  const item = body?.data

  if (!item) {
    console.log(`조회 실패: ${body?.message ?? res.status}`)
  } else {
    console.log(`id=${item.id} | ${item.useYn} | ${item.title}`)
    console.log(`  ${item.artist} / ${item.place} / ${item.startDate} ~ ${item.endDate}`)
    console.log(`  개요 ${String(item.overview ?? '').length}자 / 약력 ${String(item.bio ?? '').length}자`)
    console.log(`  첨부 ${(item.files ?? []).length}건`)

    for (const file of item.files ?? []) {
      let status = '접근 실패'

      try {
        const head = await fetch(file.url, { method: 'HEAD', signal: AbortSignal.timeout(15000) })

        status = `${head.status} ${head.headers.get('content-type') ?? ''}`
      } catch (error) {
        status = `오류: ${error instanceof Error ? error.message : error}`
      }

      console.log(`    · ${file.name} → ${file.url.split('/').pop()} : ${status}`)
    }
  }
} else {
  const res = await fetch(`${BASE}/api/exhibitions/list.php?page=1&size=50`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  })
  const body = await res.json()
  const items = body?.data?.items ?? []

  console.log(`관리자 전시 목록 — 총 ${body?.data?.totalCount ?? 0}건\n`)

  for (const item of items) {
    console.log(
      `  ${String(item.id).padStart(3)} | ${item.useYn} | ${item.statusLabel} | ${item.title} | ${item.startDate} ~ ${item.endDate}`,
    )
  }
}
