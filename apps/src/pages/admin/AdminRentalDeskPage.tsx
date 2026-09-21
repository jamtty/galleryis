import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ApiError } from '@/api/client'
import {
  RENTAL_HALLS,
  RENTAL_STATUS_CHOICES,
  createDeskBooking,
  type RentalStatusChoice,
} from '@/api/rentals'
import AdminAlert from '@/components/admin/AdminAlert'
import AdminConfirm from '@/components/admin/AdminConfirm'
import AdminPage from '@/components/admin/AdminPage'
import { PATHS } from '@/routes/paths'
import { formatDotRange } from '@/utils/date'

/**
 * 관리자 — 대리 신청 (전화 · 방문 접수).
 *
 * 대관 일정(/admin/schedule)의 신청가능 칸을 누르면 `?hall=hall4&week=2026-09-30`
 * 으로 이 화면이 열립니다. 전화나 방문으로 잡아 둔 주를 직원이 대신 접수하는
 * 자리라 신청자에게는 묻지 않습니다 — 남는 것은 그 주 · 전시장 · 메모 · 접수
 * 상태뿐입니다. (이름 · 연락처 · 전시 내용 · 약력소개 · 포트폴리오는 신청자
 * 본인이 공개 신청서에서 채우고, 유의사항 동의도 본인 몫이라 여기서는 받지
 * 않습니다)
 *
 * 접수 결과는 공개 신청서와 같은 대관 신청 목록에 쌓입니다.
 *   · 심사중   → /admin/rentals 에서 승인 · 반려합니다
 *   · 대관완료 → 곧바로 공개 일정에 표시됩니다 (한 번 더 묻습니다)
 */
