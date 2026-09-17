import { useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent, FormEvent, KeyboardEvent } from 'react'
import {
  EMAIL_DOMAINS,
  RENTAL_FILE_LIMITS,
  RENTAL_GENRES,
  RENTAL_HALLS,
  RENTAL_KINDS,
  createBooking,
  updateBooking,
  type RentalAttachment,
} from '@/api/rentals'
import { formatDotRange } from '@/utils/date'

/** 관리자 수정 모드에서 미리 채울 값 */
export type RentalFormInitial = {
  /** wr_id */
  id: number
  /** 전시장 라벨 (hallId 를 못 찾았을 때 표시용) */
  hall: string
  name: string
  email: string
  phone: string
  postcode: string
  address1: string
  address2: string
  kind: string
  genre: string
  artistCount: string
  workCount: string
  memo: string
  bio: RentalAttachment[]
  portfolio: RentalAttachment[]
}

type RentalFormProps = {
  hallId: string
  /** 수요일 (YYYY-MM-DD) */
  weekStart: string
  /** 화요일 (YYYY-MM-DD) */
  weekEnd: string
  onCancel: () => void
  /** 접수 완료 안내 문구를 만들기 위해 라벨을 돌려줍니다. */
  onDone: (label: string) => void
  /** 값이 있으면 새로 접수하지 않고 저장된 신청서를 수정합니다. */
  initial?: RentalFormInitial
  /**
   * 대관 유의사항 영역을 감춥니다 (관리자 수정 화면).
   * 신청자에게 보여 주는 안내·동의 영역이라 관리자에게는 필요 없습니다.
   */
  hideTerms?: boolean
}

const POSTCODE_SRC =
  'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'

/** 휴대전화 앞자리 선택지 */
const PHONE_PREFIXES = ['010', '011', '016', '017', '018', '019'] as const

/** 동의한 대관 유의사항 버전 */
const TERMS_VERSION = '2026-09'

/** 대관 유의사항 (전문 보기) */
const RENTAL_TERMS = [
  {
    title: '1. 대관 취소',
    items: [
      '대관을 통보한 후 7일 이내에 계약을 체결하지 않은 경우',
      '대관료를 정해진 날짜까지 납부하지 않은 경우',
      '금지된 사항 및 계약사항을 위반할 경우 대관이 취소될 수 있습니다.',
    ],
  },
  {
    title: '2. 작품 반입, 반출 및 부대시설 사용',
    items: [
      '전시 준비와 정리를 위하여 전시장을 사용하는 경우도 대관일수 산정에 포함됩니다. 대관은 7일 기준으로 합니다.',
      '부대시설 사용 및 사용료 납부, 전시를 위한 실무협의(전시 시작 2주일전)가 있습니다.',
      '모든 전시장의 작품 반입 반출이 같은 날 이루어짐으로써 사전협의 하에 반입, 반출 시간이 조정될 수 있습니다.',
    ],
  },
  {
    title: '3. 작품설치',
    items: [
      '갤러리이즈에서 사용하는 못과 나사피스로만 작품 설치가 가능하며, 대못, 타카, 본드, 글루건, 양면테이프, 청테이프, 접착 폼보드는 사용할 수 없습니다.(셀로판테이프, 압정으로 대체 사용)',
    ],
  },
  {
    title: '4. 기타',
    items: [
      '대관 사용권을 타인에게 양도하거나 전시 기간 중 전시목적과 상이한 작품 또는 물품을 판매하는 행위는 금지되어 있습니다.',
      '전시 및 행위의 목적과 내용을 승인된 내용과 다르게 하거나, 갤러리이즈 시설과 설비를 변경, 훼손하는 행위는 금지되어있습니다.',
      '훼손 시 복구에 대한 책임은 대관자에게 있습니다.',
      '전시와 관련하여 발생하는 폐기물(포장재료 등)의 처리비용은 대관자가 부담합니다.',
    ],
  },
] as const

