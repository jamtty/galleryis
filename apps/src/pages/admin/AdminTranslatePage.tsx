import { useCallback, useEffect, useState } from 'react'
import {
  fetchTranslateStatus,
  runTranslate,
  type TranslateScope,
  type TranslateStatus,
  type TranslateTarget,
  type TranslateTargetStatus,
} from '@/api/translate'
import AdminAlert from '@/components/admin/AdminAlert'
import AdminPage from '@/components/admin/AdminPage'

/**
 * 관리자 — 영문 번역.
 *
 * 관리자가 쓴 한국어 글(전시·공지·전시장·팝업·개인정보처리방침)의 **영문**을
 * 번역 서비스로 만들어 둡니다. 화면(EN)은 그 영문을 쓰고, 그 아래에
 * "영문은 기계 번역이며 한국어가 원문"이라고 적습니다.
 *
 *   · 한국어로 새 글을 등록하거나 고치면 저장할 때 자동으로 번역됩니다.
 *     (이 화면은 그 전에 쓴 글 — 번역이 없는 것 — 을 채우는 자리입니다)
 *   · 한 번에 5건씩 되풀이해 부릅니다. 번역 서비스 응답을 기다리는 동안
 *     웹서버가 요청을 끊으면 어디까지 했는지 알 수 없기 때문입니다.
 *   · 번역 키가 없으면 아무 일도 일어나지 않습니다 (backend/config.php).
 */
export default function AdminTranslatePage() {
  const [status, setStatus] = useState<TranslateStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  /** 실행 중인 작업 (대상:범위) — null 이면 쉬는 중 */
  const [running, setRunning] = useState<string | null>(null)
  /** 실행 중 진행 문구 */
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** 끝난 뒤 안내 알럿 */
  const [done, setDone] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetchTranslateStatus()
    setStatus(res)
  }, [])

  useEffect(() => {
    let cancelled = false

    load()
      .then(() => {
        if (!cancelled) setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return

        setLoadError(
          err instanceof Error ? err.message : '번역 현황을 불러오지 못했습니다.',
        )
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [load])

  /**
   * 번역 실행 — 남은 것이 없어질 때까지 (또는 실패가 이어질 때까지) 되풀이합니다.
   *
   * `stale` 은 원문이 바뀐 것만, `missing` 은 아직 없는 것만 골라 오므로
   * 한 바퀴마다 대상이 줄어듭니다. (그래서 끝이 있습니다)
   */
  const run = async (target: TranslateTarget, only: TranslateScope) => {
    if (running) return

    const key = `${target}:${only}`
    setRunning(key)
    setProgress(null)
    setError(null)

    let processed = 0
    let doneCount = 0
    let failed = 0
    let round = 0

    try {
      while (round < 200) {
        round += 1

        const res = await runTranslate(target, only, 5)

        processed += res.processed
        doneCount += res.done
        failed += res.failed

        setProgress(`${processed}건 처리 · 남은 ${res.remaining}건`)

        // 더 고를 것이 없거나, 처리했는데도 남은 수가 줄지 않으면 멈춥니다.
        if (res.processed === 0 || res.remaining <= 0) break
        if (res.done === 0) break
      }

      await load()

      setDone(
        `${processed}건을 처리해 ${doneCount}개 항목을 번역했습니다.`
          + (failed > 0 ? ` (실패 ${failed}건 — 서버 로그를 확인해 주세요)` : ''),
      )
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '번역을 실행하지 못했습니다.',
      )
    } finally {
      setRunning(null)
      setProgress(null)
    }
  }

  const renderRow = (row: TranslateTargetStatus) => {
    const pending = row.missing + row.stale
    const busy = running?.startsWith(`${row.entity}:`) ?? false

    return (
      <tr key={row.entity}>
        <td className="adm_td_left">{row.label}</td>
        <td className="tabular-nums">{row.items}</td>
        <td className="tabular-nums">{row.done}</td>
        <td className="tabular-nums">{row.missing}</td>
        <td className="tabular-nums">{row.stale}</td>
        <td>
          <div className="adm_page_btns">
            <button
              type="button"
              className="adm_btn_primary"
              disabled={running !== null || row.missing === 0}
              onClick={() => void run(row.entity, 'missing')}
            >
              {busy && running === `${row.entity}:missing`
                ? '번역 중...'
                : '남은 것 번역'}
            </button>
            <button
              type="button"
              className="adm_btn_secondary"
              disabled={running !== null || row.stale === 0}
              onClick={() => void run(row.entity, 'stale')}
            >
              {busy && running === `${row.entity}:stale`
                ? '번역 중...'
                : '원문 바뀐 것'}
            </button>
            {pending === 0 && (
              <span className="adm_setting_hint">모두 번역되었습니다</span>
            )}
          </div>
        </td>
      </tr>
    )
  }

  return (
    <AdminPage title="영문 번역">
      <section className="adm_section">
        <h2 className="adm_section_title">영문 번역</h2>

        {loading && <p className="adm_table_notice">불러오는 중입니다...</p>}

        {!loading && loadError && (
          <>
            <p className="adm_table_notice">{loadError}</p>

            <div className="adm_page_btns">
              <button
                type="button"
                className="adm_btn_primary"
                onClick={() => window.location.reload()}
              >
                다시 시도
              </button>
            </div>
          </>
        )}

        {!loading && !loadError && status && (
          <>
            {/* 번역 서비스를 쓸 수 없는 두 가지 경우를 따로 알립니다. */}
            {!status.tableReady && (
              <p className="adm_table_notice">
                {status.message ||
                  '번역 표가 없습니다. phpMyAdmin 에서 backend/sql/translation.sql 을 실행해 주세요.'}
              </p>
            )}

            {status.tableReady && !status.enabled && (
              <p className="adm_table_notice">
                번역 서비스 키가 없어 아직 번역하지 않습니다. backend/config.php 의
                <code> translate </code> 설정에 키를 넣으면 이 화면이 살아납니다.
                (지금도 사이트는 한국어로 정상 동작합니다)
              </p>
            )}

            {error && <p className="adm_table_notice">{error}</p>}

            {progress && <p className="adm_table_notice">번역 중 — {progress}</p>}

            <div className="adm_table_wrap">
              <table className="adm_table">
                <thead>
                  <tr>
                    <th>대상</th>
                    <th>항목</th>
                    <th>번역됨</th>
                    <th>남음</th>
                    <th>원문 바뀜</th>
                    <th>작업</th>
                  </tr>
                </thead>
                <tbody>
                  {status.targets.length === 0 ? (
                    <tr>
                      <td className="adm_table_empty" colSpan={6}>
                        번역할 글이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    status.targets.map(renderRow)
                  )}
                </tbody>
              </table>
            </div>

            <p className="adm_translate_note">
              영문은 기계 번역이라 한국어 원문과 다를 수 있습니다. 새 글을 등록하거나
              고치면 저장할 때 그 항목만 다시 번역됩니다.
              {status.providerLabel && <> 사용 중: {status.providerLabel}</>}
            </p>
          </>
        )}
      </section>

      <AdminAlert
        open={done !== null}
        title="번역을 마쳤습니다"
        message={done ?? ''}
        onClose={() => setDone(null)}
      />
    </AdminPage>
  )
}
