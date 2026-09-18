import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { PublicExhibitionItem } from '@/api/exhibitions'
import { formatDotRange } from '@/utils/date'
import { EXHIBITION_PLACEHOLDER } from '../data/exhibitions'
import { PATHS } from '../routes/paths'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'

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
        {/*
         * key 를 바꿔 매 슬라이드마다 새로 그리게 하면 .animate-rise(아래에서 올라오는 효과)가
         * 자동으로 다시 재생됩니다. GSAP 스크롤 효과와는 겹치므로 data-reveal="off" 로 제외합니다.
         */}
        <div
          className="hero__content animate-rise"
          key={current.id}
          data-reveal="off"
        >
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
            <div className="hero__dots">
              {items.map((item, dotIndex) => (
                <button
                  key={item.id}
                  type="button"
                  className="hero__dot"
                  aria-label={`${dotIndex + 1}번째 전시 보기`}
                  aria-current={dotIndex === index ? 'true' : undefined}
                  onClick={() => setIndex(dotIndex)}
                >
                  <span aria-hidden="true" />
                </button>
              ))}
            </div>

            <p className="hero__counter">
              {index + 1} / {total}
            </p>

            <div className="hero__nav">
              <button
                type="button"
                className="icon-btn"
                aria-label="이전 전시"
                onClick={() => move(-1)}
              >
                <ChevronLeftIcon className="icon-16" />
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label="다음 전시"
                onClick={() => move(1)}
              >
                <ChevronRightIcon className="icon-16" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/*
       * 이미지는 모두 겹쳐 두고 활성 슬라이드만 opacity 1 — 전환할 때 서로 부드럽게
       * 교차 페이드됩니다(미리 로드되어 있어 깜빡임도 없습니다).
       */}
      <div className="hero__stage">
        {items.map((item, slideIndex) => (
          <img
            key={item.id}
            src={item.imageUrl || EXHIBITION_PLACEHOLDER}
            alt=""
            aria-hidden={slideIndex !== index}
            className={
              slideIndex === index ? 'hero__image is-active' : 'hero__image'
            }
          />
        ))}
      </div>
    </section>
  )
}
