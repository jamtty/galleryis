import type { PublicExhibitionItem } from '@/api/exhibitions'
import ExhibitionCard from './ExhibitionCard'

type ExhibitionGridProps = {
  items: readonly PublicExhibitionItem[]
  /** 항목이 없을 때 보여줄 문구 */
  emptyText?: string
}

/** 전시 카드 그리드 */
export default function ExhibitionGrid({
  items,
  emptyText = '전시가 아직 없습니다.',
}: ExhibitionGridProps) {
  if (items.length === 0) {
    return <p className="page-note">{emptyText}</p>
  }

  return (
    <div className="exhibition-grid">
      {items.map((item, index) => (
        <ExhibitionCard key={item.id} exhibition={item} index={index} />
      ))}
    </div>
  )
}
