import { useEffect } from 'react'
import adminCss from '@/assets/css/admin.css?inline'
import commonCss from '@/assets/css/common.css?inline'
import editorCss from '@/assets/css/editor.css?inline'
import rentalCss from '@/assets/css/rental.css?inline'

/** Material Icons (사이드바 아이콘 리거처) — 원격이라 인라인할 수 없습니다. */
const MATERIAL_ICONS_URL =
  'https://fonts.googleapis.com/icon?family=Material+Icons&display=swap'

/**
 * 관리자 화면에서만 쓰는 스타일시트.
 *
 * 공개 사이트는 Tailwind(src/index.css)로만 그리므로, 예전 전역 리셋과
 * Pretendard 전체 글꼴(@font-face)은 여기서만 불러옵니다.
 *
 * ⚠ **CSS 를 `<link>` 로 불러오지 않고 글자 그대로 `<style>` 로 넣습니다.**
 *   예전에는 `<link href=…css>` 를 붙였는데, 그 방식은 스타일시트가 도착할
 *   때까지 첫 화면이 스타일 없이 한 번 그려집니다 — F5 로 새로고침하면 사이드바
 *   로고(워드마크, 크기는 CSS 가 정함)가 큼직하게 떴다가 작아지던 원인입니다.
 *   지금은 관리자 청크가 실행되는 순간(첫 렌더 전) 스타일이 붙어 첫 화면부터
 *   제대로 그려집니다. CSS 는 관리자 청크에만 들어가므로 공개 사이트 번들은
 *   그대로입니다. (`App.tsx` 가 AdminApp 을 lazy 로 불러 관리자 묶음을 따로 실음)
 *
 * ⚠ 순서 중요: common → admin → rental → editor (뒤로 갈수록 덮어씁니다)
 * ⚠ 부르는 곳은 **관리자 구역 전체를 감싸는 자리(AdminApp) 한 곳**입니다.
 *   화면마다 부르면 옮길 때마다 걷혔다 붙어 스타일이 잠깐 풀립니다.
 *   공개 화면으로 나가면 관리자 구역이 사라지므로 그때 함께 걷힙니다.
 */
const SHEETS: string[] = [commonCss, adminCss, rentalCss, editorCss]

const nodes: HTMLElement[] = []
let refCount = 0

/** 아직 안 붙었으면 지금 붙입니다. (여러 번 불러도 한 벌만) */
function attach() {
  if (nodes.length > 0) {
    return
  }

  for (const css of SHEETS) {
    const style = document.createElement('style')
    style.dataset.adminAsset = 'true'
    style.textContent = css
    document.head.appendChild(style)
    nodes.push(style)
  }

  // 아이콘 글꼴만 원격 파일이라 어쩔 수 없이 <link> 입니다.
  // (도착 전에는 리거처 이름이 글자로 잠깐 보일 수 있습니다)
  const icons = document.createElement('link')
  icons.rel = 'stylesheet'
  icons.href = MATERIAL_ICONS_URL
  icons.dataset.adminAsset = 'true'
  document.head.appendChild(icons)
  nodes.push(icons)
}

/** 관리자 구역에서 완전히 나갈 때 걷어냅니다. */
function detach() {
  for (const node of nodes) {
    node.remove()
  }

  nodes.length = 0
}

/**
 * 관리자 구역 전체에서 admin.css · common.css · rental.css · editor.css 를 씁니다.
 * (공개 사이트 번들에는 들어가지 않습니다 — AdminApp 이 lazy 로 실립니다)
 */
export function useAdminStyles() {
  // 렌더 중에 붙입니다 — 첫 페인트 전에 스타일이 있어야 깜빡이지 않습니다.
  // (같은 컴포넌트가 여러 번 렌더돼도 attach 는 한 번만 실행됩니다)
  attach()

  useEffect(() => {
    // StrictMode 는 effect 를 재실행하므로 여기서도 한 번 더 붙여 둡니다.
    attach()
    refCount += 1

    return () => {
      refCount -= 1

      if (refCount === 0) {
        detach()
      }
    }
  }, [])
}
