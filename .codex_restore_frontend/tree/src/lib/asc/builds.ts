import type { Build } from 'packages/asc/src/gen/models/Build'
import { ascFetch, getAscCacheScope } from './client'
import { withCache } from './helpers'

const BUILDS_TTL = 5 * 60 * 1000

interface JsonApiResource {
  type: string
  id: string
  attributes?: Record<string, unknown>
}

export async function getBuildByVersionId(
  versionId: string,
  forceRefresh = false,
): Promise<{ build: Build | null }> {
  const scope = getAscCacheScope()
  return withCache(`build:${scope}:${versionId}`, BUILDS_TTL, forceRefresh, async () => {
    const data = await ascFetch<JsonApiResource>(
      `/v1/appStoreVersions/${versionId}/build`,
    )
    return { build: data as Build }
  })
}
