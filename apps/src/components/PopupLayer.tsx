import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { fetchActivePopups, type ActivePopup } from '@/api/popups'

/**
 * 공개 사이트 팝업 레이어 — 메인(/)에서만 씁니다.
 *
 * 관리자 > 팝업에서 [사용] 으로 두고 노출기간 안에 들어온 팝업을 띄웁니다.
 *   - 정렬 순서가 작은 것부터 한 장씩 차례로 보여 줍니다.
 *   - [닫기] 로 넘기고, [오늘 하루 보지않기] 를 체크하고 닫으면 24시간 동안 감춥니다.
 *   - 이미지를 누르면 등록한 링크로 이동합니다.
 * 스타일은 assets/css/style.css 의 .popup_* 입니다.
 */

/** 닫은 팝업을 기억하는 열쇠 */
const STORAGE_KEY = 'galleryis.popup.closed'

/** 다시 보이지 않을 시간 — 24시간 */
const HIDE_MS = 24 * 60 * 60 * 1000

/** 오늘 하루 보지 않기로 닫은 팝업 번호 */
function readClosedIds(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)

    if (!raw) return []

    const parsed: unknown = JSON.parse(raw)

    if (parsed === null || typeof parsed !== 'object') return []

    const now = Date.now()
    const ids: number[] = []

    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value !== 'number') continue
      // 24시간이 지난 기록은 무시합니다.
      if (now - value > HIDE_MS) continue

      ids.push(Number(key))
    }

    return ids
  } catch {
    return []
  }
}

/** 닫은 팝업 번호를 기록합니다. */
function rememberClosedId(id: number) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed: Record<string, number> = raw
      ? (JSON.parse(raw) as Record<string, number>)
      : {}

    parsed[String(id)] = Date.now()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
  } catch {
    // 기록하지 못하면 다음 방문에 다시 보여 줍니다.
  }
}

/** 닫은 기록을 모두 지웁니다. (주소에 ?popup=1 을 붙여 다시 볼 때) */
function clearClosedIds() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 지우지 못하면 그대로 둡니다.
  }
}

/** 주소에 ?popup=1 이 있으면 닫은 기록을 무시하고 다시 보여 줍니다. (확인용) */
const FORCE_SHOW = new URLSearchParams(window.location.search).has('popup')

export default function PopupLayer() {
  const [popups, setPopups] = useState<ActivePopup[]>([])
  const [index, setIndex] = useState(0)
  const [hideToday, setHideToday] = useState(false)

  useEffect(() => {
    let cancelled = false

    // 이 호스팅은 요청이 가끔 멈춥니다 → 첫 시도가 실패(시간 초과)하면 한 번 더 받아 봅니다.
    const load = () => fetchActivePopups().catch(() => fetchActivePopups())

    load()
      .then((items) => {
        if (cancelled) return

        // ?popup=1 로 들어왔으면 닫은 기록을 지우고 그대로 보여 줍니다.
        if (FORCE_SHOW) clearClosedIds()

        const closed = FORCE_SHOW ? [] : readClosedIds()

        setPopups(items.filter((item) => !closed.includes(item.id)))
      })
      .catch((err: unknown) => {
        // 팝업이 없는 것으로 보고 넘어갑니다. (공개 화면이 깨지지 않게)
        // 조용히 넘기면 원인을 못 찾으므로 콘솔에는 남깁니다.
        console.warn('[popup] 팝업을 불러오지 못했습니다.', err)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const current = popups[index]

  if (!current) return null

  const close = () => {
    if (hideToday) rememberClosedId(current.id)

    if (index < popups.length - 1) {
      setIndex(index + 1)
      setHideToday(false)

      return
    }

    setPopups([])
  }

  const openLink = () => {
    if (!current.url) return

    if (current.linkTarget === '_blank') {
      window.open(current.url, '_blank', 'noopener')
      return
    }

    window.location.href = current.url
  }

  // 0 인 축은 가운데 정렬합니다.
  const centeredX = current.posLeft === 0
  const centeredY = current.posTop === 0

  const boxStyle: CSSProperties = {
    left: centeredX ? '50%' : `${current.posLeft}px`,
    top: centeredY ? '50%' : `${current.posTop}px`,
    transform: `translate(${centeredX ? '-50%' : '0'}, ${centeredY ? '-50%' : '0'})`,
  }

  return (
    <div className="popup_layer">
      <div
        className="popup_box"
        role="dialog"
        aria-label={current.title}
        style={boxStyle}
      >
        <div
          className="popup_content"
          onClick={openLink}
          style={{ cursor: current.url ? 'pointer' : 'default' }}
        >
          {current.imageUrl ? (
            <img src={current.imageUrl} alt={current.title} />
          ) : (
            <p className="popup_text">{current.title}</p>
          )}
        </div>

        <div className="popup_footer">
          <label className="popup_check">
            <input
              type="checkbox"
              checked={hideToday}
              onChange={(event) => setHideToday(event.target.checked)}
            />
            오늘 하루 보지않기
          </label>

          <div className="popup_actions">
            {popups.length > 1 && (
              <span className="popup_count">
                {index + 1} / {popups.length}
              </span>
            )}
            <button type="button" className="popup_close_btn" onClick={close}>
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
