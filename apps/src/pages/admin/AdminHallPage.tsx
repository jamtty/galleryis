import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchHallList, type HallItem } from '@/api/halls'
import AdminPage from '@/components/admin/AdminPage'
import { PATHS } from '@/routes/paths'
import { formatDotDate } from '@/utils/date'

/**
 * 관리자 — 전시장 관리.
 *
 * 전시장은 **4개 고정**입니다. (대관 신청서·대관 일정 표가 hall1~hall4 로 동작)
 * 그래서 등록·삭제가 없고, 내용·사진·노출 여부만 수정합니다.
 * 공개 화면은 /halls 페이지입니다.
 */

/** 목록 열 */
const COLUMNS = ['층', '전시장', '규모', '사진', '노출', '수정일', '관리']

export default function AdminHallPage() {
  const navigate = useNavigate()

  const [items, setItems] = useState<HallItem[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false

    fetchHallList()
      .then((res) => {
        if (cancelled) return

        setItems(res.items)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return

        setMessage(
          err instanceof Error ? err.message : '전시장 목록을 불러오지 못했습니다.',
        )
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <AdminPage title="전시장 관리">
      <section className="adm_section">
        <h2 className="adm_section_title">전시장 관리</h2>

        <p className="adm_table_notice">
          전시장은 4개로 고정입니다. (대관 신청서와 대관 일정 표가 hall1 ~ hall4 로
          동작합니다) 내용과 사진만 수정할 수 있습니다.
        </p>

        {message && <p className="adm_table_notice">{message}</p>}

        {loading && <p className="adm_table_notice">불러오는 중입니다...</p>}

        <div className="adm_table_wrap">
          <table className="adm_table">
            <thead>
              <tr>
                {COLUMNS.map((column) => (
                  <th key={column} scope="col">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {!loading && items.length === 0 && (
                <tr>
                  <td className="adm_table_empty" colSpan={COLUMNS.length}>
                    {message
                      ? '목록을 불러오지 못했습니다.'
                      : '전시장이 없습니다. phpMyAdmin 에서 backend/sql/hall.sql 을 실행해 주세요.'}
                  </td>
                </tr>
              )}

              {!loading &&
                items.map((item) => (
                  <tr key={item.id}>
                    <td className="adm_td_center">{item.floor || '-'}</td>
                    <td>{item.name}</td>
                    <td>{item.spec || '-'}</td>
                    <td className="adm_td_center">
                      {item.photos.length}장
                    </td>
                    <td className="adm_td_center">
                      <span
                        className={
                          item.useYn === 'Y' ? 'adm_badge_on' : 'adm_badge_off'
                        }
                      >
                        {item.useYn === 'Y' ? '사용' : '미사용'}
                      </span>
                    </td>
                    <td>{formatDotDate(item.updatedAt)}</td>
                    <td className="adm_td_center">
                      <div className="adm_action_btns">
                        <button
                          type="button"
                          className="adm_btn_edit"
                          onClick={() =>
                            navigate(
                              PATHS.adminHallEdit.replace(
                                ':id',
                                String(item.id),
                              ),
                            )
                          }
                        >
                          수정
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminPage>
  )
}
