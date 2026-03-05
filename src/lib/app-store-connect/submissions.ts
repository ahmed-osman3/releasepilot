import type { AppStoreVersion } from 'packages/asc/src/gen'
import {
  ascFetch,
  type GetToken,
  type JsonApiResource,
  type NormalizedAscError,
  type NormalizedReviewSubmission,
} from './fetch'

type SubmissionResult = {
  submission: NormalizedReviewSubmission | null
  error?: string
  errors?: NormalizedAscError[]
}

/** List app store versions for an app */
export async function listAppStoreVersions(
  appId: string,
  getToken: GetToken,
): Promise<{ versions: AppStoreVersion[]; error?: string }> {
  const { data, error } = await ascFetch<JsonApiResource[]>(
    `/apps/${appId}/appStoreVersions`,
    getToken,
  )
  if (error) return { versions: [], error }
  return { versions: data as AppStoreVersion[] }
}

/** List review submissions for an app with related version context */
export async function listReviewSubmissions(
  appId: string,
  getToken: GetToken,
): Promise<{ submissions: NormalizedReviewSubmission[]; error?: string }> {
  const { data, included, error } = await ascFetch<JsonApiResource[]>(
    `/reviewSubmissions?filter[app]=${appId}&include=appStoreVersionForReview,items`,
    getToken,
  )
  if (error) return { submissions: [], error }

  const resources = Array.isArray(data) ? data : []
  const includedMap = buildIncludedMap(included)

  const submissions: NormalizedReviewSubmission[] = resources.map((rs) =>
    normalizeReviewSubmission(rs, includedMap),
  )

  return { submissions }
}

/** Fetch a single review submission with related version context */
export async function getReviewSubmission(
  id: string,
  getToken: GetToken,
): Promise<{ submission: NormalizedReviewSubmission | null; error?: string }> {
  const { data, included, error } = await ascFetch<JsonApiResource>(
    `/reviewSubmissions/${id}?include=appStoreVersionForReview,items`,
    getToken,
  )
  if (error || !data) return { submission: null, error }

  const includedMap = buildIncludedMap(included)
  return { submission: normalizeReviewSubmission(data, includedMap) }
}

/** Create a review submission, add a version item, and submit it */
export async function createAndSubmitReviewSubmission(
  appId: string,
  versionId: string,
  platform: string,
  getToken: GetToken,
): Promise<SubmissionResult> {
  const createRes = await ascFetch<JsonApiResource>(
    '/reviewSubmissions',
    getToken,
    {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'reviewSubmissions',
          attributes: { platform },
          relationships: {
            app: { data: { type: 'apps', id: appId } },
          },
        },
      }),
    },
  )
  if (createRes.error || !createRes.data) {
    return {
      submission: null,
      error: createRes.error,
      errors: createRes.errors,
    }
  }

  const reviewSubmissionId = createRes.data.id

  const itemRes = await attachVersionToReviewSubmission(
    reviewSubmissionId,
    versionId,
    getToken,
  )
  if (itemRes.error) {
    return { submission: null, error: itemRes.error, errors: itemRes.errors }
  }

  return submitExistingReviewSubmission(reviewSubmissionId, getToken)
}

/** Submit an existing review submission (PATCH submitted: true) */
export async function submitExistingReviewSubmission(
  id: string,
  getToken: GetToken,
  versionId?: string,
): Promise<SubmissionResult> {
  if (versionId) {
    const existing = await getReviewSubmission(id, getToken)
    if (existing.error || !existing.submission) {
      return {
        submission: null,
        error: existing.error ?? 'Review submission not found.',
      }
    }

    if (!existing.submission.appStoreVersion) {
      const itemRes = await attachVersionToReviewSubmission(id, versionId, getToken)
      if (itemRes.error) {
        return { submission: null, error: itemRes.error, errors: itemRes.errors }
      }
    }
  }

  const { error, errors } = await ascFetch<JsonApiResource>(
    `/reviewSubmissions/${id}`,
    getToken,
    {
      method: 'PATCH',
      body: JSON.stringify({
        data: {
          type: 'reviewSubmissions',
          id,
          attributes: { submitted: true },
        },
      }),
    },
  )
  if (error) return { submission: null, error, errors }

  return getReviewSubmission(id, getToken)
}

async function attachVersionToReviewSubmission(
  reviewSubmissionId: string,
  versionId: string,
  getToken: GetToken,
): Promise<{ error?: string; errors?: NormalizedAscError[] }> {
  const itemRes = await ascFetch<JsonApiResource>('/reviewSubmissionItems', getToken, {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'reviewSubmissionItems',
        relationships: {
          reviewSubmission: {
            data: { type: 'reviewSubmissions', id: reviewSubmissionId },
          },
          appStoreVersion: {
            data: { type: 'appStoreVersions', id: versionId },
          },
        },
      },
    }),
  })
  return { error: itemRes.error, errors: itemRes.errors }
}

/** Look up rejection reason from a version's review detail */
export async function getVersionRejectionReason(
  versionId: string,
  getToken: GetToken,
): Promise<string | null> {
  const res = await ascFetch<JsonApiResource | JsonApiResource[]>(
    `/appStoreVersions/${versionId}/appStoreReviewDetail`,
    getToken,
  )
  const reviewDetail = Array.isArray(res.data)
    ? res.data[0]
    : (res.data as JsonApiResource | undefined)
  if (!reviewDetail?.attributes) return null

  const attrs = reviewDetail.attributes as {
    rejectionNotes?: string
    details?: { resolution?: string }[]
  }
  return attrs.rejectionNotes ?? attrs.details?.[0]?.resolution ?? null
}

function buildIncludedMap(
  included?: JsonApiResource[],
): Map<string, JsonApiResource> {
  const map = new Map<string, JsonApiResource>()
  if (included) {
    for (const resource of included) {
      map.set(`${resource.type}:${resource.id}`, resource)
    }
  }
  return map
}

function normalizeReviewSubmission(
  rs: JsonApiResource,
  includedMap: Map<string, JsonApiResource>,
): NormalizedReviewSubmission {
  const attrs = rs.attributes ?? {}
  const versionRef =
    getVersionRefFromSubmission(rs, includedMap) ??
    rs.relationships?.appStoreVersionForReview?.data
  const versionData =
    versionRef && !Array.isArray(versionRef)
      ? includedMap.get(`${versionRef.type}:${versionRef.id}`)
      : undefined

  return {
    id: rs.id,
    state: (attrs.state as string) ?? 'READY_FOR_REVIEW',
    submittedDate: (attrs.submittedDate as string) ?? null,
    platform: (attrs.platform as string) ?? null,
    appStoreVersion:
      versionRef && !Array.isArray(versionRef)
        ? {
            id: versionData?.id ?? versionRef.id,
            versionString:
              (versionData?.attributes?.versionString as string) ?? '',
            appVersionState:
              (versionData?.attributes?.appVersionState as string) ?? '',
          }
        : null,
    rejectionReason: null,
  }
}

function getVersionRefFromSubmission(
  submission: JsonApiResource,
  includedMap: Map<string, JsonApiResource>,
) {
  const directRef = submission.relationships?.appStoreVersionForReview?.data
  if (directRef && !Array.isArray(directRef)) {
    return directRef
  }

  const itemRefs = submission.relationships?.items?.data
  if (!Array.isArray(itemRefs)) return null

  for (const itemRef of itemRefs) {
    const item = includedMap.get(`${itemRef.type}:${itemRef.id}`)
    const versionRef = item?.relationships?.appStoreVersion?.data
    if (versionRef && !Array.isArray(versionRef)) {
      return versionRef
    }
  }

  return null
}
