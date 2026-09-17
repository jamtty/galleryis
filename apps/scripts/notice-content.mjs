#!/usr/bin/env node
/**
 * 공지 1건의 저장된 내용을 그대로 확인하는 디버깅 도구.
 *
 *   node scripts/notice-content.mjs 131
 *
 * 레거시(그누보드) 본문이 어떻게 저장돼 있는지 볼 때 씁니다.
 * 제어문자는 눈에 보이도록 이스케이프해서 출력합니다.
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
const wrId = Number(process.argv[2] ?? 0)

/** 눈에 보이지 않는 문자를 드러내어 출력합니다. */
function visible(text) {
  return text
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n\n')
    .replace(/\t/g, '\\t')
}

async function main() {
  if (wrId <= 0) {
    console.log('사용법: node scripts/notice-content.mjs <wr_id>')
    process.exitCode = 1
    return
  }

  const id = env('NOTICE_TEST_ID')
  const pw = env('NOTICE_TEST_PW')

  const loginRes = await fetch(`${BASE}/api/auth/login.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ id, password: pw }),
  })
  const login = await loginRes.json()
  const token = login?.data?.token

  if (!token) {
    console.log(`로그인 실패: ${loginRes.status} ${login?.message ?? ''}`)
    process.exitCode = 1
    return
  }

  const res = await fetch(`${BASE}/api/notices/detail.php?id=${wrId}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  })
  const body = await res.json()

  if (!body?.data) {
    console.log(`조회 실패: ${res.status} ${body?.message ?? ''}`)
    process.exitCode = 1
    return
  }

  const item = body.data
  const content = String(item.content ?? '')

  console.log(`wr_id       : ${item.id}`)
  console.log(`제목        : ${item.title}`)
  console.log(`본문 길이   : ${content.length}자`)
  console.log(`줄바꿈(\\n)  : ${(content.match(/\n/g) ?? []).length}개`)
  console.log(`<br> 태그   : ${(content.match(/<br\s*\/?>/gi) ?? []).length}개`)
  console.log(`태그 개수   : ${(content.match(/<[a-z][^>]*>/gi) ?? []).length}개`)
  console.log(`첨부        : ${item.files?.length ?? 0}건`)
  console.log('\n--- 본문 (제어문자 표시) ---')
  console.log(visible(content))
}

main().catch((error) => {
  console.error('오류:', error)
  process.exitCode = 1
})
