import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  RENTAL_STATUS_CHOICES,
  fetchRentalDetail,
  setRentalChecked,
  setRentalStatus,
  type RentalDetail,
  type RentalStatusChoice,
} from '@/api/rentals'
import AdminAlert from '@/components/admin/AdminAlert'
import AdminPage from '@/components/admin/AdminPage'
import RentalForm, {
  type RentalFormInitial,
} from '@/components/rental/RentalForm'
import { PATHS } from '@/routes/paths'
import { formatDotRange } from '@/utils/date'

/**
 * 관리자 — 대관 신청서 수정.
 *
 * /admin/rentals 에서 [수정] 을 누르면 열립니다.
 * 공개 사이트와 같은 신청서 양식(RentalForm)을 저장된 값으로 채워 보여 줍니다.
 *
 * 위쪽 [대관 상태] 는 신청 내용과 별개라, 고르면 곧바로 저장합니다.
 * (대관 일정 표의 칸 색과 예약 여부가 이 값으로 바뀝니다)
 */
export default function AdminRentalEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [detail, setDetail] = useState<RentalDetail | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  /** 저장 완료 안내 알럿 문구 (null 이면 닫힘) — 닫으면 목록으로 */
  const [done, setDone] = useState<string | null>(null)
  /** 대관 상태 변경 안내 — 닫아도 이 화면에 그대로 남습니다. */
  const [statusDone, setStatusDone] = useState<string | null>(null)
  /** 대관 상태 — 신청서를 불러온 뒤 여기서 고칩니다. */
  const [status, setStatus] = useState<RentalStatusChoice>('pending')
  const [savingStatus, setSavingStatus] = useState(false)

  const back = () => navigate(PATHS.adminRentals)

  const wrId = Number(id)
  const invalidId = !Number.isInteger(wrId) || wrId <= 0

  useEffect(() => {
    if (invalidId) return

    let cancelled = false

    fetchRentalDetail(wrId)
      .then((res) => {
        if (cancelled) return

        setDetail(res)
        setStatus(res.status === 'approved' ? 'approved' : 'pending')

        // 상세를 열면 '확인한 것'으로 표시합니다.
        // (컬럼이 아직 없거나 실패해도 화면은 그대로 둡니다)
        void setRentalChecked([wrId], true).catch(() => undefined)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setMessage(
            err instanceof Error
              ? err.message
              : '신청 내용을 불러오지 못했습니다.',
          )
        }
      })

    return () => {
      cancelled = true
    }
  }, [wrId, invalidId])

  /** 대관 상태 변경 — 고르면 바로 저장하고, 실패하면 되돌립니다. */
  const changeStatus = async (next: RentalStatusChoice) => {
    const previous = status

    if (next === previous || savingStatus) return

    setStatus(next)
    setSavingStatus(true)
    setMessage(null)

    try {
      await setRentalStatus(wrId, next)

      const label = next === 'approved' ? '대관완료' : '심사중'

      setDetail((current) =>
        current === null ? current : { ...current, status: next },
      )
      setStatusDone(`대관 상태를 '${label}' 로 바꿨습니다.`)
    } catch (err: unknown) {
      setStatus(previous)
      setMessage(
        err instanceof Error ? err.message : '대관 상태를 바꾸지 못했습니다.',
      )
    } finally {
      setSavingStatus(false)
    }
  }

  const notice = (text: string) => (
    <AdminPage title="대관 신청">
      <section className="adm_section">
        <h2 className="adm_section_title">대관 신청</h2>
        <p className="adm_table_notice">{text}</p>
        <div className="adm_page_btns">
          <button type="button" className="adm_btn_primary" onClick={back}>
            목록으로
          </button>
        </div>
      </section>
    </AdminPage>
  )

  if (invalidId) return notice('신청 번호가 올바르지 않습니다.')
  if (message) return notice(message)
  if (!detail) return notice('불러오는 중입니다...')

  // 전시장을 못 알아보면 저장할 때 전시장 검증에 걸리므로 미리 알려 줍니다.
  if (!detail.hallId) {
    return notice('전시장 정보를 확인할 수 없어 수정할 수 없습니다.')
  }

  const initial: RentalFormInitial = {
    id: detail.id,
    hall: detail.hall,
    name: detail.applicant.name,
    email: detail.applicant.email,
    phone: detail.applicant.phone,
    postcode: detail.applicant.postcode,
    address1: detail.applicant.address1,
    address2: detail.applicant.address2,
    kind: detail.exhibition.kind || 'solo',
    genre: detail.exhibition.genre,
    artistCount:
      detail.exhibition.artist_count > 0
        ? String(detail.exhibition.artist_count)
        : '',
    workCount:
      detail.exhibition.work_count > 0 ? String(detail.exhibition.work_count) : '',
    memo: detail.exhibition.memo,
    bio: detail.files.bio,
    portfolio: detail.files.portfolio,
  }

  return (
    <AdminPage title="대관 신청">
      <section className="adm_section">
        <h2 className="adm_section_title">
          {detail.hall} · {formatDotRange(detail.weekStart, detail.weekEnd)}
        </h2>

        {/* 대관 상태 — 신청 내용과 별개라 고르면 바로 저장합니다. */}
        <div className="adm_form_row adm_form_row_col adm_status_field">
          <span className="adm_form_label">대관 상태</span>

          <div
            className="adm_radio_cards"
            role="radiogroup"
            aria-label="대관 상태"
          >
            {RENTAL_STATUS_CHOICES.map((item) => (
              <label
                key={item.value}
                className={
                  status === item.value
                    ? 'adm_radio_card is-selected'
                    : 'adm_radio_card'
                }
              >
                <input
                  type="radio"
                  name="rental_status"
                  value={item.value}
                  checked={status === item.value}
                  disabled={savingStatus}
                  onChange={() => void changeStatus(item.value)}
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
        </div>

        <RentalForm
          hallId={detail.hallId ?? ''}
          weekStart={detail.weekStart}
          weekEnd={detail.weekEnd}
          onCancel={back}
          hideTerms
          onDone={() => setDone('수정되었습니다.')}
          initial={initial}
        />
      </section>

      <AdminAlert open={done !== null} title={done ?? ''} onClose={back} />
      <AdminAlert
        open={statusDone !== null}
        title={statusDone ?? ''}
        message="대관 일정 표에 바로 반영됩니다."
        onClose={() => setStatusDone(null)}
      />
    </AdminPage>
  )
}
