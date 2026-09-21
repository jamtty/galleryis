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
 * editor.css 는 에디터(내용 입력) 전용이라 관리자에서만 쓰입니다.
 *
 * ⚠ 부르는 곳은 **관리자 구역 전체를 감싸는 자리(AdminApp) 한 곳**입니다.
 *   예전에는 화면마다(AdminPage) 불렀는데, 메뉴를 누를 때마다 화면이
 *   언마운트되며 <link> 가 걷어졌다가 다시 붙어서 **스타일이 잠깐 풀렸습니다**
 *   (사이드바 로고가 그 순간 엄청 크게 보이던 원인).
 *   공개 화면으로 나가면 관리자 구역이 통째로 사라지므로 그때 함께 걷힙니다.
 */
const MANAGED_LINKS: { href: string; rel: string }[] = [
  { href: commonCssUrl, rel: 'stylesheet' },
  { href: adminCssUrl, rel: 'stylesheet' },
  { href: rentalCssUrl, rel: 'stylesheet' },
  { href: editorCssUrl, rel: 'stylesheet' },
  { href: MATERIAL_ICONS_URL, rel: 'stylesheet' },
]

const links = new Map<string, HTMLLinkElement>()
let refCount = 0

/**
 * 관리자 구역에서 admin.css · common.css · editor.css · Material Icons 를 부릅니다.
 * (공개 사이트 번들에는 포함되지 않도록 런타임에 주입합니다)
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