/** 422 KB / 1.4 MB 처럼 보여 줍니다. */
function formatSize(bytes: number) {
  if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

/** 1 이상 정수인지 (빈 값·0·소수·문자 모두 거르기) */
function isPositiveInteger(value: string) {
  const number = Number(value)
  return value.trim() !== '' && Number.isInteger(number) && number >= 1
}

/** "test@naver.com" → [아이디, 도메인] */
function splitEmail(value: string) {
  const at = value.indexOf('@')

  if (at < 0) return [value, ''] as const

  return [value.slice(0, at), value.slice(at + 1)] as const
}

/** "010-4354-3543" → [앞, 가운데, 끝] */
function splitPhone(value: string) {
  const parts = value.split('-').filter(Boolean)

  return [parts[0] ?? '', parts[1] ?? '', parts[2] ?? ''] as const
}

/** 배열에 값이 들어 있는지 (readonly 배열 호환) */
function has(items: readonly string[], value: string) {
  return (items as readonly string[]).includes(value)
}

/** 드롭존의 카메라 아이콘 */
function CameraIcon() {
  return (
    <svg className="rental-dropzone__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M9 4h6l1.3 2H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.7L9 4Z"
        fill="currentColor"
      />
      <circle cx="12" cy="13" r="4.2" fill="#fff" />
      <circle cx="12" cy="13" r="2.8" fill="currentColor" />
    </svg>
  )
}

/** 다음 우편번호 스크립트를 한 번만 불러옵니다. */
let postcodeLoader: Promise<void> | null = null

function loadPostcode() {
  if (window.daum?.Postcode) return Promise.resolve()

  if (!postcodeLoader) {
    postcodeLoader = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(
        `script[src="${POSTCODE_SRC}"]`,
      )

      if (existing) {
        existing.addEventListener('load', () => resolve())
        existing.addEventListener('error', () => reject(new Error('load')))
        return
      }

      const script = document.createElement('script')
      script.src = POSTCODE_SRC
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('load'))
      document.head.appendChild(script)
    })
  }

  return postcodeLoader
}

