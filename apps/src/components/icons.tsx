/**
 * 아이콘 모음.
 * 메뉴/닫기 아이콘은 실제 사이트와 동일한 path 를 사용하고,
 * 소셜 아이콘은 동일한 형태의 표준 외곽선 아이콘으로 작성했습니다.
 */

type IconProps = {
  className?: string
}

export function MenuIcon({ className = 'icon-24' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  )
}

export function CloseIcon({ className = 'icon-24' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

export function InstagramIcon({ className = 'icon-20' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function BlogIcon({ className = 'icon-20' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 4.5v10.2a1.8 1.8 0 0 1-1.8 1.8H9.3L4.6 20.3V6.3A1.8 1.8 0 0 1 6.4 4.5z" />
      <path d="M8.4 9h7.2M8.4 12.4h4.6" />
    </svg>
  )
}
