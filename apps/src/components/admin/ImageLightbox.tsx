import { useCallback, useEffect } from 'react'

/**
 * 관리자 — 이미지 팝업(슬라이드).
 *
 * 작품등록 썸네일을 누르면 크게 보여 주고, 좌우 버튼 · 방향키로 넘깁니다.
 * (ESC 또는 바깥을 누르면 닫힙니다)
 * 스타일은 admin.css 의 .adm_lightbox* 입니다.
 */
export type LightboxImage = {
  url: string
  name: string
}

type ImageLightboxProps = {
  images: readonly LightboxImage[]
  /** 열려 있는 이미지 번호 (null 이면 닫힘) */
  index: number | null
  onClose: () => void
  onIndexChange: (index: number) => void
}

export default function ImageLightbox({
  images,
  index,
  onClose,
  onIndexChange,
}: ImageLightboxProps) {
  /** 좌우로 넘깁니다. (끝에서 반대편으로 이어짐) */
  const move = useCallback(
    (step: number) => {
      if (index === null || images.length === 0) return

      onIndexChange((index + step + images.length) % images.length)
    },
    [images.length, index, onIndexChange],
  )

  /** 열려 있는 동안에만 동작할 것들 (이미지가 지워지면 자동으로 닫힘) */
  const open = index !== null && images.length > 0

  useEffect(() => {
    if (!open) return

    // 팝업이 열려 있는 동안 뒤 배경이 스크롤되지 않게 막습니다.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        move(-1)
        return
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        move(1)
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, move, onClose])

  if (index === null || images.length === 0) return null

  const current = images[Math.min(index, images.length - 1)]

  if (!current) return null

  return (
    <div
      className="adm_lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="작품 이미지 크게 보기"
      onClick={onClose}
    >
      <button
        type="button"
        className="adm_lightbox_close"
        aria-label="닫기"
        onClick={onClose}
      >
        ×
      </button>

      <div
        className="adm_lightbox_box"
        onClick={(event) => event.stopPropagation()}
      >
        <img className="adm_lightbox_img" src={current.url} alt={current.name} />

        <div className="adm_lightbox_bar">
          <span className="adm_lightbox_name">{current.name}</span>
          <span className="adm_lightbox_count">
            {index + 1} / {images.length}
          </span>
        </div>
      </div>

      {images.length > 1 && (
        <>
          <button
            type="button"
            className="adm_lightbox_nav is-prev"
            aria-label="이전 이미지"
            onClick={(event) => {
              event.stopPropagation()
              move(-1)
            }}
          >
            ‹
          </button>

          <button
            type="button"
            className="adm_lightbox_nav is-next"
            aria-label="다음 이미지"
            onClick={(event) => {
              event.stopPropagation()
              move(1)
            }}
          >
            ›
          </button>
        </>
      )}
    </div>
  )
}
