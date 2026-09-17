#!/usr/bin/env node
/**
 * .env.test.local 형식 점검 — 값은 감추고 형식만 확인합니다.
 *
 *   node scripts/check-env.mjs
 *
 * 확인 항목: 길이 · 앞뒤 공백 · 공백/샵/따옴표 포함 · ASCII 여부 · 첫/끝 문자코드
 * (비밀번호 자체는 출력하지 않습니다)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const file = process.argv[2] ?? path.join(HERE, '..', '.env.test.local')

if (!fs.existsSync(file)) {
  console.log(`파일 없음: ${file}`)
  process.exitCode = 1
} else {
  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
  const lines = text.split(/\r?\n/)

  console.log(`파일: ${file}`)
  console.log(`BOM 있음: ${/^\uFEFF/.test(fs.readFileSync(file, 'utf8'))}`)
  console.log(`줄 수: ${lines.length}\n`)

  for (const key of ['NOTICE_TEST_ID', 'NOTICE_TEST_PW', 'NOTICE_TEST_BASE']) {
    const line = lines.find((l) => l.startsWith(`${key}=`))

    if (!line) {
      console.log(`${key}: 줄 없음`)
      continue
    }

    const raw = line.slice(key.length + 1)
    const value = raw.trim()

    console.log(`${key}:`)
    console.log(`  길이 ${value.length} (앞뒤 공백 ${raw !== value ? '있음' : '없음'})`)
    console.log(`  공백 포함 ${/\s/.test(value)} / # 포함 ${value.includes('#')} / 따옴표 포함 ${/["']/.test(value)}`)

    const asciiOnly = [...value].every((char) => {
      const code = char.codePointAt(0) ?? 0

      return code >= 0x20 && code <= 0x7e
    })

    console.log(`  ASCII 전용 ${asciiOnly} / 비ASCII 포함 ${!asciiOnly}`)
    console.log(
      `  첫 문자코드 ${value.charCodeAt(0)} / 끝 문자코드 ${value.charCodeAt(value.length - 1)}`,
    )
  }
}
