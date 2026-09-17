import { useEffect } from 'react'
import adminCssUrl from '@/assets/css/admin.css?url'
import editorCssUrl from '@/assets/css/editor.css?url'

/** Material Icons (사이드바 아이콘 리거처) */
const MATERIAL_ICONS_URL =
  'https://fonts.googleapis.com/icon?family=Material+Icons&display=swap'

const MANAGED_LINKS: { href: string; rel: string }[] = [
  { href: adminCssUrl, rel: 'stylesheet' },
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
