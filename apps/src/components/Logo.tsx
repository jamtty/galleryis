import { BRAND_LOGO_PATH, BRAND_LOGO_VIEW_BOX } from '../assets/brandLogo'

type LogoProps = {
  /** 크기/색상은 Tailwind 대신 CSS 클래스로 지정합니다. (예: site-footer__logo) */
  className?: string
  title?: string
}

/** 갤러리 이즈 워드마크 로고 */
export default function Logo({
  className = 'brand__logo',
  title = '갤러리 이즈',
}: LogoProps) {
  return (
    <svg
      viewBox={BRAND_LOGO_VIEW_BOX}
      role="img"
      aria-label={title}
      className={className}
    >
      <path d={BRAND_LOGO_PATH} fill="currentColor" fillRule="evenodd" />
    </svg>
  )
}
