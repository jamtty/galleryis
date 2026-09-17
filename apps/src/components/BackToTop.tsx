import { useEffect, useState } from 'react'

/**
 * 공통 — 맨 위로 버튼 (우측 하단 고정).
 *
 * 스크롤을 시작하면 바로 나타나고, 누르면 부드럽게 맨 위로 올라갑니다.
 * 스타일은 assets/css/style.css 의 .to-top 입니다.
 */
export default function BackToTop() {
  const [visible, setVisible] = useState(() => window.scrollY > 0)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 0)

    window.addEventListener('scroll', onScroll, { passive: true })

    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <button
      type="button"
      className={visible ? 'to-top is-visible' : 'to-top'}
      aria-label="맨 위로"
      title="맨 위로"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  )
}
