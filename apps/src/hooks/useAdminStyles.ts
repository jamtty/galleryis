import { useEffect } from 'react'
import adminCssUrl from '@/assets/css/admin.css?url'
import commonCssUrl from '@/assets/css/common.css?url'
import editorCssUrl from '@/assets/css/editor.css?url'
import rentalCssUrl from '@/assets/css/rental.css?url'

/** Material Icons (사이드바 아이콘 리거처) */
const MATERIAL_ICONS_URL =
  'https://fonts.googleapis.com/icon?family=Material+Icons&display=swap'

/**
 * 관리자 화면에서만 쓰는 스타일시트.
 *
 * 공개 사이트는 Tailwind(src/index.css)로만 그리므로, 예전 전역 리셋과
 * Pretendard 전체 글꼴(@font-face)은 여기서만 불러옵니다.
 * ⚠ common.css 가 먼저, admin.css 가 나중이어야 합니다. (덮어쓰는 순서)
 * rental.css 는 옛 대관 신청서 폼(.rental-* · .btn) 전용이라 admin.css 뒤에 둡니다.
 */
const MANAGED_LINKS: { href: string; rel: string }[] = [
  { href: commonCssUrl, rel: 'stylesheet' },
  { href: adminCssUrl, rel: 'stylesheet' },
  { href: rentalCssUrl, rel: 'stylesheet' },
  { href: MATERIAL_ICONS_URL, rel: 'stylesheet' },
]

const links = new Map<string, HTMLLinkElement>()
let refCount = 0

/** 에디터(editor.css) 는 관리자 화면 중 전시 등록에서만 씁니다. */
const editorLinks = new Map<string, HTMLLinkElement>()
let editorRefCount = 0

/**
 * 관리자 화면에서만 admin.css 와 Material Icons 를 불러옵니다.
 * 공개 사이트 번들에는 포함되지 않도록 런타임에 주입합니다.
 */
export function useAdminStyles() {
  useEffect(() => {
    if (refCount === 0) {
      for (const { href, rel } of MANAGED_LINKS) {
        const el = document.createElement('link')
        el.rel = rel
        el.href = href
        el.dataset.adminAsset = 'true'
        document.head.appendChild(el)
        links.set(href, el)
      }
    }

    refCount += 1

    return () => {
      refCount -= 1
      if (refCount > 0) return

      for (const el of links.values()) el.remove()
      links.clear()
    }
  }, [])
}

/**
 * 에디터 화면에서만 editor.css 를 불러옵니다.
 *
 * 공개 사이트 번들에 포함되지 않도록 런타임에 주입합니다.
 * (전시 등록의 첨부파일 목록 스타일도 이 파일에 있습니다)
 */
export function useEditorStyles() {
  useEffect(() => {
    if (editorRefCount === 0) {
      const el = document.createElement('link')
      el.rel = 'stylesheet'
      el.href = editorCssUrl
      el.dataset.adminAsset = 'true'
      document.head.appendChild(el)
      editorLinks.set(editorCssUrl, el)
    }

    editorRefCount += 1

    return () => {
      editorRefCount -= 1
      if (editorRefCount > 0) return

      for (const el of editorLinks.values()) el.remove()
      editorLinks.clear()
    }
  }, [])
}
