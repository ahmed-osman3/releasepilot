import type { Build } from 'packages/asc/src/gen'
import { ascFetch, type GetToken, type JsonApiResource } from './fetch'

export async function getBuildByVersionId(
  versionId: string,
  getToken: GetToken,
): Promise<{ build: Build | null; error?: string }> {
  const { data, error } = await ascFetch<JsonApiResource>(
    `/appStoreVersions/${versionId}/build`,
    getToken,
  )
  console.log('data', data)
  if (error) return { build: null, error }
  return { build: data as Build }
}
