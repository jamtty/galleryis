import type { ReactNode } from 'react'

type SectionHeadProps = {
  title: string
  /** 오른쪽에 붙는 "전체 보기" 링크 등 */
  children?: ReactNode
}

/** 홈 섹션 제목 줄 (제목 + 우측 액션) */
export default function SectionHead({ title, children }: SectionHeadProps) {
  return (
    <header className="section-head">
      <h2 className="section-head__title">{title}</h2>
      {children}
    </header>
  )
}
