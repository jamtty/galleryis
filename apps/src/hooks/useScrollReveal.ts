import { useLayoutEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

/**
 * 스크롤 등장 효과 (GSAP ScrollTrigger).
 *
 * 공개 페이지 전체(메인 · 서브)에서 화면에 들어오는 블록이 부드럽게 떠오르고,
 * 위로 지나가면 다시 사라지도록(스크롤을 되돌리면 반대로 재생) 합니다.
 *
 * · 대상은 아래 SINGLES / GROUPS 목록으로 관리합니다. (컴포넌트 수정 없이 적용)
 * · prefers-reduced-motion 사용자에게는 아무 것도 하지 않습니다. (기존 CSS 그대로)
 * · 지도·팝업·라이트박스·헤더처럼 변형(transform)이 걸리면 곤란한 영역은 제외합니다.
 * · 목록/카드처럼 데이터를 받은 뒤 붙는 요소는 MutationObserver 로 다시 훑습니다.
 */

gsap.registerPlugin(ScrollTrigger)

/** 여기에 걸린 요소(그 하위 포함)는 건드리지 않습니다. */
const EXCLUDE_SELECTOR = [
  '.map', // 카카오 지도 — 조상에 transform 이 걸리면 타일이 어긋납니다
  '.lightbox',
  '.popup_layer',
  '.site-header',
  '.nav-scrim',
  '.to-top',
  '.adm_main', // 관리자 화면
  '[data-reveal="off"]',
].join(', ')

/** 낱개로 등장 (페이드 + 살짝 떠오름) */
const SINGLES: { selector: string; y?: number; scale?: number }[] = [
  // 메인
  { selector: '.hero__content', y: 0 },
  { selector: '.hero__stage', y: 0, scale: 0.985 },
  // 공통 머리말
  { selector: '.section-head', y: 24 },
  { selector: '.page-head__inner', y: 24 },
  { selector: '.section-title', y: 18 },
  // 전시 · 소식 상세
  { selector: '.ex-detail__top', y: 28 },
  { selector: '.ex-detail__body', y: 28 },
  { selector: '.ex-detail__actions', y: 16 },
  { selector: '.notice-detail', y: 24 },
  { selector: '.notice-nav', y: 20 },
  { selector: '.notice-detail__actions', y: 16 },
  // 안내문 (개인정보처리방침 등)
  { selector: '.page-doc', y: 24 },
  { selector: '.pager', y: 16 },
  // 갤러리 이즈 (소개)
  { selector: '.about-intro', y: 28 },
  { selector: '.about-info', y: 28 },
  // 대관신청
  { selector: '.rental-schedule', y: 24 },
  { selector: '.rental-form', y: 24 },
  { selector: '.rental-received', y: 20 },
  // 푸터
  { selector: '.site-footer__top', y: 20 },
]

/** 묶음으로 등장 (자식들을 차례로) */
const GROUPS: { selector: string; y?: number; stagger?: number }[] = [
  { selector: '.exhibition-grid', y: 32, stagger: 0.09 }, // 전시 카드
  { selector: '.notice-list', y: 18, stagger: 0.05 }, // 소식 한 줄
  { selector: '.rental-steps', y: 26, stagger: 0.08 }, // 대관 단계 01~04
  { selector: '.ex-detail__works', y: 20, stagger: 0.05 }, // 전시 작품
  { selector: '.about-doc', y: 26, stagger: 0.1 }, // 소개 페이지 큰 블록
  { selector: '.info-list', y: 14, stagger: 0.04 }, // 안내 목록 행
]

/** 등장 애니메이션 기본값 */
const DURATION = 0.9
const EASE = 'power3.out'
const START = 'top 88%'

/** 지도처럼 변형이 걸리면 안 되는 요소를 품고 있는지 */
function holdsMap(element: Element) {
  return element.matches('.map, .map__frame, .map__canvas') || Boolean(element.querySelector('.map__frame'))
}

function isSkipped(element: Element) {
  if (element.closest(EXCLUDE_SELECTOR)) return true

  return holdsMap(element)
}

export function useScrollReveal(key?: unknown) {
  useLayoutEffect(() => {
    // 모션을 줄이는 설정을 켠 사용자는 그대로 둡니다.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    // 모바일 주소창 높이 변화로 매번 다시 계산하는 것을 막습니다.
    ScrollTrigger.config({ ignoreMobileResize: true })

    const ctx = gsap.context(() => {})
    /** 이미 대상으로 잡은 요소 (중복·중첩 방지) */
    const claimed = new WeakSet<Element>()

    /** ScrollTrigger.refresh 예약 — 위치 계산은 프레임당 한 번만 */
    let refreshFrame = 0

    const scheduleRefresh = () => {
      if (refreshFrame) return

      refreshFrame = window.requestAnimationFrame(() => {
        refreshFrame = 0
        ScrollTrigger.refresh()
      })
    }

    /** 조상이 이미 대상이면 건너뜁니다. */
    const hasClaimedAncestor = (element: Element) => {
      let parent = element.parentElement

      while (parent) {
        if (claimed.has(parent)) return true

        parent = parent.parentElement
      }

      return false
    }

    /**
     * 지금 문서에서 등장 대상을 새로 잡습니다.
     * ctx.add 로 감싸야 ctx.revert() 때 걸어 둔 트리거와 인라인 스타일이 함께 되돌아갑니다.
     */
    const scan = () => {
      let added = false

      ctx.add(() => {
        // 묶음 — 컨테이너가 화면에 들어올 때 자식들을 차례로
        for (const rule of GROUPS) {
          for (const container of document.querySelectorAll(rule.selector)) {
            if (claimed.has(container) || hasClaimedAncestor(container) || isSkipped(container)) continue

            claimed.add(container)

            const children = [...container.children].filter(
              (child) => !isSkipped(child) && !claimed.has(child),
            )

            if (children.length === 0) continue

            children.forEach((child) => claimed.add(child))

            gsap.set(children, { autoAlpha: 0, y: rule.y ?? 24 })

            gsap.to(children, {
              autoAlpha: 1,
              y: 0,
              duration: DURATION,
              ease: EASE,
              stagger: rule.stagger ?? 0.06,
              scrollTrigger: {
                trigger: container,
                start: START,
                toggleActions: 'play none none reverse',
              },
            })

            added = true
          }
        }

        // 낱개
        for (const rule of SINGLES) {
          for (const element of document.querySelectorAll(rule.selector)) {
            if (claimed.has(element) || hasClaimedAncestor(element) || isSkipped(element)) continue

            claimed.add(element)

            gsap.set(element, { autoAlpha: 0, y: rule.y ?? 24, scale: rule.scale ?? 1 })

            gsap.to(element, {
              autoAlpha: 1,
              y: 0,
              scale: 1,
              duration: DURATION,
              ease: EASE,
              scrollTrigger: {
                trigger: element,
                start: START,
                toggleActions: 'play none none reverse',
              },
            })

            added = true
          }
        }
      })

      // 새로 잡은 요소가 있을 때만 위치를 다시 계산합니다.
      if (added) scheduleRefresh()
    }

    scan()

    // 목록·카드처럼 데이터를 받은 뒤 붙는 요소를 다시 훑습니다.
    // (숨기는 일은 다음 페인트 전에 끝나야 한 번 보였다 사라지지 않으므로 즉시 처리합니다.)
    const observer = new MutationObserver(scan)

    observer.observe(document.body, { childList: true, subtree: true })

    // 이미지·폰트가 늦게 붙어 위치가 밀리는 경우를 보정합니다.
    const refresh = () => ScrollTrigger.refresh()

    window.addEventListener('load', refresh)

    if (document.fonts) document.fonts.ready.then(refresh).catch(() => {})

    // 라우트 이동 직후 스크롤이 맨 위로 돌아간 다음 위치를 다시 잡습니다.
    const timer = window.setTimeout(refresh, 120)

    return () => {
      observer.disconnect()
      window.clearTimeout(timer)
      window.removeEventListener('load', refresh)

      if (refreshFrame) window.cancelAnimationFrame(refreshFrame)

      // 걸어 둔 스크롤 트리거와 인라인 스타일을 모두 되돌립니다.
      ctx.revert()
    }
  }, [key])
}
