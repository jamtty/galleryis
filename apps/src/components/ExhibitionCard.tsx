import { Link } from 'react-router-dom'
import type { PublicExhibitionItem } from '@/api/exhibitions'
import { formatDotRange } from '@/utils/date'
import { EXHIBITION_PLACEHOLDER } from '../data/exhibitions'
import { PATHS } from '../routes/paths'

type ExhibitionCardProps = {
  exhibition: PublicExhibitionItem
  index: number
}

/** 전시 카드 — 이미지 · 전시명 · 기간 · 전시장 */
export default function ExhibitionCard({
  exhibition,
  index,
}: ExhibitionCardProps) {
  return (
    <article
      className="exhibition-card"
      style={{ animationDelay: `${index * 90}ms` }}
    >
      <Link to={`${PATHS.exhibitions}/${exhibition.id}`}>
        <div className="exhibition-card__media">
          <img
            src={exhibition.imageUrl || EXHIBITION_PLACEHOLDER}
            alt=""
            loading={index === 0 ? 'eager' : 'lazy'}
          />
        </div>

        <div className="exhibition-card__body">
          <h3 className="exhibition-card__title">{exhibition.title}</h3>
          <p className="exhibition-card__period">
            {formatDotRange(exhibition.startDate, exhibition.endDate)}
          </p>
          {exhibition.place !== '' && (
            <p className="exhibition-card__hall">{exhibition.place}</p>
          )}
        </div>
      </Link>
    </article>
  )
}
