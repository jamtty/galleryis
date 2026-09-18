import { useRef, useState } from 'react'
import type { TouchEvent as ReactTouchEvent } from 'react'
import ExhibitionLightbox from './ExhibitionLightbox'

/**
 * 공개 — 전시장 이미지 갤러리 (도면·조감도 + 전시장 사진을 한 칸에서 스와이프).
 *
 * 좌우로 넘기면(스와이프 · 화살표 · 점) 다음 사진이 나오고, 누르면 라이트박스로 크게 봅니다.
 */
type HallGalleryProps = {
  /** 도면·조감도 + 전시장 사진 (순서대로) */
  images: readonly string[]
  /** 라이트박스 캡션에 쓰는 전시장명 */
  title: string
}

/** 스와이프로 인정할 최소 이동 거리 (px) */
const SWIPE_MIN = 30

export default function HallGallery({ images, title }: HallGalleryProps) {
  const [index, setIndex] = useState(0)
  /** 라이트박스에서 보고 있는 위치 (null 이면 닫힘) */
  const [zoomed, setZoomed] = useState<number | null>(null)
  const touchRef = useRef<{ x: number; y: number } | null>(null)

  const total = images.length

  if (total === 0) return null

  const hasPrev = index > 0
  const hasNext = index < total - 1

  const go = (next: number) => setIndex(Math.min(Math.max(next, 0), total - 1))

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

    if (dx < 0) go(index + 1)
    if (dx > 0) go(index - 1)
  }

  return (
    <div className="hall-gallery">
      <div
        className="hall-gallery__frame"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <button
          type="button"
          className="hall-gallery__zoom"
          aria-label={`${title} 사진 ${index + 1} 크게 보기`}
          onClick={() => setZoomed(index)}
        >
          <img src={images[index]} alt={`${title} 사진 ${index + 1}`} />
        </button>

        {hasPrev && (
          <button
            type="button"
            className="hall-gallery__nav hall-gallery__nav--prev"
            aria-label="이전 사진"
            onClick={() => go(index - 1)}
          >
            <span aria-hidden="true">‹</span>
          </button>
        )}

        {hasNext && (
          <button
            type="button"
            className="hall-gallery__nav hall-gallery__nav--next"
            aria-label="다음 사진"
            onClick={() => go(index + 1)}
          >
            <span aria-hidden="true">›</span>
          </button>
        )}

        {total > 1 && (
          <span className="hall-gallery__count">
            {index + 1} / {total}
          </span>
        )}
      </div>

      {total > 1 && (
        <div className="hall-gallery__dots" role="tablist" aria-label="사진 선택">
          {images.map((image, i) => (
            <button
              key={image}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`${i + 1}번째 사진`}
              className={i === index ? 'is-active' : ''}
              onClick={() => go(i)}
            />
          ))}
        </div>
      )}

      {zoomed !== null && (
        <ExhibitionLightbox
          images={images}
          index={zoomed}
          title={title}
          onClose={() => setZoomed(null)}
          onIndexChange={setZoomed}
        />
      )}
    </div>
  )
}
