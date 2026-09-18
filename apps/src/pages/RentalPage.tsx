import PageHeader from '@/components/PageHeader'
import RentalSchedule from '@/components/rental/RentalSchedule'
import SectionHead from '@/components/SectionHead'
import { useSiteSettings } from '@/store/useSiteSettings'

/** 01 ~ 04 안내 */
const STEPS = [
  {
    title: '전시 기간',
    text: '전시기간은 매주 수요일부터 다음 주 화요일까지 7일이 기본 단위입니다.',
  },
  {
    title: '심의',
    text: '접수일로부터 3일 이내에 자체 심의를 거쳐 승인 여부를 개별 통보합니다.',
  },
  {
    title: '계약',
    text: '승인 후 7일 이내 계약을 체결하고 대관료의 30%를 계약금으로 납부합니다. 잔금은 시작일 7일 전까지 납부합니다.',
  },
  {
    title: '반입·반출',
    text: '작품 반입은 화요일 오후 2시~7시, 반출은 종료일(화) 오후 1시까지 완료해야 합니다.',
  },
] as const

export default function RentalPage() {
  /** 제목 아래 문구 — 관리자 [환경설정] 에서 고칩니다. */
  const { pageRentalLede } = useSiteSettings()

  return (
    <>
      <PageHeader title="대관신청" lede={pageRentalLede} />

      <section id="rental" className="section scroll-anchor">
        {/* 01 ~ 04 */}
        <ol className="rental-steps">
          {STEPS.map((step, index) => (
            <li key={step.title} className="rental-step">
              <p className="rental-step__num">
                {String(index + 1).padStart(2, '0')}
              </p>
              <h2 className="rental-step__title">{step.title}</h2>
              <p className="rental-step__text">{step.text}</p>
            </li>
          ))}
        </ol>

        {/* 전시 기간 확인 및 신청 */}
        <div className="rental-schedule">
          <SectionHead title="전시 기간 확인 및 신청" />
        </div>

        <RentalSchedule defaultUnit="2y" />
      </section>
    </>
  )
}
