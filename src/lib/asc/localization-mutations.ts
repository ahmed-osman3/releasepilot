import { cacheInvalidate } from '@/lib/cache'
import { ascFetch, getAscCacheScope } from './client'

const URL_FIELDS = new Set([
  'supportUrl',
  'marketingUrl',
  'privacyPolicyUrl',
  'privacyChoicesUrl',
])

export type VersionLocalizationUpdate = {
  description?: string
  keywords?: string
  promotionalText?: string
  whatsNew?: string
}

function cleanAttributes(
  attributes: Record<string, unknown>,
): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(attributes)) {
    cleaned[key] = URL_FIELDS.has(key) && value === '' ? null : value
  }
  return cleaned
}

export async function updateVersionLocalization(
  localizationId: string,
  attributes: Record<string, unknown>,
): Promise<void> {
  await ascFetch(`/v1/appStoreVersionLocalizations/${localizationId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      data: {
        type: 'appStoreVersionLocalizations',
        id: localizationId,
        attributes: cleanAttributes(attributes),
      },
    }),
  })
}

export async function createVersionLocalization(
  versionId: string,
  locale: string,
  attributes: Record<string, unknown>,
): Promise<string> {
  const cleaned: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(attributes)) {
    if (value !== '') cleaned[key] = value
  }

  const response = await ascFetch<{ data: { id: string } }>(
    '/v1/appStoreVersionLocalizations',
    {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'appStoreVersionLocalizations',
          attributes: { locale, ...cleaned },
          relationships: {
            appStoreVersion: {
              data: { type: 'appStoreVersions', id: versionId },
            },
          },
        },
      }),
    },
  )

  return response.data.id
}

export async function deleteVersionLocalization(
  localizationId: string,
): Promise<void> {
  await ascFetch(`/v1/appStoreVersionLocalizations/${localizationId}`, {
    method: 'DELETE',
  })
}

export function invalidateLocalizationsCache(versionId: string): void {
  cacheInvalidate(`localizations:${getAscCacheScope()}:${versionId}`)
}
