import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  HALL_FILE_LIMIT,
  HALL_PLAN_LIMIT,
  HALL_SEASONS,
  HALL_SHEET_LIMIT,
  HALL_USE_OPTIONS,
  fetchHallDetail,
  hallPhotoSaved,
  updateHall,
  type HallInput,
  type HallSeasonKey,
  type HallUse,
} from '@/api/halls'
import AdminAlert from '@/components/admin/AdminAlert'
import AdminPage from '@/components/admin/AdminPage'
import ArtworkDropzone, {
  type SavedArtwork,
} from '@/components/admin/ArtworkDropzone'
import { PATHS } from '@/routes/paths'

/**
 * 관리자 — 전시장 수정.
 *
 *   /admin/halls/edit/:id
 *
 * 전시장은 4개 고정이라 등록·삭제가 없습니다. (대관 시스템이 hall1~hall4 로 동작)
 * 여기서 고친 값이 공개 /halls 페이지에 그대로 나갑니다.
 */

/** 금액 입력 → 숫자 (₩·콤마는 무시) */
function toNumber(value: string) {
  return Number(value.replace(/[^0-9]/g, '')) || 0
}

type SeasonState = Record<HallSeasonKey, { price: string; months: string }>

const EMPTY_SEASONS: SeasonState = {
  peak: { price: '', months: '' },
  off: { price: '', months: '' },
  high: { price: '', months: '' },
}

