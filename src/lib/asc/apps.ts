import { cacheInvalidate, withCache } from '@/lib/cache'
import { ascFetch, getAscCacheScope } from './client'

const APPS_TTL = 60 * 60 * 1000
const APP_ICON_TTL = 6 * 60 * 60 * 1000

export interface AscApp {
  id: string
  attributes: {
    name: string
    bundleId: string
    sku: string
    primaryLocale: string
    contentRightsDeclaration: string | null
    subscriptionStatusUrl: string | null
    subscriptionStatusUrlForSandbox: string | null
    iconUrl: string | null
  }
}

interface AscAppsResponse {
  data: Array<{
    id: string
    attributes: Omit<AscApp['attributes'], 'iconUrl'>
  }>
}

interface AscBuildsResponse {
  data: Array<{
    id: string
    attributes: {
      iconAssetToken?: {
        templateUrl: string
      } | null
    }
  }>
}

export function buildIconUrl(templateUrl: string, size = 128): string {
  return templateUrl
    .replace('{w}', String(size))
    .replace('{h}', String(size))
    .replace('{f}', 'png')
}

async function fetchBuildIconUrls(appIds: string[]): Promise<Map<string, string>> {
  const icons = new Map<string, string>()
  if (appIds.length === 0) return icons

  const results = await Promise.allSettled(
    appIds.map(async (appId) => {
      const response = await ascFetch<AscBuildsResponse>(
        `/v1/builds?filter[app]=${appId}&sort=-uploadedDate&limit=1&fields[builds]=iconAssetToken`,
      )
      const build = response.data[0]
      const templateUrl = build?.attributes?.iconAssetToken?.templateUrl
      if (templateUrl) {
        icons.set(appId, buildIconUrl(templateUrl))
      }
    }),
  )

  for (const result of results) {
    if (result.status === 'rejected') {
      console.warn('Failed to fetch build icon:', result.reason)
    }
  }

  return icons
}

export async function listApps(forceRefresh = false): Promise<AscApp[]> {
  const scope = getAscCacheScope()
  return withCache(`apps:${scope}`, APPS_TTL, forceRefresh, async () => {
    const response = await ascFetch<AscAppsResponse>(
      '/v1/apps?fields[apps]=name,bundleId,sku,primaryLocale,contentRightsDeclaration,subscriptionStatusUrl,subscriptionStatusUrlForSandbox&sort=name&limit=200',
    )

    const iconUrls = await fetchBuildIconUrls(response.data.map((app) => app.id))

    return response.data.map((app) => ({
      id: app.id,
      attributes: {
        ...app.attributes,
        iconUrl: iconUrls.get(app.id) ?? null,
      },
    }))
  })
}

export async function getAppIconUrl(
  appStoreAppId: string,
  forceRefresh = false,
): Promise<string | null> {
  return withCache(`app-icon:${appStoreAppId}`, APP_ICON_TTL, forceRefresh, async () => {
    try {
      const response = await fetch(
        `https://itunes.apple.com/lookup?id=${encodeURIComponent(appStoreAppId)}`,
      )
      if (!response.ok) return null
      const json = (await response.json()) as {
        results?: Array<{ artworkUrl512?: string; artworkUrl100?: string }>
      }
      const result = json.results?.[0]
      return result?.artworkUrl512 ?? result?.artworkUrl100 ?? null
    } catch {
      return null
    }
  })
}

export function invalidateAppsCache(): void {
  cacheInvalidate(`apps:${getAscCacheScope()}`)
}
