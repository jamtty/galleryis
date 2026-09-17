import AdminPage from '@/components/admin/AdminPage'
import RentalSchedule from '@/components/rental/RentalSchedule'

/**
 * 관리자 — 대관 일정.
 *
 * 공개 대관 페이지(/rental)의 "전시 기간 확인 및 신청" 섹션에 쓰는 표를 그대로 보여 줍니다.
 * (전시기간 검색 · 대관신청 구분 필터 · 전시장별 주간 표)
 */
export default function AdminRentalSchedulePage() {
  return (
    <AdminPage title="대관 일정">
      <section className="adm_section">
        <h2 className="adm_section_title">전시 기간 확인 및 신청</h2>
        <div className="adm_schedule">
          <RentalSchedule newWindow defaultUnit="2y" />
        </div>
      </section>
    </AdminPage>
  )
}
