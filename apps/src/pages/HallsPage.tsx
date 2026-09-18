import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  HALL_SEASONS,
  fetchPublicHalls,
  hallSeason,
  type HallItem,
} from '@/api/halls'
import HallGallery from '@/components/HallGallery'
import PageHeader from '@/components/PageHeader'
import { PATHS } from '@/routes/paths'
import { useSiteSettings } from '@/store/useSiteSettings'

/**
 * 공개 — 전시장 안내 (/halls).
 *
 * 원본 사이트(galleryis.web.app/halls)와 같은 구성입니다.
 *   [전시장 안내] 타이틀 → 바로가기 탭(1F · 제1전시장 …)
 *   → 전시장마다: 도면·조감도 + 사진을 한 칸에서 스와이프로 넘기는 갤러리(누르면 크게 보기)
 *   + 전시장명 + 정보표(위치·규모·시즌 요금) + 버튼
 *
 * 값은 관리자 [전시장] 메뉴에서 고칩니다. (backend/api/halls/public_list.php)
 */
export default function HallsPage() {
  /** 제목 아래 문구 — 관리자 [환경설정] 에서 고칩니다. */
  const { pageHallsLede } = useSiteSettings()

  /** null 이면 불러오는 중 */
  const [halls, setHalls] = useState<HallItem[] | null>(null)

  useEffect(() => {
    let cancelled = false

    fetchPublicHalls()
      .then((res) => {
        if (cancelled) return

        setHalls(res.items)
      })
      .catch(() => {
        if (cancelled) return

        // 전시장 정보를 못 받아도 페이지는 열립니다.
        setHalls([])
      })

    return () => {
      cancelled = true
    }
  }, [])

  /**
   * 주소에 해시(#hall3)를 달고 바로 들어온 경우 —
   * 자료를 다 받은 뒤에야 그 자리가 생기므로, 화면이 그려진 다음 직접 옮겨 줍니다.
   * (scroll-margin-top 덕분에 sticky 헤더에 가리지 않습니다)
   */
  useEffect(() => {
    if (halls === null || halls.length === 0) return

    const key = window.location.hash.slice(1)

    if (key === '') return

    document.getElementById(key)?.scrollIntoView()
  }, [halls])

  return (
    <>
      <PageHeader title="전시장 안내" lede={pageHallsLede}>
        {halls !== null && halls.length > 0 && (
          <nav className="tabs" aria-label="전시장 바로가기">
            {halls.map((hall) => (
              <a key={hall.id} className="tab" href={`#${hall.key}`}>
                {hall.floor} · {hall.name}
              </a>
            ))}
          </nav>
        )}
      </PageHeader>

      <div className="page-body">
        {halls === null && <p className="page-note">불러오는 중입니다...</p>}

        {halls !== null && halls.length === 0 && (
          <p className="page-note page-note--center">
            등록된 전시장이 없습니다.
          </p>
        )}

        {halls !== null && halls.length > 0 && (
          <>
            <div className="hall-list">
              {halls.map((hall) => {
                const gallery = [
                  hall.sheetUrl,
                  ...hall.photos.map((photo) => photo.url),
                ].filter((url) => url !== '')

                return (
                  <section key={hall.id} id={hall.key} className="hall">
                    <div className="hall__top">
                      <div className="hall__left">
                        <span className="hall__floor">{hall.floor}</span>

                        {gallery.length > 0 && (
                          <HallGallery images={gallery} title={hall.name} />
                        )}
                      </div>

                      <div className="hall__right">
                        <h2 className="hall__name">{hall.name}</h2>

                        <dl className="hall__info">
                          <div className="hall__info_row">
                            <dt>위치</dt>
                            <dd>{hall.floor}</dd>
                          </div>

                          {hall.spec !== '' && (
                            <div className="hall__info_row">
                              <dt>규모</dt>
                              <dd>{hall.spec}</dd>
                            </div>
                          )}

                          {HALL_SEASONS.map((season) => {
                            const value = hallSeason(hall, season.key)

                            // 0 원이면 그 줄은 보여 주지 않습니다.
                            if (value.price <= 0) return null

                            return (
                              <div className="hall__info_row" key={season.key}>
                                <dt>{season.label}</dt>
                                <dd className="hall__price">
                                  <span className="hall__amount">
                                    ₩ {value.price.toLocaleString('ko-KR')}
                                  </span>

                                  {value.months !== '' && (
                                    <span className="hall__months">
                                      {value.months}
                                    </span>
                                  )}
                                </dd>
                              </div>
                            )
                          })}
                        </dl>

                        {hall.priceNote !== '' && (
                          <p className="hall__note">{hall.priceNote}</p>
                        )}

                        <div className="hall__actions">
                          {hall.photos.length > 0 && (
                            <Link
                              className="btn btn--pill btn--outline"
                              to={PATHS.hallStudio.replace(':key', hall.key)}
                            >
                              3D로 둘러보기
                            </Link>
                          )}

                          <Link
                            className="btn btn--pill btn--outline"
                            to={PATHS.rental}
                          >
                            대관 신청
                          </Link>

                          {hall.planUrl !== '' && (
                            <a
                              className="hall__plan"
                              href={hall.planUrl}
                              target="_blank"
                              rel="noreferrer"
                              download={hall.planName}
                            >
                              도면 내려받기
                              {hall.planExt !== ''
                                ? ` (${hall.planExt.toUpperCase()})`
                                : ''}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </section>
                )
              })}
            </div>

            <p className="hall-footnote">
              치수는 공개 도면을 바탕으로 한 근사치입니다.
            </p>
          </>
        )}
      </div>
    </>
  )
}
