import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import {
  RENTAL_FILE_LIMITS,
  RENTAL_GENRES,
  RENTAL_HALLS,
  RENTAL_KINDS,
  createBooking,
} from '@/api/rentals'

type RentalFormProps = {
  hallId: string
  /** 수요일 (YYYY-MM-DD) */
  weekStart: string
  /** 화요일 (YYYY-MM-DD) */
  weekEnd: string
  onCancel: () => void
  /** 접수 완료 안내 문구를 만들기 위해 라벨을 돌려줍니다. */
  onDone: (label: string) => void
}

const TERMS_VERSION = '2026-09'

type FileKey = 'bio' | 'portfolio'

/** YYYY-MM-DD → YYYY.MM.DD */
function formatYmd(ymd: string) {
  const [year, month, day] = ymd.split('-')
  return `${year}.${month}.${day}`
}

function formatSize(bytes: number) {
  return `${(bytes / 1048576).toFixed(1)}MB`
}

export default function RentalForm({
  hallId,
  weekStart,
  weekEnd,
  onCancel,
  onDone,
}: RentalFormProps) {
  const hallLabel =
    RENTAL_HALLS.find((hall) => hall.id === hallId)?.label ?? hallId
  const period = `${formatYmd(weekStart)} ~ ${formatYmd(weekEnd)}`

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [postcode, setPostcode] = useState('')
  const [address1, setAddress1] = useState('')
  const [address2, setAddress2] = useState('')

  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [kind, setKind] = useState('solo')
  const [artistCount, setArtistCount] = useState('')
  const [workCount, setWorkCount] = useState('')
  const [genre, setGenre] = useState('')
  const [genreOther, setGenreOther] = useState('')
  const [memo, setMemo] = useState('')

  const [bio, setBio] = useState<File[]>([])
  const [portfolio, setPortfolio] = useState<File[]>([])
  const [agreed, setAgreed] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const totalBytes = [...bio, ...portfolio].reduce(
    (sum, file) => sum + file.size,
    0,
  )

  const handleFileChange = (
    key: FileKey,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const limit = RENTAL_FILE_LIMITS[key]
    const picked = Array.from(event.target.files ?? [])
    const current = key === 'bio' ? bio : portfolio
    const allowed = picked.filter((file) => {
      const extension = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`
      return (
        limit.accept.includes(extension) && file.size <= limit.sizeMB * 1048576
      )
    })

    const next = [...current, ...allowed].slice(0, limit.max)
    if (key === 'bio') setBio(next)
    else setPortfolio(next)

    event.target.value = ''
  }

  const removeFile = (key: FileKey, index: number) => {
    if (key === 'bio') setBio(bio.filter((_, i) => i !== index))
    else setPortfolio(portfolio.filter((_, i) => i !== index))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!name || !email || !phone || !title || !artist) {
      setError('필수 항목을 모두 입력해 주세요.')
      return
    }

    if (!agreed) {
      setError('대관 유의사항에 동의해 주세요.')
      return
    }

    setSending(true)

    try {
      await createBooking(
        {
          hall_id: hallId,
          week_start: weekStart,
          applicant: { name, email, phone, postcode, address1, address2 },
          exhibition: {
            title,
            artist,
            kind,
            artist_count: kind === 'group' ? Number(artistCount) || undefined : undefined,
            work_count: Number(workCount) || undefined,
            genre,
            genre_other: genre === 'other' ? genreOther : undefined,
            memo,
          },
          terms_version: TERMS_VERSION,
        },
        { bio, portfolio },
      )

      onDone(`${hallLabel} · ${period}`)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '신청을 보내지 못했습니다.',
      )
    } finally {
      setSending(false)
    }
  }

  const fileSection = (key: FileKey, files: File[]) => {
    const limit = RENTAL_FILE_LIMITS[key]

    return (
      <div className="rental-files">
        <div className="rental-file-pick">
          <label
            className="btn btn--sm btn--outline"
            htmlFor={`rental-file-${key}`}
          >
            {key === 'bio' ? '파일 고르기' : '이미지 고르기'}
          </label>
          <input
            id={`rental-file-${key}`}
            type="file"
            multiple
            accept={limit.accept}
            onChange={(event) => handleFileChange(key, event)}
          />
          <span className="rental-file-used">
            {files.length}개 / {limit.max}개 · {formatSize(totalBytes)} /{' '}
            {limit.totalMB}MB
          </span>
        </div>

        {files.length > 0 && (
          <ul className="rental-file-list">
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`}>
                <span>
                  {file.name} ({formatSize(file.size)})
                </span>
                <button
                  type="button"
                  className="rental-file-remove"
                  onClick={() => removeFile(key, index)}
                >
                  빼기
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  return (
    <form className="rental-form" onSubmit={handleSubmit}>
      <div className="rental-form__head">
        <h3 className="rental-form__title">대관 신청</h3>
        <p className="rental-form__note">* 표시는 필수 항목입니다</p>
      </div>

      <dl className="rental-summary">
        <div>
          <dt>희망 전시일</dt>
          <dd>{period}</dd>
        </div>
        <div>
          <dt>희망 전시장</dt>
          <dd>{hallLabel}</dd>
        </div>
      </dl>

      {/* 신청자 정보 */}
      <fieldset className="rental-fieldset">
        <legend className="rental-fieldset__legend">신청자 정보</legend>

        <div className="rental-grid rental-grid--2">
          <div className="rental-field">
            <label className="rental-field__label" htmlFor="rq-name">
              신청자 <span className="rental-field__req">*</span>
            </label>
            <input
              id="rq-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="rental-field">
            <label className="rental-field__label" htmlFor="rq-email">
              이메일 <span className="rental-field__req">*</span>
            </label>
            <input
              id="rq-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="rental-field">
            <label className="rental-field__label" htmlFor="rq-phone">
              연락처 <span className="rental-field__req">*</span>
            </label>
            <input
              id="rq-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010-0000-0000"
              required
            />
          </div>

          <div className="rental-field">
            <label className="rental-field__label" htmlFor="rq-postcode">
              우편번호
            </label>
            <input
              id="rq-postcode"
              type="text"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
            />
          </div>

          <div className="rental-field">
            <label className="rental-field__label" htmlFor="rq-address1">
              기본주소
            </label>
            <input
              id="rq-address1"
              type="text"
              value={address1}
              onChange={(e) => setAddress1(e.target.value)}
            />
          </div>

          <div className="rental-field">
            <label className="rental-field__label" htmlFor="rq-address2">
              상세주소
            </label>
            <input
              id="rq-address2"
              type="text"
              value={address2}
              onChange={(e) => setAddress2(e.target.value)}
            />
          </div>
        </div>
      </fieldset>

      {/* 전시 정보 */}
      <fieldset className="rental-fieldset">
        <legend className="rental-fieldset__legend">전시 정보</legend>

        <div className="rental-grid rental-grid--2">
          <div className="rental-field">
            <label className="rental-field__label" htmlFor="rq-title">
              전시명 <span className="rental-field__req">*</span>
            </label>
            <input
              id="rq-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="rental-field">
            <label className="rental-field__label" htmlFor="rq-artist">
              작가명 <span className="rental-field__req">*</span>
            </label>
            <input
              id="rq-artist"
              type="text"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              required
            />
            <span className="rental-field__hint">
              그룹전은 대표 작가명을 적어 주세요.
            </span>
          </div>

          <div className="rental-field">
            <label className="rental-field__label" htmlFor="rq-kind">
              전시구분 <span className="rental-field__req">*</span>
            </label>
            <select
              id="rq-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              {RENTAL_KINDS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          {kind === 'group' && (
            <div className="rental-field">
              <label className="rental-field__label" htmlFor="rq-artist-count">
                참여 작가 수
              </label>
              <input
                id="rq-artist-count"
                type="number"
                min={1}
                value={artistCount}
                onChange={(e) => setArtistCount(e.target.value)}
              />
            </div>
          )}

          <div className="rental-field">
            <label className="rental-field__label" htmlFor="rq-work-count">
              작품 수
            </label>
            <input
              id="rq-work-count"
              type="number"
              min={1}
              value={workCount}
              onChange={(e) => setWorkCount(e.target.value)}
            />
            <span className="rental-field__hint">
              20호 기준 30점 미만
            </span>
          </div>

          <div className="rental-field">
            <label className="rental-field__label" htmlFor="rq-genre">
              전시장르
            </label>
            <select
              id="rq-genre"
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
            >
              <option value="">전시장르 선택</option>
              {RENTAL_GENRES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
              <option value="other">기타 (직접 입력)</option>
            </select>
          </div>

          {genre === 'other' && (
            <div className="rental-field">
              <label className="rental-field__label" htmlFor="rq-genre-other">
                장르 직접 입력
              </label>
              <input
                id="rq-genre-other"
                type="text"
                value={genreOther}
                onChange={(e) => setGenreOther(e.target.value)}
              />
            </div>
          )}

          <div className="rental-field">
            <label className="rental-field__label" htmlFor="rq-memo">
              전달 사항
            </label>
            <textarea
              id="rq-memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="전시 소개나 문의 사항을 적어 주세요."
            />
          </div>
        </div>
      </fieldset>

      {/* 첨부 */}
      <fieldset className="rental-fieldset">
        <legend className="rental-fieldset__legend">
          작가 약력과 포트폴리오
        </legend>

        <div className="rental-grid">
          <div className="rental-field">
            <label className="rental-field__label">작가 약력소개</label>
            <span className="rental-field__hint">
              hwp · txt · ppt · doc · xls · pdf ·{' '}
              {RENTAL_FILE_LIMITS.bio.max}개까지 · 개당{' '}
              {RENTAL_FILE_LIMITS.bio.sizeMB}MB
            </span>
            {fileSection('bio', bio)}
          </div>

          <div className="rental-field">
            <label className="rental-field__label">포트폴리오</label>
            <span className="rental-field__hint">
              jpg · png · gif · {RENTAL_FILE_LIMITS.portfolio.max}장까지 · 장당{' '}
              {RENTAL_FILE_LIMITS.portfolio.sizeMB}MB · 전체{' '}
              {RENTAL_FILE_LIMITS.portfolio.totalMB}MB
            </span>
            {fileSection('portfolio', portfolio)}
          </div>
        </div>
      </fieldset>

      <label className="rental-agree">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
        />
        <span>
          위 대관 유의사항을 확인했으며, 입력한 정보가 대관 심의 목적으로만
          사용되는 데 동의합니다. 입력하신 정보는 대관 심의 외의 다른 목적으로
          사용되지 않습니다. 문의 02-736-6669 · 02-737-6669
        </span>
      </label>

      {error && <p className="rental-error">{error}</p>}

      <div className="rental-actions">
        <button
          type="submit"
          className="btn btn--pill btn--dark"
          disabled={sending}
        >
          {sending ? '보내는 중...' : '신청서 보내기'}
        </button>
        <button
          type="button"
          className="btn btn--pill btn--outline"
          onClick={onCancel}
          disabled={sending}
        >
          취소
        </button>
      </div>
    </form>
  )
}