export default function AdminRentalDeskPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const hallId = params.get('hall') ?? ''
  const weekStart = params.get('week') ?? ''
  const hall = RENTAL_HALLS.find((item) => item.id === hallId)
  const validWeek = /^\d{4}-\d{2}-\d{2}$/.test(weekStart)

  const [statement, setStatement] = useState('')
  // 심사중이 기본값입니다. 대관완료는 공개 일정을 곧바로 바꾸는 선택이라
  // 기본값 때문에 일어나서는 안 되는 일입니다.
  const [status, setStatus] = useState<RentalStatusChoice>('pending')
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const back = () => navigate(PATHS.adminSchedule)

  if (!hall || !validWeek) {
    return (
      <AdminPage title="대관 신청">
        <section className="adm_section">
          <h2 className="adm_section_title">대리 신청</h2>
          <p className="adm_table_notice">
            대관 일정에서 신청가능한 칸을 눌러 주세요. 전시장과 주를 알아야
            접수할 수 있습니다.
          </p>
          <div className="adm_page_btns">
            <button type="button" className="adm_btn_primary" onClick={back}>
              대관 일정으로
            </button>
          </div>
        </section>
      </AdminPage>
    )
  }

  // 그 주는 수요일부터 7일입니다. (backend/lib/rental.php RENTAL_WEEK_DAYS)
  const end = new Date(`${weekStart}T00:00:00`)
  end.setDate(end.getDate() + 6)
  const weekEnd = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`

  const range = formatDotRange(weekStart, weekEnd)

  const submit = async () => {
    if (saving) return

    // 대관완료는 공개 일정에 곧바로 표시되므로 한 번 더 확인합니다.
    if (status === 'approved' && !confirming) {
      setConfirming(true)
      return
    }

    setSaving(true)
    setError(null)

    try {
      await createDeskBooking({ hallId, weekStart, statement, status })

      setConfirming(false)
      setDone('접수되었습니다.')
    } catch (err: unknown) {
      setConfirming(false)
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : '접수하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminPage title="대관 신청">
      <section className="adm_section">
        <p className="adm_table_notice">대리 신청</p>
        <h2 className="adm_section_title">
          {hall.label} {range}
        </h2>

        <p className="adm_table_notice">
          전화나 방문으로 잡은 주를 직원이 대신 잡아 둡니다.<br />신청자 정보는 묻지
          않습니다.<br />필요한 내용은 아래 메모에 적어 주세요.
        </p>

        <form
          className="adm_form"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          {/* 잡아 두는 주 — 일정에서 눌러 온 값이라 고칠 수 없습니다. */}
          <div className="adm_form_row adm_form_row_col">
            <span className="adm_form_label">잡아 두는 주</span>

            <div className="adm_form_inline">
              <label className="adm_inline_field">
                <span className="adm_inline_label">희망 전시일</span>
                <input
                  type="text"
                  className="adm_form_input"
                  value={range}
                  readOnly
                />
              </label>

              <label className="adm_inline_field">
                <span className="adm_inline_label">희망 전시장</span>
                <input
                  type="text"
                  className="adm_form_input"
                  value={hall.label}
                  readOnly
                />
              </label>
            </div>
          </div>

          {/* 메모 — 대리 신청의 전부입니다. */}
          <div className="adm_form_row adm_form_row_col">
            <label className="adm_form_label" htmlFor="desk_statement">
              메모 <small>(선택 : 비워 두어도 접수됩니다)</small>
            </label>

            <textarea
              id="desk_statement"
              className="adm_form_textarea"
              rows={10}
              maxLength={4000}
              value={statement}
              onChange={(event) => setStatement(event.target.value)}
              placeholder={
                '전화로 들은 내용을 그대로 적어 두세요. 심사할 때 함께 보입니다.\n\n예) 010-1234-5678 김OO 작가님. 개인전, 서양화 20점 예정. 9월 중 정식 신청 예정이라 자리만 잡아 둠.'
              }
            />

            <p className="adm_input_hint">
              이름 · 연락처 · 전시 내용과 작가 약력소개 · 포트폴리오는 이 화면에서
              받지 않습니다. 신청자에게{' '}
              <a
                className="adm_table_link"
                href={`/rental?hall=${hallId}&week=${weekStart}`}
                target="_blank"
                rel="noreferrer"
              >
                홈페이지의 대관 신청
              </a>{' '}
              으로 접수해 달라고 안내해 주세요.
            </p>
          </div>

          {/* 접수 상태 — 심사중은 큐로, 대관완료는 곧바로 일정에. */}
          <div className="adm_radio_field">
            <span className="adm_form_label">접수 상태</span>

            <div
              className="adm_radio_cards"
              role="radiogroup"
              aria-label="접수 상태"
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
                    name="desk_status"
                    value={item.value}
                    checked={status === item.value}
                    disabled={saving}
                    onChange={() => {
                      setStatus(item.value)
                      setConfirming(false)
                    }}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>

            <p className="adm_input_hint">
              심사중은 대관 신청 화면에서 승인 · 반려합니다. 대관완료로 접수하면
              곧바로 공개 일정에 표시됩니다.
            </p>
          </div>

          <div className="adm_form_btns">
            <button
              type="submit"
              className="adm_btn_primary"
              disabled={saving}
            >
              {saving
                ? '접수 중...'
                : confirming
                  ? '대관완료로 접수'
                  : '접수하기'}
            </button>
            <button
              type="button"
              className="adm_btn_secondary"
              disabled={saving}
              onClick={back}
            >
              취소
            </button>
          </div>

          {error !== null && <p className="adm_table_notice">{error}</p>}
        </form>
      </section>

      {/* 대관완료 확인 — 공개 일정이 곧바로 바뀌는 결정입니다. */}
      <AdminConfirm
        open={confirming}
        title="대관완료로 접수할까요?"
        message={
          <>
            <b>
              {hall.label} {range}
            </b>{' '}
            주를 대관완료로 접수합니다. 공개 일정에 곧바로 표시되고, 다른 신청은
            이 주를 신청할 수 없게 됩니다.
          </>
        }
        confirmText="대관완료로 접수"
        busy={saving}
        onConfirm={() => void submit()}
        onCancel={() => setConfirming(false)}
      />

      <AdminAlert
        open={done !== null}
        title={done ?? ''}
        message="대관 일정에 바로 반영됩니다."
        onClose={back}
      />
    </AdminPage>
  )
}