export default function AdminHallFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()

  const hallId = Number(id)
  const valid = Number.isInteger(hallId) && hallId > 0

  const [name, setName] = useState('')
  const [floor, setFloor] = useState('')
  const [spec, setSpec] = useState('')
  const [seasons, setSeasons] = useState<SeasonState>(EMPTY_SEASONS)
  const [priceNote, setPriceNote] = useState('')
  const [useYn, setUseYn] = useState<HallUse>('Y')

  /** 도면·조감도 — 새로 고른 파일이 있을 때만 교체됩니다. */
  const [sheet, setSheet] = useState<File | null>(null)
  const [savedSheetUrl, setSavedSheetUrl] = useState('')

  /** 도면 파일(내려받기용) — 새로 고른 파일이 있을 때만 교체됩니다. */
  const [plan, setPlan] = useState<File | null>(null)
  /** 서버에 저장된 도면 파일명 (없으면 빈 값) */
  const [savedPlanName, setSavedPlanName] = useState('')
  const [savedPlanUrl, setSavedPlanUrl] = useState('')

  const [photos, setPhotos] = useState<File[]>([])
  /** 서버에 저장된 사진 — 남아 있는 것만 유지됩니다. */
  const [savedPhotos, setSavedPhotos] = useState<SavedArtwork[]>([])

  const [loading, setLoading] = useState(valid)
  const [loadError, setLoadError] = useState<string | null>(
    valid ? null : '전시장 번호가 올바르지 않습니다.',
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** 저장 완료 안내 알럿 문구 */
  const [done, setDone] = useState<string | null>(null)

  const back = () => navigate(PATHS.adminHalls)

  // 저장된 내용을 채웁니다.
  useEffect(() => {
    if (!valid) return

    let cancelled = false

    fetchHallDetail(hallId)
      .then((res) => {
        if (cancelled) return

        setName(res.name)
        setFloor(res.floor)
        setSpec(res.spec)
        setSeasons({
          peak: {
            price: res.pricePeak > 0 ? String(res.pricePeak) : '',
            months: res.monthPeak,
          },
          off: {
            price: res.priceOff > 0 ? String(res.priceOff) : '',
            months: res.monthOff,
          },
          high: {
            price: res.priceHigh > 0 ? String(res.priceHigh) : '',
            months: res.monthHigh,
          },
        })
        setPriceNote(res.priceNote)
        setUseYn(res.useYn === 'N' ? 'N' : 'Y')
        setSavedSheetUrl(res.sheetUrl)
        setSavedPlanName(res.planName)
        setSavedPlanUrl(res.planUrl)
        setSavedPhotos(res.photos.map(hallPhotoSaved))
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return

        setLoadError(
          err instanceof Error ? err.message : '전시장을 불러오지 못했습니다.',
        )
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [hallId, valid])

  /** 새로 고른 도면 미리보기 주소 (파일을 고르면 만들어 두고 바뀔 때 정리) */
  const sheetObjectUrl = useMemo(
    () => (sheet ? URL.createObjectURL(sheet) : ''),
    [sheet],
  )

  useEffect(
    () => () => {
      if (sheetObjectUrl) URL.revokeObjectURL(sheetObjectUrl)
    },
    [sheetObjectUrl],
  )

  /** 화면에 보여 줄 도면 (새로 고른 파일 우선) */
  const sheetSrc = sheet ? sheetObjectUrl : savedSheetUrl

  /** 새로 고른 도면 파일 미리보기 주소 */
  const planObjectUrl = useMemo(
    () => (plan ? URL.createObjectURL(plan) : ''),
    [plan],
  )

  useEffect(
    () => () => {
      if (planObjectUrl) URL.revokeObjectURL(planObjectUrl)
    },
    [planObjectUrl],
  )

  /** 도면 파일이 그림이면 미리보기를, 아니면 파일명만 보여 줍니다. */
  const planSrc = plan ? planObjectUrl : savedPlanUrl
  const planLabel = plan ? plan.name : savedPlanName

  const setSeason = (
    key: HallSeasonKey,
    patch: Partial<{ price: string; months: string }>,
  ) => {
    setSeasons((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!valid) return

    if (!name.trim()) {
      setError('전시장명을 입력해 주세요.')
      return
    }

    if (!floor.trim()) {
      setError('층(위치)을 입력해 주세요.')
      return
    }

    if (sheet && sheet.size > HALL_SHEET_LIMIT.sizeMB * 1024 * 1024) {
      setError(
        `도면·조감도는 ${HALL_SHEET_LIMIT.sizeMB}MB 이하만 올릴 수 있습니다.`,
      )
      return
    }

    if (plan && plan.size > HALL_PLAN_LIMIT.sizeMB * 1024 * 1024) {
      setError(`도면 파일은 ${HALL_PLAN_LIMIT.sizeMB}MB 이하만 올릴 수 있습니다.`)
      return
    }

    setSaving(true)

    const input: HallInput = {
      name: name.trim(),
      floor: floor.trim(),
      spec: spec.trim(),
      price_peak: toNumber(seasons.peak.price),
      month_peak: seasons.peak.months.trim(),
      price_off: toNumber(seasons.off.price),
      month_off: seasons.off.months.trim(),
      price_high: toNumber(seasons.high.price),
      month_high: seasons.high.months.trim(),
      price_note: priceNote.trim(),
      use_yn: useYn,
    }

    try {
      await updateHall(hallId, input, {
        files: photos,
        keep: savedPhotos.map((photo) => photo.id),
        sheet,
        plan,
      })

      // 저장 결과를 알리고, [확인] 을 누르면 목록으로 돌아갑니다.
      setDone('수정되었습니다.')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '전시장을 수정하지 못했습니다.',
      )
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <AdminPage title="전시장 수정">
        <section className="adm_section">
          <h2 className="adm_section_title">전시장 수정</h2>
          <p className="adm_table_notice">불러오는 중입니다...</p>
        </section>
      </AdminPage>
    )
  }

  if (loadError) {
    return (
      <AdminPage title="전시장 수정">
        <section className="adm_section">
          <h2 className="adm_section_title">전시장 수정</h2>
          <p className="adm_table_notice">{loadError}</p>

          <div className="adm_form_btns">
            <button type="button" className="adm_btn_secondary" onClick={back}>
              목록으로
            </button>
          </div>
        </section>
      </AdminPage>
    )
  }

  return (
    <AdminPage title="전시장 수정">
      <section className="adm_section">
        <h2 className="adm_section_title">전시장 수정</h2>

        <p className="adm_table_notice">
          전시장은 4개로 고정입니다. 여기서 고친 내용이 공개 /halls 페이지에 그대로
          나갑니다. (금액은 원 단위 · 0 이면 공개 화면에서 그 줄을 표시하지 않습니다)
        </p>

        {error && <p className="adm_table_notice">{error}</p>}

        <form className="adm_form" onSubmit={handleSubmit} noValidate>
          {/* 전시장명 */}
          <div className="adm_form_row">
            <label className="adm_form_label" htmlFor="hall-name">
              전시장명 <span className="required">*</span>
            </label>
            <input
              id="hall-name"
              type="text"
              className="adm_form_input"
              value={name}
              maxLength={100}
              placeholder="예) 제1전시장"
              onChange={(event) => setName(event.target.value)}
              disabled={saving}
            />
          </div>

          {/* 층(위치) */}
          <div className="adm_form_row adm_form_row_col">
            <label className="adm_form_label" htmlFor="hall-floor">
              층(위치) <span className="required">*</span>
            </label>
            <input
              id="hall-floor"
              type="text"
              className="adm_form_input"
              value={floor}
              maxLength={20}
              placeholder="예) 1F"
              onChange={(event) => setFloor(event.target.value)}
              disabled={saving}
            />
            <p className="adm_input_hint">
              공개 페이지 위쪽 앵커 버튼에 `1F · 제1전시장` 처럼 표시됩니다.
            </p>
          </div>

          {/* 규모 */}
          <div className="adm_form_row">
            <label className="adm_form_label" htmlFor="hall-spec">
              규모
            </label>
            <input
              id="hall-spec"
              type="text"
              className="adm_form_input"
              value={spec}
              maxLength={200}
              placeholder="예) 181m² · 55평 (공유면적 포함) · 층고 280cm"
              onChange={(event) => setSpec(event.target.value)}
              disabled={saving}
            />
          </div>

          {/* 시즌별 요금 — 요금과 해당 월을 함께 입력합니다. */}
          {HALL_SEASONS.map((season) => (
            <div className="adm_form_row adm_form_row_col" key={season.key}>
              <label
                className="adm_form_label"
                htmlFor={`hall-price-${season.key}`}
              >
                {season.label}
              </label>

              <div className="adm_form_inline">
                <div className="adm_inline_field adm_inline_field_price">
                  <label
                    className="adm_inline_label"
                    htmlFor={`hall-price-${season.key}`}
                  >
                    요금(원)
                  </label>
                  <input
                    id={`hall-price-${season.key}`}
                    type="text"
                    inputMode="numeric"
                    className="adm_form_input"
                    value={seasons[season.key].price}
                    maxLength={12}
                    placeholder="예) 5500000"
                    onChange={(event) =>
                      setSeason(season.key, { price: event.target.value })
                    }
                    disabled={saving}
                  />
                </div>

                <div className="adm_inline_field">
                  <label
                    className="adm_inline_label"
                    htmlFor={`hall-months-${season.key}`}
                  >
                    해당 월
                  </label>
                  <input
                    id={`hall-months-${season.key}`}
                    type="text"
                    className="adm_form_input"
                    value={seasons[season.key].months}
                    maxLength={50}
                    placeholder="예) 3~6·9·12월"
                    onChange={(event) =>
                      setSeason(season.key, { months: event.target.value })
                    }
                    disabled={saving}
                  />
                </div>
              </div>

              <p className="adm_input_hint">
                요금을 0 으로 두면 공개 화면에서 그 줄을 표시하지 않습니다.
              </p>
            </div>
          ))}

          {/* 요금 안내 */}
          <div className="adm_form_row">
            <label className="adm_form_label" htmlFor="hall-note">
              요금 안내
            </label>
            <input
              id="hall-note"
              type="text"
              className="adm_form_input"
              value={priceNote}
              maxLength={100}
              placeholder="예) 주 단위 · VAT 포함"
              onChange={(event) => setPriceNote(event.target.value)}
              disabled={saving}
            />
          </div>

          {/* 도면·조감도 */}
          <div className="adm_form_row adm_form_row_col">
            <label className="adm_form_label" htmlFor="hall-sheet">
              도면·조감도
            </label>

            <div className="adm_sheet">
              <div className="adm_sheet_preview">
                {sheetSrc ? (
                  <img src={sheetSrc} alt="도면·조감도 미리보기" />
                ) : (
                  <span className="adm_sheet_empty">이미지 없음</span>
                )}
              </div>

              <div className="adm_sheet_side">
                <input
                  id="hall-sheet"
                  className="adm_sheet_input"
                  type="file"
                  accept={HALL_SHEET_LIMIT.accept}
                  onChange={(event) => {
                    setError(null)
                    setSheet(event.target.files?.[0] ?? null)
                  }}
                  disabled={saving}
                />

                <label
                  className="adm_btn_secondary adm_sheet_pick"
                  htmlFor="hall-sheet"
                >
                  {savedSheetUrl ? '이미지 교체' : '이미지 선택'}
                </label>

                {sheet && (
                  <button
                    type="button"
                    className="adm_sheet_reset"
                    onClick={() => setSheet(null)}
                    disabled={saving}
                  >
                    선택 취소
                  </button>
                )}

                <p className="adm_input_hint">
                  도면과 조감도를 나란히 넣은 가로 이미지를 권장합니다.
                  <br />
                  jpg · png · gif · webp / {HALL_SHEET_LIMIT.sizeMB}MB 이하 ·
                  고르지 않으면 지금 이미지가 그대로 유지됩니다.
                </p>
              </div>
            </div>
          </div>

          {/* 전시장 사진 */}
          <div className="adm_form_row adm_form_row_col">
            <label className="adm_form_label">전시장 사진</label>
            <ArtworkDropzone
              files={photos}
              onChange={(next) => {
                setError(null)
                setPhotos(next)
              }}
              saved={savedPhotos}
              onRemoveSaved={(photoId) => {
                setError(null)
                setSavedPhotos((prev) =>
                  prev.filter((photo) => photo.id !== photoId),
                )
              }}
              max={HALL_FILE_LIMIT.max}
              sizeMB={HALL_FILE_LIMIT.sizeMB}
              totalMB={HALL_FILE_LIMIT.totalMB}
              accept={HALL_FILE_LIMIT.accept}
              onError={setError}
              disabled={saving}
            />
          </div>

          {/* 3D 둘러보기 */}
          <div className="adm_form_row adm_form_row_col">
            <span className="adm_form_label">3D 둘러보기</span>
            <p className="adm_input_hint">
              공개 /halls 의 [3D로 둘러보기] 버튼은 사이트 안의 3D 화면으로
              들어갑니다. (전시장 사진을 벽 4면에 붙여 둘러보는 화면)
              <br />
              규모에 적은 면적·층고로 방을 만들기 때문에, 규모를 고치면 3D 도
              함께 바뀝니다. 사진이 없으면 버튼이 나오지 않습니다.
            </p>
          </div>

          {/* 도면 파일 (내려받기용) */}
          <div className="adm_form_row adm_form_row_col">
            <label className="adm_form_label" htmlFor="hall-plan">
              도면 파일 (내려받기)
            </label>

            <div className="adm_sheet">
              <div className="adm_sheet_preview">
                {planSrc ? (
                  <img src={planSrc} alt="도면 미리보기" />
                ) : (
                  <span className="adm_sheet_empty">
                    {planLabel === '' ? '파일 없음' : planLabel}
                  </span>
                )}
              </div>

              <div className="adm_sheet_side">
                <input
                  id="hall-plan"
                  className="adm_sheet_input"
                  type="file"
                  accept={HALL_PLAN_LIMIT.accept}
                  onChange={(event) => {
                    setError(null)
                    setPlan(event.target.files?.[0] ?? null)
                  }}
                  disabled={saving}
                />

                <label
                  className="adm_btn_secondary adm_sheet_pick"
                  htmlFor="hall-plan"
                >
                  {savedPlanName ? '파일 교체' : '파일 선택'}
                </label>

                {plan && (
                  <button
                    type="button"
                    className="adm_sheet_reset"
                    onClick={() => setPlan(null)}
                    disabled={saving}
                  >
                    선택 취소
                  </button>
                )}

                <p className="adm_input_hint">
                  공개 화면 [도면 내려받기] 버튼에 연결되는 파일입니다.
                  <br />
                  jpg · png · gif · webp / {HALL_PLAN_LIMIT.sizeMB}MB 이하 ·
                  고르지 않으면 지금 파일이 그대로 유지됩니다.
                  <br />
                  파일명: {planLabel || '없음'}
                </p>
              </div>
            </div>
          </div>

          {/* 노출 여부 */}
          <div className="adm_form_row">
            <span className="adm_form_label">노출 여부</span>
            <div className="adm_radio_field">
              <div
                className="adm_radio_cards"
                role="radiogroup"
                aria-label="노출 여부"
              >
                {HALL_USE_OPTIONS.map((item) => (
                  <label
                    key={item.value}
                    className={
                      useYn === item.value
                        ? 'adm_radio_card is-selected'
                        : 'adm_radio_card'
                    }
                  >
                    <input
                      type="radio"
                      name="h_use_yn"
                      value={item.value}
                      checked={useYn === item.value}
                      disabled={saving}
                      onChange={() => setUseYn(item.value)}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>

              <p className="adm_input_hint">
                미사용으로 두면 공개 /halls 페이지에 나오지 않습니다.
              </p>
            </div>
          </div>

          <div className="adm_form_btns">
            <button
              type="button"
              className="adm_btn_secondary"
              onClick={back}
              disabled={saving}
            >
              취소
            </button>
            <button type="submit" className="adm_btn_primary" disabled={saving}>
              {saving ? '수정 중...' : '수정'}
            </button>
          </div>
        </form>
      </section>

      <AdminAlert open={done !== null} title={done ?? ''} onClose={back} />
    </AdminPage>
  )
}
