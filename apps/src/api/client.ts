import { clearAuth, getAccessToken } from '@/store/useAuthStore'

/**
 * 백엔드 API 기본 경로.
 * 운영(Cafe24): React 빌드가 /www/ 에, PHP 가 /www/backend/ 에 올라가므로 '/backend'
 * 로컬 개발에서 다른 주소를 쓰려면 .env 에 VITE_API_BASE 를 지정합니다.
 */
const BASE_URL: string =
  (import.meta.env.VITE_API_BASE as string | undefined) ?? '/backend'

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

type QueryValue = string | number | boolean | null | undefined

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  /** multipart/form-data 로 보낼 때 사용 (body 보다 우선) */
  form?: FormData
  query?: Record<string, QueryValue>
  /** 인증 토큰을 함께 보낼지 여부 (기본 true) */
  auth?: boolean
}

/** 백엔드 공통 응답 형식 */
type ApiEnvelope<T> = {
  success: boolean
  data?: T
  message?: string
}

function buildUrl(path: string, query?: Record<string, QueryValue>) {
  const base = `${BASE_URL}${path}`
  if (!query) return base

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    params.append(key, String(value))
  }

  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, form, query, auth = true } = options

  const headers: Record<string, string> = { Accept: 'application/json' }

  // FormData 일 때는 Content-Type 을 지정하지 않아야 브라우저가 boundary 를 붙입니다.
  if (!form && body !== undefined) headers['Content-Type'] = 'application/json'

  if (auth) {
    const token = getAccessToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  let res: Response
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
    })
  } catch {
    throw new ApiError(
      '서버에 연결할 수 없습니다. 네트워크 상태를 확인해 주세요.',
      0,
    )
  }

  if (res.status === 401) {
    clearAuth()
    throw new ApiError('로그인이 만료되었습니다. 다시 로그인해 주세요.', 401)
  }

  const text = await res.text()

  let payload: ApiEnvelope<T> | null = null
  if (text) {
    try {
      payload = JSON.parse(text) as ApiEnvelope<T>
    } catch {
      throw new ApiError('서버 응답을 해석할 수 없습니다.', res.status)
    }
  }

  if (!res.ok || !payload || payload.success !== true) {
    throw new ApiError(
      payload?.message ?? `요청에 실패했습니다. (${res.status})`,
      res.status,
    )
  }

  return payload.data as T
}
