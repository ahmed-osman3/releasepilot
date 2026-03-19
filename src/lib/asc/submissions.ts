import type { AppStoreVersion } from 'packages/asc/src/gen/models/AppStoreVersion'
import { cacheInvalidate } from '@/lib/cache'
import { AscApiError, ascFetch, getAscCacheScope } from './client'
import { withCache } from './helpers'

const APP_STORE_VERSIONS_TTL_MS = 15 * 60 * 1000
const REVIEW_SUBMISSIONS_TTL_MS = 30 * 1000
const REVIEW_SUBMISSION_TTL_MS = 15 * 1000
const REJECTION_REASON_TTL_MS = 5 * 60 * 1000

export interface JsonApiResource {
  type: string
  id: string
  attributes?: Record<string, unknown>
  relationships?: Record<
    string,
    { data?: { type: string; id: string } | Array<{ type: string; id: string }> }
  >
}

export type NormalizedAscError = {
  id?: string
  status?: string
  code?: string
  title?: string
  detail?: string
  source?: Record<string, unknown>
  meta?: Record<string, unknown>
  associatedErrors?: Array<{ code?: string; detail?: string }>
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

type SubmissionResult = {
  submission: NormalizedReviewSubmission | null
  error?: string
  errors?: NormalizedAscError[]
}

function normalizeError(error: AscApiError): {
  error: string
  errors?: NormalizedAscError[]
} {
  return {
    error: error.ascError.message,
    errors: error.ascError.entries?.map((entry, index) => ({
      id: `${index + 1}`,
      code: entry.code,
      title: entry.title,
      detail: entry.detail,
      source: entry.source as Record<string, unknown> | undefined,
    })),
  }
}

async function tryAsc<T>(
  fetcher: () => Promise<T>,
): Promise<{ data?: T; error?: string; errors?: NormalizedAscError[] }> {
  try {
    return { data: await fetcher() }
  } catch (error) {
    if (error instanceof AscApiError) {
      return normalizeError(error)
    }

    return {
      error: error instanceof Error ? error.message : 'App Store Connect request failed.',
    }
  }
}

export async function listAppStoreVersions(
  appId: string,
  forceRefresh = false,
): Promise<{ versions: AppStoreVersion[]; error?: string }> {
  const scope = getAscCacheScope()
  return withCache(
    `versions:${scope}:${appId}`,
    APP_STORE_VERSIONS_TTL_MS,
    forceRefresh,
    async () => {
      const result = await tryAsc(() =>
        ascFetch<{ data: JsonApiResource[] }>(`/v1/apps/${appId}/appStoreVersions`),
      )
      if (result.error) return { versions: [], error: result.error }
      return { versions: ((result.data?.data ?? []) as AppStoreVersion[]) }
    },
  )
}

export async function listReviewSubmissions(
  appId: string,
  forceRefresh = false,
): Promise<{ submissions: NormalizedReviewSubmission[]; error?: string }> {
  const scope = getAscCacheScope()
  return withCache(
    `review-submissions:${scope}:${appId}`,
    REVIEW_SUBMISSIONS_TTL_MS,
    forceRefresh,
    async () => {
      const result = await tryAsc(() =>
        ascFetch<{
          data: JsonApiResource[]
          included?: JsonApiResource[]
        }>(
          `/v1/reviewSubmissions?filter[app]=${appId}&include=appStoreVersionForReview,items`,
        ),
      )
      if (result.error || !result.data) {
        return { submissions: [], error: result.error }
      }

      const includedMap = buildIncludedMap(result.data.included)
      return {
        submissions: (result.data.data ?? []).map((submission) =>
          normalizeReviewSubmission(submission, includedMap),
        ),
      }
    },
  )
}

export async function getReviewSubmission(
  id: string,
  forceRefresh = false,
): Promise<{ submission: NormalizedReviewSubmission | null; error?: string }> {
  const scope = getAscCacheScope()
  return withCache(
    `review-submission:${scope}:${id}`,
    REVIEW_SUBMISSION_TTL_MS,
    forceRefresh,
    async () => {
      const result = await tryAsc(() =>
        ascFetch<{
          data: JsonApiResource
          included?: JsonApiResource[]
        }>(
          `/v1/reviewSubmissions/${id}?include=appStoreVersionForReview,items`,
        ),
      )
      if (result.error || !result.data) {
        return { submission: null, error: result.error }
      }

      const includedMap = buildIncludedMap(result.data.included)
      return {
        submission: normalizeReviewSubmission(result.data.data, includedMap),
      }
    },
  )
}

export async function createAndSubmitReviewSubmission(
  appId: string,
  versionId: string,
  platform: string,
): Promise<SubmissionResult> {
  const createResult = await tryAsc(() =>
    ascFetch<{ data: JsonApiResource }>('/v1/reviewSubmissions', {
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
    }),
  )

  if (createResult.error || !createResult.data) {
    return {
      submission: null,
      error: createResult.error,
      errors: createResult.errors,
    }
  }

  const reviewSubmissionId = createResult.data.data.id
  cacheInvalidate(`review-submissions:${getAscCacheScope()}:${appId}`)

  const itemResult = await attachVersionToReviewSubmission(
    reviewSubmissionId,
    versionId,
  )
  if (itemResult.error) {
    return { submission: null, error: itemResult.error, errors: itemResult.errors }
  }

  return submitExistingReviewSubmission(reviewSubmissionId, versionId, appId)
}

export async function submitExistingReviewSubmission(
  id: string,
  versionId?: string,
  appId?: string,
): Promise<SubmissionResult> {
  if (versionId) {
    const existing = await getReviewSubmission(id, true)
    if (existing.error || !existing.submission) {
      return {
        submission: null,
        error: existing.error ?? 'Review submission not found.',
      }
    }

    if (!existing.submission.appStoreVersion) {
      const itemResult = await attachVersionToReviewSubmission(id, versionId)
      if (itemResult.error) {
        return { submission: null, error: itemResult.error, errors: itemResult.errors }
      }
    }
  }

  const patchResult = await tryAsc(() =>
    ascFetch(`/v1/reviewSubmissions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        data: {
          type: 'reviewSubmissions',
          id,
          attributes: { submitted: true },
        },
      }),
    }),
  )

  if (patchResult.error) {
    return { submission: null, error: patchResult.error, errors: patchResult.errors }
  }

  const scope = getAscCacheScope()
  cacheInvalidate(`review-submission:${scope}:${id}`)
  if (appId) {
    cacheInvalidate(`review-submissions:${scope}:${appId}`)
    cacheInvalidate(`versions:${scope}:${appId}`)
  }

  return getReviewSubmission(id, true)
}

async function attachVersionToReviewSubmission(
  reviewSubmissionId: string,
  versionId: string,
): Promise<{ error?: string; errors?: NormalizedAscError[] }> {
  const result = await tryAsc(() =>
    ascFetch('/v1/reviewSubmissionItems', {
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
    }),
  )

  return { error: result.error, errors: result.errors }
}

export async function getVersionRejectionReason(
  versionId: string,
  forceRefresh = false,
): Promise<string | null> {
  const scope = getAscCacheScope()
  return withCache(
    `rejection-reason:${scope}:${versionId}`,
    REJECTION_REASON_TTL_MS,
    forceRefresh,
    async () => {
      const result = await tryAsc(() =>
        ascFetch<JsonApiResource | JsonApiResource[]>(
          `/v1/appStoreVersions/${versionId}/appStoreReviewDetail`,
        ),
      )
      if (!result.data) return null

      const reviewDetail = Array.isArray(result.data)
        ? result.data[0]
        : result.data
      if (!reviewDetail?.attributes) return null

      const attributes = reviewDetail.attributes as {
        rejectionNotes?: string
        details?: Array<{ resolution?: string }>
      }
      return attributes.rejectionNotes ?? attributes.details?.[0]?.resolution ?? null
    },
  )
}

function buildIncludedMap(
  included?: JsonApiResource[],
): Map<string, JsonApiResource> {
  const map = new Map<string, JsonApiResource>()
  for (const resource of included ?? []) {
    map.set(`${resource.type}:${resource.id}`, resource)
  }
  return map
}

function normalizeReviewSubmission(
  submission: JsonApiResource,
  includedMap: Map<string, JsonApiResource>,
): NormalizedReviewSubmission {
  const attributes = submission.attributes ?? {}
  const versionRef =
    getVersionRefFromSubmission(submission, includedMap) ??
    submission.relationships?.appStoreVersionForReview?.data
  const resolvedVersionRef =
    versionRef && !Array.isArray(versionRef) ? versionRef : null
  const versionData = resolvedVersionRef
    ? includedMap.get(`${resolvedVersionRef.type}:${resolvedVersionRef.id}`)
    : undefined

  return {
    id: submission.id,
    state: (attributes.state as string) ?? 'READY_FOR_REVIEW',
    submittedDate: (attributes.submittedDate as string) ?? null,
    platform: (attributes.platform as string) ?? null,
    appStoreVersion: resolvedVersionRef
      ? {
          id: versionData?.id ?? resolvedVersionRef.id,
          versionString: (versionData?.attributes?.versionString as string) ?? '',
          appVersionState: (versionData?.attributes?.appVersionState as string) ?? '',
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
