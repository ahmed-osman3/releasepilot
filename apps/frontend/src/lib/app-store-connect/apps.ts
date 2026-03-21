const ASC_BASE = 'https://api.appstoreconnect.apple.com/v1'

export type GetToken = () => Promise<string>

interface JsonApiResource {
  type: string
  id: string
  attributes?: Record<string, unknown>
}

export interface AscApp {
  id: string
  name: string
  bundleId: string
}

async function ascFetch<T>(
  path: string,
  getToken: GetToken,
  options: RequestInit = {}
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
  const json = (await res.json()) as { data?: T; errors?: { detail?: string }[] }
  if (json.errors?.length) {
    return { error: json.errors[0]?.detail ?? 'App Store Connect request failed.' }
  }
  return { data: json.data as T }
}

/** Fetch app icon URL from public iTunes lookup (no auth needed) */
export async function getAppIconUrl(
  appStoreAppId: string,
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://itunes.apple.com/lookup?id=${encodeURIComponent(appStoreAppId)}`,
    )
    if (!res.ok) return null
    const json = (await res.json()) as {
      results?: { artworkUrl512?: string; artworkUrl100?: string }[]
    }
    const result = json.results?.[0]
    return result?.artworkUrl512 ?? result?.artworkUrl100 ?? null
  } catch {
    return null
  }
}

/** List apps available for the API key (verifies key and returns app list) */
export async function listApps(
  getToken: GetToken
): Promise<{ apps: AscApp[]; error?: string }> {
  const { data, error } = await ascFetch<JsonApiResource[]>(
    '/apps?limit=200',
    getToken
  )
  if (error) return { apps: [], error }
  const list = Array.isArray(data) ? data : []
  const apps: AscApp[] = list.map((r) => ({
    id: r.id,
    name: (r.attributes?.name as string) ?? '',
    bundleId: (r.attributes?.bundleId as string) ?? '',
  }))
  return { apps }
}
