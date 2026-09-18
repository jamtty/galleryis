#!/usr/bin/env node
/**
 * 원본 사이트의 전시장 자료를 내려받아 `uploads/hall/` 에 넣습니다. (일회성 이관용)
 *
 *   node scripts/hall-assets-import.mjs            없는 파일만 받기
 *   node scripts/hall-assets-import.mjs --force    이미 있어도 다시 받기
 *
 * 받는 것 (모두 40장)
 *   · 도면·조감도  hall1-sheet.jpg ~ hall4-sheet.jpg   ← galleryis.web.app/hall-sheets/
 *   · 도면 파일    hall1-plan.jpg  ~ hall4-plan.jpg    ← galleryis.web.app/floorplans/  (내려받기용)
 *   · 전시장 사진  hall1-photo-01.jpg ~ 08.jpg (4개 전시장 × 8장) ← galleryis-media(GCS)
 *
 * ⚠ 내려받은 파일은 **서버 uploads/hall/ 에도 올려야** 공개 사이트에서 보입니다.
 *    SFTP `uploads` 프로필은 자동 업로드가 꺼져 있으니 `SFTP: Sync Local -> Remote` 로 한 번 올려 주세요.
 *    (DB 에는 backend/sql/hall.sql 의 INSERT 가 같은 파일명으로 들어가 있습니다)
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const HERE = import.meta.dirname
const OUT_DIR = join(HERE, '..', '..', 'uploads', 'hall')
const FORCE = process.argv.includes('--force')
const TIMEOUT_MS = 20000

/** 원본 SPA 호스트 (도면) */
const SPA = 'https://galleryis.web.app'
/** 원본 이미지 저장소 (사진) */
const MEDIA = 'https://storage.googleapis.com/galleryis-media'

/** 전시장별 사진 파일명 (원본 그대로 — 앞 4장은 층 사진, 뒤 4장은 전시 사진) */
const HALLS = [
  { key: 'hall1', photos: ['galleryis_1F_01', 'galleryis_1F_02', 'galleryis_1F_03', 'galleryis_1F_04', '1-1', '1-2', '1-3', '1-4'] },
  { key: 'hall2', photos: ['galleryis_2F_01', 'galleryis_2F_02', 'galleryis_2F_03', 'galleryis_2F_04', '2-1', '2-2', '2-3', '2-4'] },
  { key: 'hall3', photos: ['galleryis_3F_01', 'galleryis_3F_02', 'galleryis_3F_03', 'galleryis_3F_04', '3-1', '3-2', '3-3', '3-4'] },
  { key: 'hall4', photos: ['galleryis_B1_01', 'galleryis_B1_02', 'galleryis_B1_03', 'galleryis_B1_04', 'b-1', 'b-2', 'b-3', 'b-4'] },
]

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function step(text) {
  process.stderr.write(`${text}\n`)
}

/** 응답이 없으면 새 연결로 다시 시도합니다. (이 호스팅은 연속 요청에 약합니다) */
async function fetchOnce(url, attempt = 0) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    return Buffer.from(await res.arrayBuffer())
  } catch (error) {
    if (attempt >= 3) throw error

    step(`      (재시도 ${attempt + 1}/3 — ${error instanceof Error ? error.message : error})`)

    await sleep(400)

    return fetchOnce(url, attempt + 1)
  }
}

const done = []
const failed = []

async function save(name, url) {
  const file = join(OUT_DIR, name)

  if (!FORCE && existsSync(file)) {
    step(`   건너뜀 ${name} (이미 있음)`)

    return
  }

  try {
    const buffer = await fetchOnce(url)

    writeFileSync(file, buffer)
    done.push(`${name} (${Math.round(buffer.length / 1024)}KB)`)
    step(`   받음   ${name} (${Math.round(buffer.length / 1024)}KB)`)
  } catch (error) {
    failed.push(`${name} — ${error instanceof Error ? error.message : error}`)
    step(`   실패   ${name}`)
  }
}

mkdirSync(OUT_DIR, { recursive: true })

step(`대상 폴더: ${OUT_DIR}`)

for (const hall of HALLS) {
  step(`[${hall.key}]`)

  await save(`${hall.key}-sheet.jpg`, `${SPA}/hall-sheets/${hall.key}.jpg`)
  await save(`${hall.key}-plan.jpg`, `${SPA}/floorplans/${hall.key}.jpg`)

  for (const [index, name] of hall.photos.entries()) {
    const number = String(index + 1).padStart(2, '0')

    await save(`${hall.key}-photo-${number}.jpg`, `${MEDIA}/halls/${hall.key}/photos/${name}.jpg`)
  }
}

console.log('')
console.log(`받은 파일 ${done.length}개 · 실패 ${failed.length}개 → ${OUT_DIR}`)

for (const name of done) console.log(`   · ${name}`)

if (failed.length > 0) {
  console.log('실패 목록')
  for (const item of failed) console.log(`   · ${item}`)
}

console.log('')
console.log('서버에 올리려면: VS Code 명령 팔레트 → SFTP: Sync Local -> Remote (uploads 프로필)')
