import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  fetchPublicHalls,
  hallPhotoSets,
  hallSize,
  type HallItem,
} from '@/api/halls'
import HallStudio from '@/components/HallStudio'
import { PATHS } from '@/routes/paths'

/**
 * 공개 — 전시장 3D 둘러보기 (/halls/:key/studio).
 *
 * 원본 사이트의 /studio/halls/hall1 과 같은 역할입니다.
 * 규모(면적·층고)로 방을 만들고 전시장 사진을 벽에 이어 붙여 둘러봅니다.
 * 원본처럼 별도 앱이 아니라 같은 사이트 안의 한 화면입니다.
 */
export default function HallStudioPage() {
  const { key } = useParams<{ key: string }>()

  /** null 이면 불러오는 중 */
  const [hall, setHall] = useState<HallItem | null>(null)
  const [others, setOthers] = useState<HallItem[]>([])

  useEffect(() => {
    let cancelled = false

    fetchPublicHalls()
      .then((res) => {
        if (cancelled) return

        setHall(res.items.find((item) => item.key === key) ?? null)
        setOthers(res.items)
      })
      .catch(() => {
        if (cancelled) return

        setHall(null)
      })

    return () => {
      cancelled = true
    }
  }, [key])

  if (hall === null) {
    return (
      <div className="page-body">
        <p className="page-note page-note--center">
          전시장 정보를 불러오는 중입니다...
        </p>

        <div className="studio__back_row">
          <Link to={PATHS.halls} className="btn btn--pill btn--outline">
            전시장 안내로
          </Link>
        </div>
      </div>
    )
  }

  const size = hallSize(hall)
  const sets = hallPhotoSets(hall)

  return (
    <div className="studio-page">
      <div className="studio-page__head">
        <div className="studio-page__title">
          <p className="studio-page__kicker">{hall.floor}</p>
          <h1 className="studio-page__name">{hall.name}</h1>
          <p className="studio-page__spec">{hall.spec}</p>
        </div>

        <div className="studio-page__actions">
          {hall.planUrl !== '' && (
            <a
              className="btn btn--pill btn--outline btn--sm"
              href={hall.planUrl}
              target="_blank"
              rel="noreferrer"
              download={hall.planName}
            >
              도면 보기
            </a>
          )}

          <Link
            className="btn btn--pill btn--outline btn--sm"
            to={PATHS.rental}
          >
            대관 신청
          </Link>
        </div>
      </div>

      <div className="studio-page__stage">
        {sets.length === 0 ? (
          <p className="studio__status">
            아직 전시장 사진이 없어 3D 둘러보기를 열 수 없습니다.
          </p>
        ) : (
          <HallStudio
            width={size.width}
            depth={size.depth}
            height={size.height}
            sets={sets}
          />
        )}
      </div>

      <div className="studio-page__foot">
        <div>
          <Link to={`${PATHS.halls}#${hall.key}`} className="studio-page__back">
            ← 전시장 안내로
          </Link>

          <p className="studio-page__note">
            화면은 실제 치수가 아니라 보기 좋게 줄인 근사치입니다. 사진을 벽 4면에
            이어 붙여 둘러보는 방식이라, 사진에 없는 부분은 비어 있습니다.
          </p>
        </div>

        {others.length > 1 && (
          <nav className="studio-page__others" aria-label="다른 전시장">
            {others
              .filter((item) => item.key !== hall.key)
              .map((item) => (
                <Link
                  key={item.id}
                  className="studio-page__other"
                  to={PATHS.hallStudio.replace(':key', item.key)}
                >
                  {item.floor} · {item.name}
                </Link>
              ))}
          </nav>
        )}
      </div>
    </div>
  )
}
