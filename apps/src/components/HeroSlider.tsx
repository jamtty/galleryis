import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { PublicExhibitionItem } from '@/api/exhibitions'
import { formatDotRange } from '@/utils/date'
import { EXHIBITION_PLACEHOLDER } from '../data/exhibitions'
import { PATHS } from '../routes/paths'

/** 자동 넘김 간격 (원본과 동일하게 4.5초) */
const AUTO_PLAY_MS = 4500

type HeroSliderProps = {
  items: readonly PublicExhibitionItem[]
}

/** 홈 상단 — 현재 전시 슬라이더 */
export default function HeroSlider({ items }: HeroSliderProps) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const total = items.length

  useEffect(() => {
    if (total < 2 || paused) return

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % total)
    }, AUTO_PLAY_MS)

    return () => window.clearInterval(timer)
  }, [total, paused])

  if (total === 0) {
    return (
      <section id="hero" aria-label="현재 전시" className="hero">
        <div className="hero__body">
          <p className="hero__placeholder">현재 전시가 없습니다.</p>
        </div>
      </section>
    )
  }

  const current = items[index % total]
  const detailPath = `${PATHS.exhibitions}/${current.id}`
  const move = (step: number) =>
    setIndex((value) => (value + step + total) % total)

  return (
    <section
      id="hero"
      aria-label="현재 전시"
      className="hero"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="hero__body">
        <div className="hero__content" key={current.id}>
          <p className="hero__kicker">
            현재 전시
            {current.place !== '' && (
              <>
                <span aria-hidden="true"> · </span>
                {current.place}
              </>
            )}
          </p>

          <h1 className="hero__title">
            <Link to={detailPath}>{current.title}</Link>
          </h1>

          <p className="hero__period">
            {formatDotRange(current.startDate, current.endDate)}
          </p>

          <Link
            to={detailPath}
            className="btn btn--pill btn--outline hero__cta"
          >
            자세히 보기
          </Link>
        </div>

        {total > 1 && (
          <div className="hero__controls">
            <button
              type="button"
              className="icon-btn"
              aria-label="이전 전시"
              onClick={() => move(-1)}
            >
              <span aria-hidden="true">←</span>
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="다음 전시"
              onClick={() => move(1)}
            >
              <span aria-hidden="true">→</span>
            </button>
            <p className="hero__counter">
              {index + 1} / {total}
            </p>
          </div>
        )}
      </div>

      <div className="hero__stage">
        <img
          src={current.imageUrl || EXHIBITION_PLACEHOLDER}
          alt=""
          className="hero__image"
        />
      </div>
    </section>
  )
}
