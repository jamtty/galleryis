import { useState } from 'react'
import AdminDateRange from './AdminDateRange'

/** 백엔드 연동 전임을 알리는 공통 문구 */
export const ADMIN_PENDING_NOTICE =
  '아직 백엔드 API 와 연결되지 않았습니다. backend/ 배포 및 DB 연동 후 목록이 표시됩니다.'

type AdminListSkeletonProps = {
  /** 표 헤더 */
  columns: readonly string[]
  /** 목록이 비었을 때 표시할 문구 */
  emptyText?: string
  /** 표 위에 표시할 안내 문구 (기본: 연동 전 안내) */
  notice?: string | null
}

/**
 * 관리자 목록 페이지의 뼈대.
 * 검색 툴바 + 표 + 페이지네이션 자리를 실제 디자인 클래스로 구성합니다.
 * (데이터 연동은 다음 단계)
 */
export default function AdminListSkeleton({
  columns,
  emptyText = '등록된 항목이 없습니다.',
  notice = ADMIN_PENDING_NOTICE,
}: AdminListSkeletonProps) {
  const pending = '백엔드 연동 후 동작합니다.'

  /** 연동 전이라 동작하지 않습니다 (모양만) */
  const [range, setRange] = useState({ from: '', to: '' })

  return (
    <>
      <div className="adm_toolbar">
        <div className="adm_search_form">
          <div className="adm_search_row">
            <AdminDateRange
              from={range.from}
              to={range.to}
              onChange={setRange}
              disabled
              title={pending}
            />
          </div>

          <div className="adm_search_row">
            <span className="adm_search_label">검색</span>
            <input
              type="text"
              placeholder="검색어를 입력하세요."
              aria-label="검색어"
              title={pending}
            />
            <button type="button" className="adm_btn_secondary" title={pending}>
              검색
            </button>
          </div>
        </div>
        <button type="button" className="adm_btn_primary" title={pending}>
          신규 등록
        </button>
      </div>

      {notice && <p className="adm_table_notice">{notice}</p>}

      <div className="adm_table_wrap">
        <table className="adm_table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column} scope="col">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="adm_table_empty" colSpan={columns.length}>
                {emptyText}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="adm_pagination">
        <div className="adm_pagination_left">
          <span className="adm_total_count">전체 0건</span>
        </div>
      </div>
    </>
  )
}