export default function RentalForm({
  hallId,
  weekStart,
  weekEnd,
  onCancel,
  onDone,
  initial,
  hideTerms = false,
}: RentalFormProps) {
  const editing = initial !== undefined
  const [savedEmailId, savedEmailDomain] = splitEmail(initial?.email ?? '')
  const [savedPhone1, savedPhone2, savedPhone3] = splitPhone(initial?.phone ?? '')
  // 저장된 장르가 목록에 없으면 '기타 직접 입력' 으로 되돌립니다.
  const savedGenreKnown =
    initial !== undefined && has(RENTAL_GENRES, initial.genre)
  const savedDomainKnown = has(EMAIL_DOMAINS, savedEmailDomain)

  // 신청자
  const [name, setName] = useState(initial?.name ?? '')
  const [emailId, setEmailId] = useState(savedEmailId)
  const [emailDomain, setEmailDomain] = useState(
    savedEmailDomain === ''
      ? ''
      : savedDomainKnown
        ? savedEmailDomain
        : 'custom',
  )
  const [emailDomainCustom, setEmailDomainCustom] = useState(
    savedEmailDomain !== '' && !savedDomainKnown ? savedEmailDomain : '',
  )
  const [phone1, setPhone1] = useState(savedPhone1)
  const [phone2, setPhone2] = useState(savedPhone2)
  const [phone3, setPhone3] = useState(savedPhone3)
  const [postcode, setPostcode] = useState(initial?.postcode ?? '')
  const [address1, setAddress1] = useState(initial?.address1 ?? '')
  const [address2, setAddress2] = useState(initial?.address2 ?? '')

  // 전시 정보
  const [kind, setKind] = useState(initial?.kind || 'solo')
  const [genre, setGenre] = useState(
    initial === undefined ? '' : savedGenreKnown ? initial.genre : 'other',
  )
  const [genreOther, setGenreOther] = useState(
    initial === undefined || savedGenreKnown ? '' : initial.genre,
  )

  const [artistCount, setArtistCount] = useState(initial?.artistCount ?? '')
  const [workCount, setWorkCount] = useState(initial?.workCount ?? '')
  const [memo, setMemo] = useState(initial?.memo ?? '')

  const [bio, setBio] = useState<File[]>([])
  const [portfolio, setPortfolio] = useState<File[]>([])

  /** 이미 서버에 저장되어 있는 첨부 (수정 모드) */
  const [savedBio, setSavedBio] = useState<RentalAttachment[]>(
    initial?.bio ?? [],
  )
  const [savedPortfolio, setSavedPortfolio] = useState<RentalAttachment[]>(
    initial?.portfolio ?? [],
  )

  const [agreed, setAgreed] = useState(editing)
  const [termsOpen, setTermsOpen] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [addressOpening, setAddressOpening] = useState(false)
  const [addressFailed, setAddressFailed] = useState(false)

  const address2Ref = useRef<HTMLInputElement>(null)
  const phone3Ref = useRef<HTMLInputElement>(null)

  /** 썸네일용 object URL — portfolio 상태가 바뀔 때만 새로 만듭니다. */
  const previews = useMemo(
    () => portfolio.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [portfolio],
  )

  useEffect(
    () => () => {
      previews.forEach((item) => URL.revokeObjectURL(item.url))
    },
    [previews],
  )

  const hallLabel =
    RENTAL_HALLS.find((item) => item.id === hallId)?.label ??
    initial?.hall ??
    hallId
  const period = formatDotRange(weekStart, weekEnd)
  const domain = emailDomain === 'custom' ? emailDomainCustom : emailDomain
  const email = emailId && domain ? `${emailId}@${domain}` : ''
  const phone = [phone1, phone2, phone3].filter(Boolean).join('-')

  /** 항목별 검증 — 화면 순서대로 문제 목록을 만듭니다. */
  const problems = () => {
    const list: { message: string; field: string }[] = []

    if (!name.trim()) {
      list.push({ message: '이름을 입력해 주세요.', field: 'rq-name' })
    }

    if (!emailId.trim() || !domain.trim()) {
      list.push({ message: '이메일을 입력해 주세요.', field: 'rq-email-id' })
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      list.push({
        message: '이메일 형식이 올바르지 않습니다.',
        field: 'rq-email-id',
      })
    }

    if (!phone1) {
      list.push({
        message: '연락처 앞자리를 선택해 주세요.',
        field: 'rq-phone1',
      })
    }

    if (!phone2.trim()) {
      list.push({ message: '연락처를 입력해 주세요.', field: 'rq-phone2' })
    }

    if (!phone3.trim()) {
      list.push({ message: '연락처를 입력해 주세요.', field: 'rq-phone3' })
    }

    if (!postcode.trim() || !address1.trim()) {
      list.push({
        message: '주소 검색으로 주소를 입력해 주세요.',
        field: 'rq-address-btn',
      })
    }

    if (!address2.trim()) {
      list.push({ message: '상세 주소를 입력해 주세요.', field: 'rq-address2' })
    }

    // 관리자 수정 모드는 레거시 신청서에 없는 값을 비워 둘 수 있게 통과시킵니다.
    if (!editing && kind === 'group' && !isPositiveInteger(artistCount)) {
      list.push({
        message: '참여 작가 수를 1 이상 입력해 주세요.',
        field: 'rq-artist-count',
      })
    }

    if (!editing && !isPositiveInteger(workCount)) {
      list.push({
        message: '작품 수를 1 이상 입력해 주세요.',
        field: 'rq-work-count',
      })
    }

    if (!genre) {
      list.push({ message: '전시장르를 선택해 주세요.', field: 'rq-genre' })
    }

    if (genre === 'other' && !genreOther.trim()) {
      list.push({
        message: '장르를 직접 입력해 주세요.',
        field: 'rq-genre-other',
      })
    }

    // 관리자 수정 모드는 이미 접수된 건이라 동의를 다시 받지 않습니다.
    if (!editing && !agreed) {
      list.push({
        message: '대관 유의사항에 동의해 주세요.',
        field: 'rq-agree',
      })
    }

    return list
  }

  /** 제출 — 첫 번째 문제를 알려줍니다. */
  const validate = () => problems()[0] ?? null

  /** Enter 를 누른 칸에 해당하는 문제만 골라냅니다. */
  const checkField = (element: HTMLElement) => {
    // 우편번호·기본주소 칸은 주소 검색 버튼 기준으로 검사합니다.
    const id =
      element.id ||
      (element.classList.contains('rental-input--postcode') ||
      element.classList.contains('rental-input--address')
        ? 'rq-address-btn'
        : '')

    if (!id) return null

    return problems().find((problem) => problem.field === id) ?? null
  }

  /** 알럿을 띄운 뒤 해당 입력칸으로 커서를 옮깁니다. */
  const focusField = (id: string) => {
    const field = document.getElementById(id)

    if (!field) return

    field.focus({ preventScroll: true })
    field.scrollIntoView({ block: 'center' })
  }

  /** Enter 로 다음 입력칸으로 이동 (textarea 는 줄바꿈 유지) */
  const handleEnter = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== 'Enter') return

    const target = event.target as HTMLElement

    // textarea 는 줄바꿈, 버튼은 자기 동작을 그대로 둡니다.
    if (target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON') return

    const fields = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'input:not([type="file"]), select, textarea',
      ),
    ).filter((field) => !(field as HTMLInputElement).disabled)

    // 비어 있으면 알럿을 띄우고 그 칸에 머뭅니다.
    const problem = checkField(target)

    if (problem) {
      event.preventDefault()
      setError(problem.message)
      focusField(problem.field)
      return
    }

    const index = fields.indexOf(target)

    // 목록에 없는 요소(예: 숨긴 파일 입력)면 그대로 둡니다.
    if (index < 0) return

    const next = fields[index + 1]

    if (!next) return

    event.preventDefault()
    setError(null)
    next.focus({ preventScroll: true })
    next.scrollIntoView({ block: 'center' })
  }

  const openAddress = async () => {
    setError(null)
    setAddressFailed(false)
    setAddressOpening(true)

    try {
      await loadPostcode()
      const daum = window.daum

      if (!daum) throw new Error('unavailable')

      new daum.Postcode({
        oncomplete: (data) => {
          setPostcode(data.zonecode)
          setAddress1(
            data.userSelectedType === 'R' ? data.roadAddress : data.jibunAddress,
          )
          address2Ref.current?.focus()
        },
      }).open()
    } catch {
      setAddressFailed(true)
    } finally {
      setAddressOpening(false)
    }
  }

  /** 약력 소개 파일을 더합니다. */
  const addBioFiles = (incoming: File[]) => {
    const limit = RENTAL_FILE_LIMITS.bio
    const accepted: File[] = []
    const already = savedBio.length
    let problem: string | null = null

    for (const file of incoming) {
      if (already + bio.length + accepted.length >= limit.max) {
        problem = `약력 소개는 ${limit.max}개까지 첨부할 수 있습니다.`
        break
      }

      const extension = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`

      if (!limit.accept.includes(extension)) {
        problem = `${file.name}: 첨부할 수 없는 형식입니다. (hwp, txt, ppt, doc, xls, pdf)`
        continue
      }

      if (file.size > limit.sizeMB * 1048576) {
        problem = `${file.name}: ${limit.sizeMB}MB 이하만 첨부할 수 있습니다.`
        continue
      }

      accepted.push(file)
    }

    if (accepted.length) setBio([...bio, ...accepted])

    setError(problem)
  }

  const removeBioFile = (index: number) => {
    setBio(bio.filter((_, position) => position !== index))
  }

  /** 포트폴리오에 파일을 더합니다. (클릭 선택 · 드래그앤드롭 공용) */
  const addPortfolioFiles = (incoming: File[]) => {
    const limit = RENTAL_FILE_LIMITS.portfolio
    const accepted: File[] = []
    const already = savedPortfolio.length
    let problem: string | null = null

    for (const file of incoming) {
      if (already + portfolio.length + accepted.length >= limit.max) {
        problem = `포트폴리오는 ${limit.max}개까지 첨부할 수 있습니다.`
        break
      }

      const extension = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`

      if (!limit.accept.includes(extension)) {
        problem = `${file.name}: jpg · png · gif 이미지만 첨부할 수 있습니다.`
        continue
      }

      if (file.size > limit.sizeMB * 1048576) {
        problem = `${file.name}: ${limit.sizeMB}MB 이하만 첨부할 수 있습니다.`
        continue
      }

      accepted.push(file)
    }

    if (accepted.length) setPortfolio([...portfolio, ...accepted])

    setError(problem)
  }

  const removePortfolioFile = (index: number) => {
    setPortfolio(portfolio.filter((_, position) => position !== index))
  }

  /** 저장된 첨부 빼기 — 저장할 때 서버에서도 지워집니다. */
  const removeSavedBio = (no: number) => {
    setSavedBio(savedBio.filter((file) => file.no !== no))
  }

  const removeSavedPortfolio = (no: number) => {
    setSavedPortfolio(savedPortfolio.filter((file) => file.no !== no))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    const invalid = validate()

    if (invalid) {
      setError(invalid.message)
      focusField(invalid.field)
      return
    }

    setSending(true)

    const payload = {
      hall_id: hallId,
      week_start: weekStart,
      applicant: {
        name: name.trim(),
        email,
        phone,
        postcode,
        address1,
        address2,
      },
      exhibition: {
        kind,
        artist_count: kind === 'group' ? Number(artistCount) : undefined,
        work_count: Number(workCount),
        genre,
        genre_other: genre === 'other' ? genreOther : undefined,
        memo,
      },
      terms_version: TERMS_VERSION,
    }

    try {
      if (initial) {
        // 남길 첨부만 알려 주고, 여기 없는 첨부는 서버에서 지워집니다.
        await updateBooking(initial.id, payload, { bio, portfolio }, [
          ...savedBio.map((file) => file.no),
          ...savedPortfolio.map((file) => file.no),
        ])
      } else {
        await createBooking(payload, { bio, portfolio })
      }

      onDone(`${hallLabel} · ${period}`)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError(initial ? '신청을 수정하지 못했습니다.' : '신청을 보내지 못했습니다.')
      }
    } finally {
      setSending(false)
    }
  }

  /** 약력 소개 — 파일 고르기 버튼 + 개수/용량 표시 */
  const bioBlock = () => {
    const limit = RENTAL_FILE_LIMITS.bio
    const count = bio.length + savedBio.length
    const used =
      bio.reduce((sum, file) => sum + file.size, 0) +
      savedBio.reduce((sum, file) => sum + file.size, 0)

    return (
      <div className="rental-file-block">
        <div className="rental-file-block__head">
          <span className="rental-file-block__label">작가 약력소개</span>
          <span className="rental-file-block__hint">
            hwp · txt · ppt · doc · xls · pdf · {limit.max}개까지 · 개당{' '}
            {limit.sizeMB}MB
          </span>
        </div>

        <div className="rental-file-block__box">
          <div className="rental-file-block__row">
            <label
              className="btn btn--sm btn--pill btn--outline"
              htmlFor="rental-file-bio"
            >
              파일 고르기
            </label>
            <input
              id="rental-file-bio"
              type="file"
              multiple
              accept={limit.accept}
              onChange={(event) => {
                addBioFiles(Array.from(event.target.files ?? []))
                event.target.value = ''
              }}
            />
            <span className="rental-file-used">
              {count}개 / {limit.max}개 · {formatSize(used)} / {limit.totalMB} MB
            </span>
          </div>

          {(savedBio.length > 0 || bio.length > 0) && (
            <ul className="rental-file-list">
              {savedBio.map((file) => (
                <li key={`saved-${file.no}`}>
                  {file.url ? (
                    <a
                      className="rental-file-link"
                      href={file.url}
                      download={file.name}
                      target="_blank"
                      rel="noreferrer"
                      title={`${file.name} 내려받기`}
                    >
                      {file.name} ({formatSize(file.size)})
                    </a>
                  ) : (
                    <span>
                      {file.name} ({formatSize(file.size)}) — 파일 없음
                    </span>
                  )}
                  <button
                    type="button"
                    className="rental-file-remove"
                    onClick={() => removeSavedBio(file.no)}
                  >
                    삭제
                  </button>
                </li>
              ))}

              {bio.map((file, index) => (
                <li key={`${file.name}-${index}`}>
                  <span>
                    {file.name} ({formatSize(file.size)})
                  </span>
                  <button
                    type="button"
                    className="rental-file-remove"
                    onClick={() => removeBioFile(index)}
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    )
  }

  return (
    <form
      className={editing ? 'rental-form rental-form--edit' : 'rental-form'}
      onSubmit={handleSubmit}
      onKeyDown={handleEnter}
    >
      {/* 관리자 수정 화면에서는 위 섹션 제목과 안내가 겹치므로 머리말을 표시하지 않습니다. */}
      {!editing && (
        <div className="rental-form__head">
          <h3 className="rental-form__title">대관 신청</h3>
          <p className="rental-form__note">
            <span className="rental-field__req">*</span> 표시는 필수 항목입니다
          </p>
        </div>
      )}

      <div className="rental-form__group">
        <div className="rental-rows">
          <label className="rental-row" htmlFor="rq-name">
            <span className="rental-row__label">
              <i className="rental-dot" aria-hidden="true" />
              이름 <span className="rental-field__req">*</span>
            </span>
            <span className="rental-row__field">
              <input
                id="rq-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </span>
          </label>

          <div className="rental-row">
            <span className="rental-row__label" id="lbl-email">
              <i className="rental-dot" aria-hidden="true" />
              이메일 <span className="rental-field__req">*</span>
            </span>
            <div
              className="rental-row__field rental-inline"
              aria-labelledby="lbl-email"
            >
              <input
                id="rq-email-id"
                type="text"
                className="rental-input--email"
                aria-label="이메일 아이디"
                autoComplete="off"
                value={emailId}
                onChange={(e) => setEmailId(e.target.value)}
              />
              <span className="rental-inline__sep" aria-hidden="true">
                @
              </span>
              <select
                className="rental-select rental-select--domain"
                aria-label="이메일 도메인"
                value={emailDomain}
                onChange={(e) => {
                  setEmailDomain(e.target.value)
                  if (e.target.value !== 'custom') setEmailDomainCustom('')
                }}
              >
                <option value="">선택하세요</option>
                {EMAIL_DOMAINS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
                <option value="custom">직접입력</option>
              </select>
              {emailDomain === 'custom' && (
                <input
                  type="text"
                  className="rental-input--domain"
                  aria-label="이메일 도메인 직접 입력"
                  placeholder="도메인"
                  value={emailDomainCustom}
                  onChange={(e) => setEmailDomainCustom(e.target.value)}
                />
              )}
            </div>
          </div>

          <div className="rental-row">
            <span className="rental-row__label" id="lbl-phone">
              <i className="rental-dot" aria-hidden="true" />
              연락처 <span className="rental-field__req">*</span>
            </span>
            <div
              className="rental-row__field rental-inline"
              aria-labelledby="lbl-phone"
            >
              <select
                id="rq-phone1"
                className="rental-select rental-select--phone"
                aria-label="연락처 앞자리"
                value={phone1}
                onChange={(e) => setPhone1(e.target.value)}
              >
                <option value="">선택하세요</option>
                {PHONE_PREFIXES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <span className="rental-inline__sep" aria-hidden="true">
                -
              </span>
              <input
                id="rq-phone2"
                type="tel"
                className="rental-input--phone"
                aria-label="연락처 가운데자리"
                inputMode="numeric"
                maxLength={4}
                value={phone2}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 4)
                  setPhone2(digits)

                  // 4자리를 다 채우면 끝자리로 넘어갑니다.
                  if (digits.length === 4) phone3Ref.current?.focus()
                }}
              />
              <span className="rental-inline__sep" aria-hidden="true">
                -
              </span>
              <input
                id="rq-phone3"
                ref={phone3Ref}
                type="tel"
                className="rental-input--phone"
                aria-label="연락처 끝자리"
                inputMode="numeric"
                maxLength={4}
                value={phone3}
                onChange={(e) =>
                  setPhone3(e.target.value.replace(/\D/g, '').slice(0, 4))
                }
              />
            </div>
          </div>

          <div className="rental-row">
            <span className="rental-row__label" id="lbl-address">
              <i className="rental-dot" aria-hidden="true" />
              주소 <span className="rental-field__req">*</span>
            </span>
            <div className="rental-row__field rental-address">
              <div className="rental-address__top">
                <input
                  type="text"
                  className="rental-input--postcode"
                  aria-label="우편번호"
                  readOnly
                  placeholder="우편번호"
                  value={postcode}
                />
                <button
                  id="rq-address-btn"
                  type="button"
                  className="rental-address__btn"
                  onClick={openAddress}
                  disabled={addressOpening}
                >
                  {addressOpening ? '여는 중...' : '우편번호'}
                </button>
              </div>

              <input
                type="text"
                className="rental-input--address"
                aria-label="주소"
                readOnly
                placeholder="주소"
                value={address1}
              />

              <input
                id="rq-address2"
                ref={address2Ref}
                type="text"
                className="rental-input--address2"
                aria-label="상세 주소"
                placeholder="상세 주소"
                value={address2}
                onChange={(e) => setAddress2(e.target.value)}
              />

              {addressFailed && (
                <p className="rental-field__hint">
                  주소 검색을 열 수 없습니다. 위 칸에 주소를 직접 적어 주세요.
                </p>
              )}
            </div>
          </div>

          <div className="rental-row">
            <span className="rental-row__label">
              <i className="rental-dot" aria-hidden="true" />
              희망 전시일
            </span>
            <span className="rental-row__field rental-row__value tabular-nums">
              {period}
            </span>
          </div>

          <div className="rental-row">
            <span className="rental-row__label">
              <i className="rental-dot" aria-hidden="true" />
              희망 전시장
            </span>
            <span className="rental-row__field rental-row__value">
              {hallLabel}
            </span>
          </div>

          <div className="rental-row">
            <span className="rental-row__label" id="lbl-kind">
              <i className="rental-dot" aria-hidden="true" />
              전시구분 <span className="rental-field__req">*</span>
            </span>
            <div
              className="rental-row__field rental-choice"
              role="radiogroup"
              aria-labelledby="lbl-kind"
            >
              {RENTAL_KINDS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  role="radio"
                  aria-checked={kind === item.value}
                  className={
                    kind === item.value
                      ? 'rental-choice__btn is-on'
                      : 'rental-choice__btn'
                  }
                  onClick={() => setKind(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {kind === 'group' && (
            <label className="rental-row" htmlFor="rq-artist-count">
              <span className="rental-row__label">
                <i className="rental-dot" aria-hidden="true" />
                참여 작가 수 <span className="rental-field__req">*</span>
              </span>
              <span className="rental-row__field">
                <input
                  id="rq-artist-count"
                  type="number"
                  min={1}
                  value={artistCount}
                  onChange={(e) => setArtistCount(e.target.value)}
                />
              </span>
            </label>
          )}

          <label className="rental-row" htmlFor="rq-work-count">
            <span className="rental-row__label">
              <i className="rental-dot" aria-hidden="true" />
              작품 수 <span className="rental-field__req">*</span>
            </span>
            <span className="rental-row__field">
              <input
                id="rq-work-count"
                type="number"
                min={1}
                value={workCount}
                onChange={(e) => setWorkCount(e.target.value)}
              />
              <span className="rental-field__hint">20호 기준 30점 미만</span>
            </span>
          </label>

          <label className="rental-row" htmlFor="rq-genre">
            <span className="rental-row__label">
              <i className="rental-dot" aria-hidden="true" />
              전시장르 <span className="rental-field__req">*</span>
            </span>
            <span className="rental-row__field">
              <select
                id="rq-genre"
                className="rental-select"
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
            </span>
          </label>

          {genre === 'other' && (
            <label className="rental-row" htmlFor="rq-genre-other">
              <span className="rental-row__label">
                <i className="rental-dot" aria-hidden="true" />
                장르 직접 입력 <span className="rental-field__req">*</span>
              </span>
              <span className="rental-row__field">
                <input
                  id="rq-genre-other"
                  type="text"
                  value={genreOther}
                  onChange={(e) => setGenreOther(e.target.value)}
                />
              </span>
            </label>
          )}
        </div>
      </div>

      <div className="rental-form__group">
        <div className="rental-rows">
          {bioBlock()}

          <div className="rental-row rental-row--stack">
            <span className="rental-row__label">
              <i className="rental-dot" aria-hidden="true" />
              포트폴리오
            </span>
            <div className="rental-row__field">
              <span className="rental-field__hint">
                포트폴리오 이미지(jpg, png, gif) 최대
                {RENTAL_FILE_LIMITS.portfolio.max}개까지 가능하며 이미지 1개당{' '}
                {RENTAL_FILE_LIMITS.portfolio.sizeMB}M 이하만 가능합니다. (총{' '}
                {RENTAL_FILE_LIMITS.portfolio.totalMB}M이하로 가능 합니다.)
              </span>

              <div
                className={
                  dragging ? 'rental-dropzone is-dragging' : 'rental-dropzone'
                }
                onDragOver={(event: DragEvent<HTMLDivElement>) => {
                  event.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event: DragEvent<HTMLDivElement>) => {
                  event.preventDefault()
                  setDragging(false)
                  addPortfolioFiles(Array.from(event.dataTransfer.files))
                }}
              >
                <div className="rental-dropzone__grid">
                  {savedPortfolio.map((file) => (
                    <div
                      className="rental-dropzone__item"
                      key={`saved-${file.no}`}
                    >
                      {file.url ? (
                        <img src={file.url} alt={file.name} />
                      ) : (
                        <span className="rental-dropzone__missing">
                          파일 없음
                        </span>
                      )}
                      <button
                        type="button"
                        className="rental-dropzone__remove"
                        aria-label={`${file.name} 삭제`}
                        onClick={() => removeSavedPortfolio(file.no)}
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  {previews.map((item, index) => (
                    <div
                      className="rental-dropzone__item"
                      key={`${item.file.name}-${index}`}
                    >
                      <img src={item.url} alt={item.file.name} />
                      <button
                        type="button"
                        className="rental-dropzone__remove"
                        aria-label={`${item.file.name} 삭제`}
                        onClick={() => removePortfolioFile(index)}
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  {savedPortfolio.length + portfolio.length <
                    RENTAL_FILE_LIMITS.portfolio.max && (
                    <label className="rental-dropzone__add">
                      <CameraIcon />
                      작품 이미지 추가
                      <input
                        type="file"
                        multiple
                        accept={RENTAL_FILE_LIMITS.portfolio.accept}
                        onChange={(event) => {
                          addPortfolioFiles(
                            Array.from(event.target.files ?? []),
                          )
                          event.target.value = ''
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>

              <span className="rental-file-used">
                {savedPortfolio.length + portfolio.length}개 /{' '}
                {RENTAL_FILE_LIMITS.portfolio.max}개 ·{' '}
                {formatSize(
                  savedPortfolio.reduce((sum, file) => sum + file.size, 0) +
                    portfolio.reduce((sum, file) => sum + file.size, 0),
                )}
              </span>
            </div>
          </div>

          <label className="rental-row" htmlFor="rq-memo">
            <span className="rental-row__label">
              <i className="rental-dot" aria-hidden="true" />
              메모
            </span>
            <span className="rental-row__field">
              <textarea
                id="rq-memo"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
              />
            </span>
          </label>
        </div>
      </div>

      {/* 대관 유의사항 + 동의 — 신청자용 안내 (관리자 수정 화면에서는 감춥니다) */}
      {!hideTerms && (
        <div className="rental-terms">
          <button
            type="button"
            className="rental-terms__toggle"
            aria-expanded={termsOpen}
            onClick={() => setTermsOpen((open) => !open)}
          >
            대관 유의사항 전문 보기
            <span aria-hidden="true">{termsOpen ? '\u25b2' : '\u25bc'}</span>
          </button>

          {termsOpen && (
            <div className="rental-terms__body">
              {RENTAL_TERMS.map((section) => (
                <div className="rental-terms__section" key={section.title}>
                  <h4 className="rental-terms__section_title">{section.title}</h4>
                  <ul className="rental-terms__list">
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {/* 관리자 수정 화면은 이미 접수된 건이라 동의를 다시 받지 않습니다. */}
          {!editing && (
            <label className="rental-agree">
              <input
                id="rq-agree"
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              <span>
                위 대관 유의사항을 확인했으며, 입력한 정보가 대관 심의 목적으로만
                사용되는 데 동의합니다.
              </span>
            </label>
          )}

          <p className="rental-terms__privacy">
            입력하신 정보는 대관 심의 외의 다른 목적으로 사용되지 않습니다. 문의
            02-736-6669 · 02-737-6669
          </p>
        </div>
      )}

      {error && (
        <div className="rental-toast" role="alert" key={error}>
          <svg className="rental-toast__icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="11" fill="#fff" />
            <path
              d="M8.6 8.6 15.4 15.4M15.4 8.6 8.6 15.4"
              stroke="#1f2d3d"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </svg>
          <span className="rental-toast__text">{error}</span>
        </div>
      )}

      <div className="rental-actions">
        <button
          type="button"
          className="btn btn--pill btn--outline btn--lg"
          onClick={onCancel}
          disabled={sending}
        >
          취소
        </button>
        <button
          type="submit"
          className="btn btn--pill btn--dark btn--lg"
          disabled={sending}
        >
          {sending ? '저장 중...' : editing ? '수정' : '확인'}
        </button>
      </div>
    </form>
  )
}
