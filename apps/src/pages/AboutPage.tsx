import type { ReactNode } from 'react'
import buildingExterior from '@/assets/images/building-exterior.jpg'
import KakaoMap from '@/components/KakaoMap'
import PageHeader from '@/components/PageHeader'
import { SITE } from '@/data/site'
import { useSiteSettings } from '@/store/useSiteSettings'

/**
 * 공개 — 갤러리 이즈 소개.
 *
 * 원본 사이트(https://galleryis.web.app/about)와 같은 구성입니다.
 *   서브 타이틀 → 인트로(글 + 건물 그림) → 관람 안내 · 문의 → 오시는 길(지도)
 * 제목 아래 문구(lede)만 관리자 [환경설정] 에서 고칠 수 있습니다.
 */

/** 인트로 문단 */
const INTRO = [
  '세계적인 건축가 이타미 준(庾東龍, 1937–2011, 재일동포 출신)이 설계한 갤러리 이즈는 인사동에 자리한 전시 공간으로, 건축과 예술이 조화를 이루는 공간적 특성을 지니고 있습니다.',
  '하나의 건축물 안에 네 개의 독립적인 전시실을 갖추고 있으며, 각 전시실을 통해 회화, 조각, 사진 등 다양한 장르의 전시와 문화예술을 선보입니다.',
  '‘갤러리 이즈’라는 이름의 뿌리에는 약 200년 동안 지식과 지혜의 유산을 이어온 ‘인수문고’가 있습니다. 인수문고의 정신을 현대적으로 계승하고자 ‘인수’의 이니셜에서 착안해 ‘이즈(IS)’라는 이름을 지었습니다.',
  '갤러리 이즈는 인수문고가 이어온 지식과 지혜의 정신, 이타미 준의 건축적 감각, 그리고 오늘날 예술과 문화가 지닌 가치를 하나의 공간에서 이어가고자 합니다.',
] as const

type InfoRowProps = {
  label: string
  children: ReactNode
}

/** 안내 목록 한 줄 (제목 + 내용) */
function InfoRow({ label, children }: InfoRowProps) {
  return (
    <div className="info-list__row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

export default function AboutPage() {
  /** 제목 아래 문구 — 관리자 [환경설정] 에서 고칩니다. */
  const { pageAboutLede } = useSiteSettings()

  return (
    <>
      <PageHeader title={SITE.brandName} lede={pageAboutLede} />

      <article className="page-body">
        <div className="about-doc">
          {/* 인트로 — 글 + 건물 그림 */}
          <div className="about-intro">
            <div className="about-intro__text">
              <h2 className="section-title">하나의 공간, 그리고 네 개의 전시장</h2>

              <div className="about-intro__body">
                {INTRO.map((text) => (
                  <p key={text}>{text}</p>
                ))}
              </div>
            </div>

            <div className="about-intro__media">
              <img
                src={buildingExterior}
                alt="갤러리 이즈 건물 수채화 그림"
                loading="lazy"
              />
            </div>
          </div>

          {/* 관람 안내 · 문의 */}
          <div className="about-info">
            <section>
              <h2 className="section-title">관람 안내</h2>

              <dl className="info-list">
                <InfoRow label="관람시간">
                  <span className="tabular-nums">{SITE.hours}</span>
                  <span className="info-list__note">{SITE.hoursNote}</span>
                </InfoRow>
                <InfoRow label="관람료">{SITE.fee}</InfoRow>
                <InfoRow label="휴관일">{SITE.closed}</InfoRow>
              </dl>
            </section>

            <section>
              <h2 className="section-title">문의</h2>

              <dl className="info-list">
                <InfoRow label="대표">{SITE.director}</InfoRow>
                <InfoRow label="전화">
                  <span className="tabular-nums">{SITE.tel}</span>
                </InfoRow>
                <InfoRow label="이메일">
                  <a href={`mailto:${SITE.email}`} className="link-underline">
                    {SITE.email}
                  </a>
                </InfoRow>
                <InfoRow label="주소">{SITE.address}</InfoRow>
              </dl>
            </section>
          </div>

          {/* 오시는 길 (#visit — 헤더의 /visit 이 이 자리로 옵니다) */}
          <section id="visit" className="about-visit">
            <h2 className="section-title">오시는 길</h2>

            <KakaoMap />

            <dl className="info-list info-list--top">
              <InfoRow label="지하철">{SITE.subway}</InfoRow>
              <InfoRow label="버스">
                {SITE.bus.map((line) => (
                  <span className="info-list__line" key={line}>
                    {line}
                  </span>
                ))}
              </InfoRow>
              <InfoRow label="참고">{SITE.carFree}</InfoRow>
            </dl>
          </section>
        </div>
      </article>
    </>
  )
}
