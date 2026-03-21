const ASC_BASE = 'https://api.appstoreconnect.apple.com/v1'

export type GetToken = () => Promise<string>

/** JSON:API document with optional included resources */
interface JsonApiDocument<T> {
  data: T
  included?: JsonApiResource[]
}

export interface JsonApiResource {
  type: string
  id: string
  attributes?: Record<string, unknown>
  relationships?: Record<
    string,
    { data?: { type: string; id: string } | { type: string; id: string }[] }
  >
}

export interface SubmissionState {
  versionId: string
  versionString: string
  state: string // READY_FOR_SUBMISSION | WAITING_FOR_REVIEW | IN_REVIEW | PENDING_DEVELOPER_RELEASE | etc.
  rejectionReason?: string
}

export async function ascFetch<T>(
  path: string,
  getToken: GetToken,
  options: RequestInit = {},
): Promise<{ data?: T; error?: string }> {
  const token = await getToken()
  const url = path.startsWith('http') ? path : `${ASC_BASE}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (res.status === 429) {
    return { error: 'Too many requests; try again later.' }
  }
  if (res.status === 401 || res.status === 403) {
    return { error: 'Check your API key and try again.' }
  }
  if (res.status >= 500) {
    return { error: 'App Store Connect is temporarily unavailable.' }
  }
  const json = (await res.json()) as JsonApiDocument<T> & {
    errors?: { detail?: string }[]
  }
  if (json.errors?.length) {
    return {
      error: json.errors[0]?.detail ?? 'App Store Connect request failed.',
    }
  }
  return { data: json.data as T }
}
