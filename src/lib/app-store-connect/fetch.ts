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

export type NormalizedAscAssociatedError = {
  code?: string
  detail?: string
}

export type NormalizedAscError = {
  id?: string
  status?: string
  code?: string
  title?: string
  detail?: string
  source?: Record<string, unknown>
  meta?: Record<string, unknown>
  associatedErrors?: NormalizedAscAssociatedError[]
}

export type NormalizedReviewSubmission = {
  id: string
  state: string
  submittedDate: string | null
  platform: string | null
  appStoreVersion: {
    id: string
    versionString: string
    appVersionState: string
  } | null
  rejectionReason: string | null
}

type RawAscError = {
  id?: string
  status?: string
  code?: string
  title?: string
  detail?: string
  source?: Record<string, unknown>
  meta?: Record<string, unknown>
}

function normalizeAscErrors(
  raw: RawAscError[],
): { error: string; errors: NormalizedAscError[] } {
  const errors: NormalizedAscError[] = raw.map((e) => {
    let associatedErrors: NormalizedAscAssociatedError[] | undefined

    const assocMap = e.meta?.associatedErrors as
      | Record<string, Array<{ code?: string; detail?: string }>>
      | undefined

    if (assocMap && typeof assocMap === 'object') {
      associatedErrors = Object.values(assocMap).flat().map((ae) => ({
        code: ae.code,
        detail: ae.detail,
      }))
    }

    return {
      id: e.id,
      status: e.status,
      code: e.code,
      title: e.title,
      detail: e.detail,
      source: e.source,
      meta: e.meta,
      ...(associatedErrors?.length ? { associatedErrors } : {}),
    }
  })

  const first = raw[0]
  const error =
    first?.detail ?? first?.title ?? 'App Store Connect request failed.'

  return { error, errors }
}

export async function ascFetch<T>(
  path: string,
  getToken: GetToken,
  options: RequestInit = {},
): Promise<{
  data?: T
  included?: JsonApiResource[]
  error?: string
  errors?: NormalizedAscError[]
}> {
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
    errors?: RawAscError[]
  }
  if (json.errors?.length) {
    console.error(json.errors)
    const normalized = normalizeAscErrors(json.errors)
    return { error: normalized.error, errors: normalized.errors }
  }
  return { data: json.data as T, included: json.included }
}
