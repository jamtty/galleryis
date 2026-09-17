import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  fetchPublicExhibitionDetail,
  type PublicExhibitionDetail,
} from '@/api/exhibitions'
import { formatDotRange } from '@/utils/date'
import { renderBodyHtml } from '@/utils/html'
import ExhibitionLightbox from '../components/ExhibitionLightbox'
import PageHeader from '../components/PageHeader'
import { PATHS } from '../routes/paths'

/**
 * 공개 — 전시 상세.
 *
 * 원본 사이트(galleryis.web.app)와 같은 구성입니다.
 *   [전시] 공통 타이틀 → 전시 목록으로
 *   → 대표 이미지(왼쪽) · 전시명/작가명/전시기간/전시장소(오른쪽)
 *   → 전시 작품(모바일 2열 · 데스크톱 4열) → 전시 개요 → 작가 약력
 * 사진을 누르면 확대 보기(라이트박스)가 열립니다.
 */
export default function ExhibitionDetailPage() {
  const { id } = useParams<{ id: string }>()

  const exId = Number(id)
  const valid = Number.isInteger(exId) && exId > 0

  const [exhibition, setExhibition] = useState<PublicExhibitionDetail | null>(
    null,
  )
  const [loading, setLoading] = useState(valid)
  const [error, setError] = useState<string | null>(
    valid ? null : '전시 번호가 올바르지 않습니다.',
  )
  /** 확대해서 보고 있는 사진 위치 (null 이면 닫힘) */
  const [zoomed, setZoomed] = useState<number | null>(null)

  useEffect(() => {
    if (!valid) return

    let cancelled = false

    fetchPublicExhibitionDetail(exId)
      .then((res) => {
        if (cancelled) return

        setExhibition(res)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return

        setError(
          err instanceof Error ? err.message : '전시를 불러오지 못했습니다.',
        )
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [exId, valid])

  /** 전시 목록으로 — 위는 오른쪽 정렬, 아래는 가운데 (공지 상세와 같은 버튼) */
  const backButton = (
    <Link to={PATHS.exhibitions} className="btn btn--pill btn--outline btn--lg">
      전시 목록으로
    </Link>
  )

  if (loading) {
    return (
      <>
        <PageHeader title="전시" kicker />

        <div className="page-body">
          <p className="page-note">불러오는 중입니다...</p>
        </div>
      </>
    )
  }

  if (error || exhibition === null) {
    return (
      <>
        <PageHeader title="전시" kicker />

        <div className="page-body">
          <div className="ex-detail__topbar">{backButton}</div>

          <h2 className="ex-detail__notfound">
            {error ?? '전시를 찾을 수 없습니다.'}
          </h2>
        </div>
      </>
    )
  }

  // 첫 이미지는 대표 이미지, 나머지는 '전시 작품' 으로 보여 줍니다.
  const imageFiles = exhibition.files.filter((file) => file.isImage)
  const attachments = exhibition.files.filter((file) => !file.isImage)
  const images = imageFiles.map((file) => file.url)
  const hero = imageFiles[0]
  const works = imageFiles.slice(1)

  return (
    <>
      <PageHeader title="전시" kicker />

      <div className="page-body">
        <div className="ex-detail__topbar">{backButton}</div>

        <article className="ex-detail">
          {/* 대표 이미지 + 전시 정보 (데스크톱 2단) */}
          <div className="ex-detail__top">
            {hero && (
              <div className="ex-detail__media">
                <button
                  type="button"
                  className="ex-detail__zoom"
                  aria-label={`${exhibition.title} 사진 1 크게 보기`}
                  onClick={() => setZoomed(0)}
                >
                  <img
                    src={hero.url}
                    alt={`${exhibition.title} 사진 1`}
                  />
                </button>
              </div>
            )}

            <header>
              <h1 className="ex-detail__title">{exhibition.title}</h1>

              <dl className="ex-detail__info">
                {exhibition.artist !== '' && (
                  <div className="ex-detail__info_row">
                    <dt>작가명</dt>
                    <dd>{exhibition.artist}</dd>
                  </div>
                )}

                <div className="ex-detail__info_row">
                  <dt>전시기간</dt>
                  <dd className="ex-detail__period">
                    {formatDotRange(exhibition.startDate, exhibition.endDate)}
                  </dd>
                </div>

                {exhibition.place !== '' && (
                  <div className="ex-detail__info_row">
                    <dt>전시장소</dt>
                    <dd>{exhibition.place}</dd>
                  </div>
                )}
              </dl>
            </header>
          </div>

          {/* 전시 작품 — 모바일 2열 · 데스크톱 4열 */}
          {works.length > 0 && (
            <section className="ex-detail__section">
              <h2 className="ex-detail__section_title">전시 작품</h2>

              <ul className="ex-detail__works">
                {works.map((file, index) => (
                  <li key={file.id}>
                    <button
                      type="button"
                      className="ex-detail__work"
                      aria-label={`${exhibition.title} 사진 ${index + 2} 크게 보기`}
                      onClick={() => setZoomed(index + 1)}
                    >
                      <img
                        src={file.url}
                        alt={`${exhibition.title} 사진 ${index + 2}`}
                        loading="lazy"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="ex-detail__body">
            {exhibition.overview !== '' && (
              <section>
                <h2 className="ex-detail__section_title">전시 개요</h2>

                <div
                  className="rich-text ex-detail__rich"
                  dangerouslySetInnerHTML={{
                    __html: renderBodyHtml(exhibition.overview),
                  }}
                />
              </section>
            )}

            {exhibition.bio !== '' && (
              <section>
                <h2 className="ex-detail__section_title">작가 약력</h2>

                <div
                  className="rich-text ex-detail__rich"
                  dangerouslySetInnerHTML={{
                    __html: renderBodyHtml(exhibition.bio),
                  }}
                />
              </section>
            )}

            {attachments.length > 0 && (
              <section>
                <h2 className="ex-detail__section_title">첨부파일</h2>

                <ul className="ex-detail__files">
                  {attachments.map((file) => (
                    <li key={file.id}>
                      <a
                        href={file.url}
                        download={file.name}
                        className="ex-detail__file"
                      >
                        {file.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </article>

        <div className="ex-detail__actions">{backButton}</div>
      </div>

      {zoomed !== null && images.length > 0 && (
        <ExhibitionLightbox
          images={images}
          index={zoomed}
          title={exhibition.title}
          onClose={() => setZoomed(null)}
          onIndexChange={setZoomed}
        />
      )}
    </>
  )
}
