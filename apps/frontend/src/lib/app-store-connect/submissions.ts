import type { AppStoreVersion } from 'packages/asc/src/gen'
import {
  ascFetch,
  type GetToken,
  type JsonApiResource,
  type SubmissionState,
} from './fetch'

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

/** Get submission state and optional rejection reason for a version */
export async function getSubmissionState(
  versionId: string,
  getToken: GetToken,
): Promise<{ state: SubmissionState | null; error?: string }> {
  const [versionRes, submissionsRes] = await Promise.all([
    ascFetch<JsonApiResource>(`/appStoreVersions/${versionId}`, getToken),
    ascFetch<JsonApiResource[]>(
      `/appStoreVersionSubmissions?filter[appStoreVersion]=${versionId}&limit=1`,
      getToken,
    ),
  ])
  if (versionRes.error) return { state: null, error: versionRes.error }
  const version = versionRes.data
  const versionString = (version?.attributes?.versionString as string) ?? ''
  let state = 'READY_FOR_SUBMISSION'
  let rejectionReason: string | undefined

  const submissions = Array.isArray(submissionsRes.data)
    ? submissionsRes.data
    : []
  const submission = submissions[0]
  if (submission?.attributes?.state) {
    state = submission.attributes.state as string
  }

  const reviewDetailRes = await ascFetch<JsonApiResource | JsonApiResource[]>(
    `/appStoreVersions/${versionId}/appStoreReviewDetail`,
    getToken,
  )
  const reviewDetail = Array.isArray(reviewDetailRes.data)
    ? reviewDetailRes.data[0]
    : (reviewDetailRes.data as JsonApiResource | undefined)
  if (reviewDetail?.attributes) {
    const attrs = reviewDetail.attributes as {
      rejectionNotes?: string
      details?: { resolution?: string }[]
    }
    rejectionReason = attrs.rejectionNotes ?? attrs.details?.[0]?.resolution
  }

  return {
    state: {
      versionId,
      versionString,
      state,
      rejectionReason,
    },
  }
}

/** Submit an app store version for review (create submission) */
export async function submitVersionForReview(
  versionId: string,
  getToken: GetToken,
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await ascFetch<JsonApiResource>(
    '/appStoreVersionSubmissions',
    getToken,
    {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'appStoreVersionSubmissions',
          relationships: {
            appStoreVersion: {
              data: { type: 'appStoreVersions', id: versionId },
            },
          },
        },
      }),
    },
  )
  if (error) return { success: false, error }
  return { success: !!data }
}
