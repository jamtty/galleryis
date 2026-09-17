import type { ReactNode } from 'react'

type PageHeaderProps = {
  title: string
  /** 제목 아래 보조 설명 */
  lede?: string
  /** 탭 등 헤더 하단에 붙는 요소 */
  children?: ReactNode
  /** true 면 h1 대신 p 로 렌더합니다. */
  kicker?: boolean
}

/** 목록 페이지 상단 헤더 (제목 + 선택적 탭) */
export default function PageHeader({
  title,
  lede,
  children,
  kicker = false,
}: PageHeaderProps) {
  return (
    <div className="page-head">
      <div className="page-head__inner">
        {kicker ? (
          <p className="page-head__title">{title}</p>
        ) : (
          <h1 className="page-head__title">{title}</h1>
        )}

        {lede && <p className="page-head__lede">{lede}</p>}

        <div className={children ? 'page-head__tabs' : 'page-head__spacer'}>
          {children}
        </div>
      </div>
    </div>
  )
}
