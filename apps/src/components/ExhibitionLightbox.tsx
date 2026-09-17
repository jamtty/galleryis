import { useEffect, useRef, useState } from 'react'
import type { TouchEvent as ReactTouchEvent } from 'react'
import { createPortal } from 'react-dom'

/**
 * 공개 — 전시 사진 확대 보기(라이트박스).
 *
 * 원본 사이트와 같은 구성입니다.
 *   - 화면 전체를 덮고, 사진 아래에 전시명과 `n / 전체` 를 보여 줍니다.
 *   - ESC 로 닫고, ←/→ 또는 좌우 버튼으로 넘깁니다. (모바일은 좌우 스와이프)
 *   - 사진·버튼 바깥을 누르면 닫힙니다.
 */
type ExhibitionLightboxProps = {
  /** 전체 이미지 주소 (대표 이미지 포함) */
  images: readonly string[]
  /** 보고 있는 위치 (0부터) */
  index: number
  /** 전시명 — 캡션에 씁니다. */
  title: string
  onClose: () => void
  onIndexChange: (index: number) => void
}

/** 스와이프로 인정할 최소 이동 거리 (px) */
const SWIPE_MIN = 40

export default function ExhibitionLightbox({
  images,
  index,
  title,
  onClose,
  onIndexChange,
}: ExhibitionLightboxProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const touchRef = useRef<{ x: number; y: number } | null>(null)
  /** 다 불러온 이미지 주소 (깜빡임 방지) */
  const [loaded, setLoaded] = useState('')

  const total = images.length
  const src = images[index] ?? ''
  const hasPrev = index > 0
  const hasNext = index < total - 1
  const label = `${title} 사진 ${index + 1}`

  // 열려 있는 동안 본문 스크롤을 잠그고 포커스를 옮깁니다.
  useEffect(() => {
    const previous = document.activeElement
    const overflow = document.body.style.overflow

    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    return () => {
      document.body.style.overflow = overflow

      if (previous instanceof HTMLElement) previous.focus()
    }
  }, [])

  // 키보드 조작
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }

      if (event.key === 'ArrowRight' && hasNext) {
        onIndexChange(index + 1)
        return
      }

      if (event.key === 'ArrowLeft' && hasPrev) onIndexChange(index - 1)
    }

    window.addEventListener('keydown', onKeyDown)

    return () => window.removeEventListener('keydown', onKeyDown)
  }, [hasNext, hasPrev, index, onClose, onIndexChange])

  // 앞뒤 사진을 미리 받아 둡니다.
  useEffect(() => {
    for (const next of [images[index - 1], images[index + 1]]) {
      if (!next) continue

      const image = new Image()
      image.src = next
    }
  }, [images, index])

  const onTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0]

    touchRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null
  }

  const onTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    const start = touchRef.current
    const touch = event.changedTouches[0]

    touchRef.current = null

    if (!start || !touch) return

    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y

    // 세로로 더 많이 움직였으면 스크롤로 봅니다.
    if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(dy)) return

    if (dx < 0 && hasNext) onIndexChange(index + 1)
    if (dx > 0 && hasPrev) onIndexChange(index - 1)
  }

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="lightbox"
      onClick={(event) => {
        // 사진 · 캡션 · 버튼 바깥(배경)을 누르면 닫습니다.
        const target = event.target as HTMLElement

        if (!target.closest('img, figcaption, button')) onClose()
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <button
        ref={closeRef}
        type="button"
        className="lightbox__close"
        aria-label="닫기"
        onClick={onClose}
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
        >
          <path d="M5 5l14 14M19 5L5 19" />
        </svg>
      </button>

      <figure className="lightbox__figure">
        <img
          src={src}
          alt={label}
          onLoad={() => setLoaded(src)}
          className={loaded === src ? 'lightbox__img is-loaded' : 'lightbox__img'}
        />

        <figcaption className="lightbox__caption">
          <p className="lightbox__title">{title}</p>
          <p className="lightbox__count">
            {index + 1} / {total}
          </p>
        </figcaption>

        <div className="lightbox__nav">
          <button
            type="button"
            className="lightbox__arrow lightbox__arrow--prev"
            aria-label="이전 사진"
            disabled={!hasPrev}
            onClick={() => onIndexChange(index - 1)}
          >
            <span aria-hidden="true">←</span>
          </button>

          <button
            type="button"
            className="lightbox__arrow lightbox__arrow--next"
            aria-label="다음 사진"
            disabled={!hasNext}
            onClick={() => onIndexChange(index + 1)}
          >
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </figure>
    </div>,
    document.body,
  )
}
