const ASC_BASE = 'https://api.appstoreconnect.apple.com/v1'

export type GetToken = () => Promise<string>

interface JsonApiResource {
  type: string
  id: string
  attributes?: Record<string, unknown>
}

async function ascFetch<T>(
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
  const json = (await res.json()) as {
    data?: T
    errors?: { detail?: string }[]
  }
  if (json.errors?.length) {
    return {
      error: json.errors[0]?.detail ?? 'App Store Connect request failed.',
    }
  }
  return { data: json.data as T }
}

export interface VersionLocalization {
  id: string
  locale: string
  description?: string
  keywords?: string
  promotionalText?: string
  whatsNew?: string
}

export interface VersionLocalizationUpdate {
  description?: string
  keywords?: string
  promotionalText?: string
  whatsNew?: string
}

/** List app store version localizations for a version */
export async function getVersionLocalizations(
  versionId: string,
  getToken: GetToken,
): Promise<{ localizations: VersionLocalization[]; error?: string }> {
  const { data, error } = await ascFetch<JsonApiResource[]>(
    `/appStoreVersions/${versionId}/appStoreVersionLocalizations?limit=200`,
    getToken,
  )
  if (error) return { localizations: [], error }
  const list = Array.isArray(data) ? data : []
  const localizations: VersionLocalization[] = list.map((r) => ({
    id: r.id,
    locale: (r.attributes?.locale as string) ?? '',
    description: r.attributes?.description as string | undefined,
    keywords: r.attributes?.keywords as string | undefined,
    promotionalText: r.attributes?.promotionalText as string | undefined,
    whatsNew: r.attributes?.whatsNew as string | undefined,
  }))
  return { localizations }
}

/** Update a single app store version localization (description, keywords, promotionalText, whatsNew) */
export async function updateVersionLocalization(
  localeId: string,
  updates: VersionLocalizationUpdate,
  getToken: GetToken,
): Promise<{ success: boolean; error?: string }> {
  const attributes: Record<string, string> = {}
  if (updates.description !== undefined)
    attributes.description = updates.description
  if (updates.keywords !== undefined) attributes.keywords = updates.keywords
  if (updates.promotionalText !== undefined)
    attributes.promotionalText = updates.promotionalText
  if (updates.whatsNew !== undefined) attributes.whatsNew = updates.whatsNew

  const { data, error } = await ascFetch<JsonApiResource>(
    `/appStoreVersionLocalizations/${localeId}`,
    getToken,
    {
      method: 'PATCH',
      body: JSON.stringify({
        data: {
          type: 'appStoreVersionLocalizations',
          id: localeId,
          attributes,
        },
      }),
    },
  )
  if (error) return { success: false, error }
  return { success: !!data }
}
