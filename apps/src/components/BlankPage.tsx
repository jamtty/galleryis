import PageHeader from './PageHeader'

type BlankPageProps = {
  /** 페이지 제목 */
  title: string
  /** 제목 아래 보조 설명 (예: 전시 ID) */
  lede?: string
  /** 본문에 표시할 안내 문구 */
  note?: string
}

/**
 * 내용이 아직 비어 있는 페이지.
 * 사이트의 페이지 헤더 디자인을 그대로 쓰고 본문만 비워 둡니다.
 */
export default function BlankPage({ title, lede, note }: BlankPageProps) {
  return (
    <>
      <PageHeader title={title} lede={lede} />
      <div className="page-body">
        <p className="page-note">{note ?? '내용을 준비 중입니다.'}</p>
      </div>
    </>
  )
}
