import { ascFetch, getAscCacheScope } from './client'
import { withCache } from './helpers'

const LOCALIZATIONS_TTL = 15 * 60 * 1000

export interface VersionLocalization {
  id: string
  locale: string
  description?: string
  keywords?: string
  promotionalText?: string
  whatsNew?: string
}

export interface AscLocalization {
  id: string
  attributes: {
    locale: string
    description: string | null
    keywords: string | null
    marketingUrl: string | null
    promotionalText: string | null
    supportUrl: string | null
    whatsNew: string | null
  }
}

interface AscLocalizationsResponse {
  data: Array<{
    id: string
    type: string
    attributes: AscLocalization['attributes']
  }>
}

export async function listLocalizations(
  versionId: string,
  forceRefresh = false,
): Promise<AscLocalization[]> {
  const scope = getAscCacheScope()
  return withCache(
    `localizations:${scope}:${versionId}`,
    LOCALIZATIONS_TTL,
    forceRefresh,
    async () => {
      const response = await ascFetch<AscLocalizationsResponse>(
        `/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations?fields[appStoreVersionLocalizations]=locale,description,keywords,marketingUrl,promotionalText,supportUrl,whatsNew`,
      )

      return response.data.map((localization) => ({
        id: localization.id,
        attributes: localization.attributes,
      }))
    },
  )
}
