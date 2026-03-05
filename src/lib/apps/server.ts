import { createServerFn } from '@tanstack/react-start'
import { and, asc, eq } from 'drizzle-orm'
import { getBuildByVersionId } from '../app-store-connect/builds'
import type {
  GetToken,
  NormalizedAscError,
  NormalizedReviewSubmission,
} from '../app-store-connect/fetch'
import type { LocaleMetadata } from '@/lib/ai/suggest-rejection-fix'
import type { VersionLocalizationUpdate } from '@/lib/app-store-connect/localizations'
import type { ReleaseTimelineEventType } from '@/lib/release-timeline-events'
import type { AppStoreVersion } from 'packages/asc/src/gen'
import { runSubmissionRemediationWorker } from '@/lib/ai/submission-remediation-worker'
import { createAscJwt } from '@/lib/app-store-connect/jwt'
import { normalizeAscIssues } from '@/lib/app-store-connect/issues'
import { getAppIconUrl, listApps } from '@/lib/app-store-connect/apps'
import {
  createAndSubmitReviewSubmission,
  getReviewSubmission,
  getVersionRejectionReason,
  listAppStoreVersions,
  listReviewSubmissions,
  submitExistingReviewSubmission,
} from '@/lib/app-store-connect/submissions'
import {
  getVersionLocalizations,
  updateVersionLocalization,
} from '@/lib/app-store-connect/localizations'
import { db } from '@/db/index'
import { ascApiKeys, connectedApps, releaseTimelineEvents } from '@/db/schema'
import { decrypt, encrypt } from '@/lib/encrypt'
import {
  RELEASE_TIMELINE_EVENT_CONFIG,
  RELEASE_TIMELINE_EVENT_TYPES,
} from '@/lib/release-timeline-events'
import { suggestRejectionFix } from '@/lib/ai/suggest-rejection-fix'
import { requireCurrentUserId } from '@/lib/auth.server'
import {
  listBranchesForRepo,
  listReposForUserInstallations,
} from '@/lib/github/server'

type InitialSubmissionCandidate = {
  versionId: string
  versionString: string
  platform: string
  appVersionState: string
}

type ReviewSubmissionVersionOption = {
  id: string
  versionString: string
  platform: string
  appVersionState: string
  createdDate: string | null
  eligibleForInitialSubmission: boolean
}

type LogTimelineEventInput = {
  userId: string
  connectedAppId: number
  versionId: string
  eventType: ReleaseTimelineEventType
  detail?: string | null
  payload?: Record<string, unknown> | null
}

type ConnectAppInput = {
  appStoreAppId: string
  name: string
  bundleId: string
  githubInstallationId: string
  githubRepoFullName: string
  githubRepoOwner: string
  githubRepoName: string
  watchedBranch: string
}

function getTokenForApp(
  issuerId: string,
  keyId: string,
  encryptedPrivateKey: string,
): GetToken {
  return async () => {
    const privateKey = decrypt(encryptedPrivateKey)
    if (!privateKey) throw new Error('Failed to decrypt API key')
    return createAscJwt(issuerId, keyId, privateKey)
  }
}

const INITIAL_SUBMISSION_STATES = new Set([
  'PREPARE_FOR_SUBMISSION',
  'DEVELOPER_REJECTED',
  'REJECTED',
  'METADATA_REJECTED',
])

function compareVersionsByCreatedDate(a: AppStoreVersion, b: AppStoreVersion) {
  const aDate = Date.parse(a.attributes?.createdDate ?? '') || 0
  const bDate = Date.parse(b.attributes?.createdDate ?? '') || 0
  return bDate - aDate
}

function mapVersionOption(version: AppStoreVersion): ReviewSubmissionVersionOption {
  const appVersionState = version.attributes?.appVersionState ?? 'UNKNOWN'

  return {
    id: version.id,
    versionString: version.attributes?.versionString ?? version.id,
    platform: version.attributes?.platform ?? 'IOS',
    appVersionState,
    createdDate: version.attributes?.createdDate ?? null,
    eligibleForInitialSubmission: INITIAL_SUBMISSION_STATES.has(appVersionState),
  }
}

function resolveInitialSubmissionCandidate(versions: Array<AppStoreVersion>): {
  candidate: InitialSubmissionCandidate | null
  unavailableReason: string | null
} {
  const sorted = versions
    .filter((version) => (version.attributes?.platform ?? 'IOS') === 'IOS')
    .sort(compareVersionsByCreatedDate)
  const eligible = sorted.find((version) =>
    INITIAL_SUBMISSION_STATES.has(version.attributes?.appVersionState ?? ''),
  )

  if (!eligible) {
    return {
      candidate: null,
      unavailableReason:
        sorted.length === 0
          ? 'Create a version in App Store Connect to get started.'
          : 'No eligible App Store version is ready for an initial submission yet.',
    }
  }

  return {
    candidate: {
      versionId: eligible.id,
      versionString: eligible.attributes?.versionString ?? eligible.id,
      platform: eligible.attributes?.platform ?? 'IOS',
      appVersionState: eligible.attributes?.appVersionState ?? 'UNKNOWN',
    },
    unavailableReason: null,
  }
}

function resolveVersionIdForSubmission(
  versions: Array<AppStoreVersion>,
  preferredVersionId?: string,
): string | null {
  if (preferredVersionId) return preferredVersionId
  return resolveInitialSubmissionCandidate(versions).candidate?.versionId ?? null
}

async function logTimelineEvent({
  userId,
  connectedAppId,
  versionId,
  eventType,
  detail,
  payload,
}: LogTimelineEventInput): Promise<void> {
  if (!versionId.trim()) return

  const app = await db
    .select({ id: connectedApps.id })
    .from(connectedApps)
    .where(
      and(
        eq(connectedApps.id, connectedAppId),
        eq(connectedApps.userId, userId),
      ),
    )
    .limit(1)

  if (!app[0]) return

  try {
    await db.insert(releaseTimelineEvents).values({
      connectedAppId,
      versionId: versionId.trim(),
      eventType,
      detail: detail ?? null,
      payload: payload ?? null,
    })
  } catch (err) {
    console.error('[logTimelineEvent] INSERT failed:', err)
  }
}

/** Verify ASC key and return list of apps (id, name, bundleId) */
export const verifyAndListApps = createServerFn({
  method: 'POST',
})
  .inputValidator(
    (data: { issuerId: string; keyId: string; privateKey: string }) => data,
  )
  .handler(async ({ data }) => {
    const { issuerId, keyId, privateKey } = data
    const getToken: GetToken = async () =>
      createAscJwt(issuerId, keyId, privateKey.trim())
    return listApps(getToken)
  })

/** Save App Store Connect API key for the user (one per user). Verify first, then upsert. */
export const saveAscApiKey = createServerFn({
  method: 'POST',
})
  .inputValidator(
    (data: { issuerId: string; keyId: string; privateKey: string }) => data,
  )
  .handler(async ({ data }) => {
    const userId = await requireCurrentUserId()

    const getToken: GetToken = async () =>
      createAscJwt(data.issuerId, data.keyId, data.privateKey.trim())
    const result = await listApps(getToken)
    if (result.error) return { success: false, error: result.error }

    const encrypted = encrypt(data.privateKey.trim())
    await db
      .insert(ascApiKeys)
      .values({
        userId,
        issuerId: data.issuerId.trim(),
        keyId: data.keyId.trim(),
        encryptedPrivateKey: encrypted,
      })
      .onConflictDoUpdate({
        target: ascApiKeys.userId,
        set: {
          issuerId: data.issuerId.trim(),
          keyId: data.keyId.trim(),
          encryptedPrivateKey: encrypted,
        },
      })

    return { success: true }
  })

/** Whether the user has connected their App Store Connect API. */
export const hasAscApiKey = createServerFn({
  method: 'GET',
}).handler(async () => {
  const userId = await requireCurrentUserId()

  const rows = await db
    .select({ id: ascApiKeys.id })
    .from(ascApiKeys)
    .where(eq(ascApiKeys.userId, userId))
    .limit(1)
  return !!rows[0]
})

/** List all apps from the user's saved ASC key. */
export const listAppsFromSavedKey = createServerFn({
  method: 'GET',
}).handler(async () => {
  const userId = await requireCurrentUserId()

  const keyRow = await db
    .select()
    .from(ascApiKeys)
    .where(eq(ascApiKeys.userId, userId))
    .limit(1)
  const row = keyRow[0]
  if (!row) return { apps: [], error: 'No App Store Connect key connected' }

  const getToken = getTokenForApp(
    row.issuerId,
    row.keyId,
    row.encryptedPrivateKey,
  )
  return listApps(getToken)
})

/** List apps from ASC that are not yet connected in ReleasePilot. */
export const listUnconnectedApps = createServerFn({
  method: 'GET',
}).handler(async () => {
  const userId = await requireCurrentUserId()

  const keyRow = await db
    .select()
    .from(ascApiKeys)
    .where(eq(ascApiKeys.userId, userId))
    .limit(1)
  const row = keyRow[0]
  if (!row) return { apps: [], error: 'No App Store Connect key connected' }

  const getToken = getTokenForApp(
    row.issuerId,
    row.keyId,
    row.encryptedPrivateKey,
  )
  const listResult = await listApps(getToken)
  if (listResult.error) return { apps: [], error: listResult.error }

  const connected = await db
    .select({ appStoreAppId: connectedApps.appStoreAppId })
    .from(connectedApps)
    .where(eq(connectedApps.userId, userId))
  const connectedIds = new Set(
    connected.map((c) => c.appStoreAppId).filter(Boolean),
  )

  const apps = listResult.apps.filter((a) => !connectedIds.has(a.id))
  return { apps }
})

export const listGithubReposForCurrentUser = createServerFn({
  method: 'GET',
}).handler(async () => {
  const userId = await requireCurrentUserId()

  try {
    const repos = await listReposForUserInstallations(userId)
    return { repos }
  } catch (error) {
    return {
      repos: [],
      error: error instanceof Error ? error.message : 'Failed to load repos',
    }
  }
})

export const listGithubBranchesForRepo = createServerFn({
  method: 'POST',
})
  .inputValidator(
    (data: { installationId: string; repoFullName: string }) => data,
  )
  .handler(async ({ data }) => {
    const userId = await requireCurrentUserId()

    try {
      const result = await listBranchesForRepo(
        userId,
        data.installationId,
        data.repoFullName,
      )
      return { ...result }
    } catch (error) {
      return {
        branches: [],
        defaultBranch: null,
        error:
          error instanceof Error ? error.message : 'Failed to load branches',
      }
    }
  })

/** Onboard a new app: add to connected apps using the saved API key. */
export const connectApp = createServerFn({
  method: 'POST',
})
  .inputValidator((data: ConnectAppInput) => data)
  .handler(async ({ data }) => {
    const userId = await requireCurrentUserId()

    if (
      !data.githubInstallationId ||
      !data.githubRepoFullName ||
      !data.githubRepoOwner ||
      !data.githubRepoName ||
      !data.watchedBranch
    ) {
      return { success: false, error: 'GitHub repo and branch are required' }
    }

    const keyRow = await db
      .select({ id: ascApiKeys.id })
      .from(ascApiKeys)
      .where(eq(ascApiKeys.userId, userId))
      .limit(1)
    const key = keyRow[0]

    if (!key) {
      return { success: false, error: 'No App Store Connect key connected' }
    }

    await db.insert(connectedApps).values({
      userId,
      ascKeyId: key.id,
      appStoreAppId: data.appStoreAppId,
      name: data.name,
      bundleId: data.bundleId,
      githubInstallationId: data.githubInstallationId,
      githubRepoFullName: data.githubRepoFullName,
      githubRepoOwner: data.githubRepoOwner,
      githubRepoName: data.githubRepoName,
      watchedBranch: data.watchedBranch,
    })

    return { success: true }
  })

/** List connected apps for the current user */
export const getConnectedApps = createServerFn({
  method: 'GET',
}).handler(async () => {
  const userId = await requireCurrentUserId()

  const rows = await db
    .select({
      id: connectedApps.id,
      name: connectedApps.name,
      bundleId: connectedApps.bundleId,
      appStoreAppId: connectedApps.appStoreAppId,
      githubInstallationId: connectedApps.githubInstallationId,
      githubRepoFullName: connectedApps.githubRepoFullName,
      githubRepoOwner: connectedApps.githubRepoOwner,
      githubRepoName: connectedApps.githubRepoName,
      watchedBranch: connectedApps.watchedBranch,
    })
    .from(connectedApps)
    .where(eq(connectedApps.userId, userId))

  const appsWithIcons = await Promise.all(
    rows.map(async (row) => {
      const iconUrl = row.appStoreAppId
        ? await getAppIconUrl(row.appStoreAppId)
        : null
      return { ...row, iconUrl }
    }),
  )

  return appsWithIcons
})

export const getReleaseTimelineEvents = createServerFn({
  method: 'GET',
})
  .inputValidator((data: { connectedAppId: number; versionId: string }) => data)
  .handler(async ({ data }) => {
    const userId = await requireCurrentUserId()

    const app = await getConnectedAppById(userId, data.connectedAppId)
    if (!app) return []

    const rows = await db
      .select({
        id: releaseTimelineEvents.id,
        eventType: releaseTimelineEvents.eventType,
        detail: releaseTimelineEvents.detail,
        payload: releaseTimelineEvents.payload,
        createdAt: releaseTimelineEvents.createdAt,
      })
      .from(releaseTimelineEvents)
      .where(
        and(
          eq(releaseTimelineEvents.connectedAppId, data.connectedAppId),
          eq(releaseTimelineEvents.versionId, data.versionId),
        ),
      )
      .orderBy(asc(releaseTimelineEvents.createdAt))

    return rows
      .filter(
        (row): row is typeof row & { eventType: ReleaseTimelineEventType } =>
          row.eventType in RELEASE_TIMELINE_EVENT_CONFIG,
      )
      .map((row) => ({
        id: row.id,
        eventType: row.eventType,
        detail: row.detail,
        payload: row.payload as Record<string, {}> | null,
        createdAt: row.createdAt,
      }))
  })

export const logReleaseTimelineEvent = createServerFn({
  method: 'POST',
})
  .inputValidator(
    (data: {
      connectedAppId: number
      versionId: string
      eventType: ReleaseTimelineEventType
      detail?: string
    }) => data,
  )
  .handler(async ({ data }) => {
    const userId = await requireCurrentUserId()

    await logTimelineEvent({ ...data, userId })
    return { success: true }
  })

/** Get app name by connected app id (for breadcrumbs) */
export const getConnectedAppName = createServerFn({
  method: 'GET',
})
  .inputValidator((data: { connectedAppId: number }) => data)
  .handler(async ({ data }) => {
    const userId = await requireCurrentUserId()

    const rows = await db
      .select({ name: connectedApps.name })
      .from(connectedApps)
      .where(
        and(
          eq(connectedApps.id, data.connectedAppId),
          eq(connectedApps.userId, userId),
        ),
      )
      .limit(1)
    return rows[0]?.name ?? null
  })

/** Get app record by connected_app id (for building getToken). Resolves key from asc_api_keys when ascKeyId is set. */
async function getConnectedAppById(userId: string, connectedAppId: number) {
  const rows = await db
    .select()
    .from(connectedApps)
    .where(
      and(
        eq(connectedApps.id, connectedAppId),
        eq(connectedApps.userId, userId),
      ),
    )
    .limit(1)

  const row = rows[0]
  if (!row?.appStoreAppId) return null

  if (row.ascKeyId != null) {
    const keyRows = await db
      .select()
      .from(ascApiKeys)
      .where(
        and(eq(ascApiKeys.id, row.ascKeyId), eq(ascApiKeys.userId, userId)),
      )
      .limit(1)
    const keyRow = keyRows[0]
    if (!keyRow) return null

    return {
      ...row,
      issuerId: keyRow.issuerId,
      keyId: keyRow.keyId,
      encryptedPrivateKey: keyRow.encryptedPrivateKey,
    }
  }

  if (!row.issuerId || !row.keyId || !row.encryptedPrivateKey) return null
  return row
}

/** Release state: review submissions with version context */
export const getAppReleaseState = createServerFn({
  method: 'GET',
})
  .inputValidator((data: { connectedAppId: number }) => data)
  .handler(async ({ data }) => {
    const userId = await requireCurrentUserId()

    const app = await getConnectedAppById(userId, data.connectedAppId)
    if (
      !app?.appStoreAppId ||
      !app.issuerId ||
      !app.keyId ||
      !app.encryptedPrivateKey
    ) {
      return { submissions: [], error: 'App not found' }
    }

    const getToken = getTokenForApp(
      app.issuerId,
      app.keyId,
      app.encryptedPrivateKey,
    )

    const { submissions, error } = await listReviewSubmissions(
      app.appStoreAppId,
      getToken,
    )
    if (error) return { submissions: [], error }

    return { submissions }
  })

/** Review submissions for one app with rejection reasons and app metadata */
export const getAppReviewSubmissions = createServerFn({
  method: 'GET',
})
  .inputValidator((data: { connectedAppId: number }) => data)
  .handler(async ({ data }) => {
    const userId = await requireCurrentUserId()

    const app = await getConnectedAppById(userId, data.connectedAppId)
    if (
      !app?.appStoreAppId ||
      !app.issuerId ||
      !app.keyId ||
      !app.encryptedPrivateKey
    ) {
      return {
        submissions: [] as Array<NormalizedReviewSubmission>,
        appName: null as string | null,
        iconUrl: null as string | null,
        githubRepoFullName: null as string | null,
        watchedBranch: null as string | null,
        githubInstallationId: null as string | null,
        versionOptions: [] as Array<ReviewSubmissionVersionOption>,
        initialSubmissionCandidate: null as InitialSubmissionCandidate | null,
        initialSubmissionUnavailableReason: null as string | null,
        error: 'App not found',
      }
    }

    const getToken = getTokenForApp(
      app.issuerId,
      app.keyId,
      app.encryptedPrivateKey,
    )

    const [subsResult, versionsResult, iconUrl] = await Promise.all([
      listReviewSubmissions(app.appStoreAppId, getToken),
      listAppStoreVersions(app.appStoreAppId, getToken),
      getAppIconUrl(app.appStoreAppId),
    ])

    if (subsResult.error || versionsResult.error) {
      return {
        submissions: [] as Array<NormalizedReviewSubmission>,
        appName: app.name,
        iconUrl,
        githubRepoFullName: app.githubRepoFullName,
        watchedBranch: app.watchedBranch,
        githubInstallationId: app.githubInstallationId,
        versionOptions: [] as Array<ReviewSubmissionVersionOption>,
        initialSubmissionCandidate: null as InitialSubmissionCandidate | null,
        initialSubmissionUnavailableReason: null as string | null,
        error: subsResult.error ?? versionsResult.error,
      }
    }

    const versionOptions = [...versionsResult.versions]
      .sort(compareVersionsByCreatedDate)
      .map(mapVersionOption)

    const submissions = await Promise.all(
      subsResult.submissions.map(async (sub) => {
        const versionState = sub.appStoreVersion?.appVersionState ?? ''
        const needsRejection =
          sub.state === 'UNRESOLVED_ISSUES' ||
          versionState === 'REJECTED' ||
          versionState === 'METADATA_REJECTED'

        if (needsRejection && sub.appStoreVersion) {
          const reason = await getVersionRejectionReason(
            sub.appStoreVersion.id,
            getToken,
          )
          return { ...sub, rejectionReason: reason }
        }
        return sub
      }),
    )

    let candidate: InitialSubmissionCandidate | null = null
    let unavailableReason: string | null = null

    if (submissions.length === 0) {
      const resolvedCandidate =
        resolveInitialSubmissionCandidate(versionsResult.versions)
      candidate = resolvedCandidate.candidate
      unavailableReason = resolvedCandidate.unavailableReason
    }

    return {
      submissions,
      appName: app.name,
      iconUrl,
      githubRepoFullName: app.githubRepoFullName,
      watchedBranch: app.watchedBranch,
      githubInstallationId: app.githubInstallationId,
      versionOptions,
      initialSubmissionCandidate: candidate,
      initialSubmissionUnavailableReason: unavailableReason,
    }
  })

/** Current metadata (localizations) for a version */
export const getVersionMetadata = createServerFn({
  method: 'GET',
})
  .inputValidator((data: { connectedAppId: number; versionId: string }) => data)
  .handler(async ({ data }) => {
    const userId = await requireCurrentUserId()

    const app = await getConnectedAppById(userId, data.connectedAppId)
    if (!app?.issuerId || !app.keyId || !app.encryptedPrivateKey) {
      return { localizations: [], error: 'App not found' }
    }

    const getToken = getTokenForApp(
      app.issuerId,
      app.keyId,
      app.encryptedPrivateKey,
    )

    return getVersionLocalizations(data.versionId, getToken)
  })

/** Apply user-approved metadata for one locale */
export const applyVersionMetadata = createServerFn({
  method: 'POST',
})
  .inputValidator(
    (data: {
      connectedAppId: number
      versionId: string
      localeId: string
      updates: VersionLocalizationUpdate
    }) => data,
  )
  .handler(async ({ data }) => {
    const userId = await requireCurrentUserId()

    const app = await getConnectedAppById(userId, data.connectedAppId)
    if (
      !app?.appStoreAppId ||
      !app.issuerId ||
      !app.keyId ||
      !app.encryptedPrivateKey
    ) {
      return { success: false, error: 'App not found' }
    }

    const getToken = getTokenForApp(
      app.issuerId,
      app.keyId,
      app.encryptedPrivateKey,
    )

    const result = await updateVersionLocalization(
      data.localeId,
      data.updates,
      getToken,
    )

    if (!result.error) {
      await logTimelineEvent({
        userId,
        connectedAppId: data.connectedAppId,
        versionId: data.versionId,
        eventType: RELEASE_TIMELINE_EVENT_TYPES.METADATA_FIX_APPLIED,
        detail: `Updated localization ${data.localeId}`,
      })
    } else {
      await logTimelineEvent({
        userId,
        connectedAppId: data.connectedAppId,
        versionId: data.versionId,
        eventType: RELEASE_TIMELINE_EVENT_TYPES.ASC_REQUEST_FAILED,
        detail: `Metadata update failed: ${result.error}`,
      })
    }

    return result
  })

/** Submit a review submission (or create one then submit) */
export const submitReviewSubmissionServer = createServerFn({
  method: 'POST',
})
  .inputValidator(
    (data: {
      connectedAppId: number
      reviewSubmissionId?: string
      versionId?: string
      platform?: string
      isResubmission?: boolean
    }) => data,
  )
  .handler(async ({ data }) => {
    const userId = await requireCurrentUserId()

    const app = await getConnectedAppById(userId, data.connectedAppId)

    if (
      !app?.appStoreAppId ||
      !app.issuerId ||
      !app.keyId ||
      !app.encryptedPrivateKey
    ) {
      return { success: false, error: 'App not found' }
    }

    const getToken = getTokenForApp(
      app.issuerId,
      app.keyId,
      app.encryptedPrivateKey,
    )

    let resolvedVersionId = data.versionId ?? null

    if (!resolvedVersionId) {
      const versionsResult = await listAppStoreVersions(app.appStoreAppId, getToken)
      if (versionsResult.error) {
        return { success: false, error: versionsResult.error }
      }
      resolvedVersionId = resolveVersionIdForSubmission(versionsResult.versions)
      if (!resolvedVersionId) {
        return {
          success: false,
          error: 'No eligible iOS App Store version is ready to submit.',
        }
      }
    }

    const timelineVersionId = resolvedVersionId ?? ''

    await logTimelineEvent({
      userId,
      connectedAppId: data.connectedAppId,
      versionId: timelineVersionId,
      eventType: data.isResubmission
        ? RELEASE_TIMELINE_EVENT_TYPES.RESUBMISSION_REQUESTED
        : RELEASE_TIMELINE_EVENT_TYPES.SUBMISSION_REQUESTED,
    })

    let result: {
      submission: NormalizedReviewSubmission | null
      error?: string
      errors?: Array<NormalizedAscError>
    }

    if (data.reviewSubmissionId) {
      result = await submitExistingReviewSubmission(
        data.reviewSubmissionId,
        getToken,
        resolvedVersionId ?? undefined,
      )
    } else if (resolvedVersionId) {
      result = await createAndSubmitReviewSubmission(
        app.appStoreAppId,
        resolvedVersionId,
        data.platform ?? 'IOS',
        getToken,
      )
    } else {
      return { success: false, error: 'No review submission or version specified' }
    }

    if (result.error) {
      console.error(result.error)
      await logTimelineEvent({
        userId,
        connectedAppId: data.connectedAppId,
        versionId: timelineVersionId,
        eventType: RELEASE_TIMELINE_EVENT_TYPES.ASC_REQUEST_FAILED,
        detail: result.error,
        payload: result.errors?.length ? { errors: result.errors } : null,
      })
      return { success: false, error: result.error }
    }

    await logTimelineEvent({
      userId,
      connectedAppId: data.connectedAppId,
      versionId: timelineVersionId,
      eventType: RELEASE_TIMELINE_EVENT_TYPES.SUBMISSION_ACCEPTED,
    })

    return {
      success: true,
      reviewSubmissionId: result.submission?.id,
    }
  })

/** AI suggestion for rejection fix (no ASC write) */
export const suggestRejectionFixServer = createServerFn({
  method: 'POST',
})
  .inputValidator(
    (data: { rejectionReason: string; currentMetadata: Array<LocaleMetadata> }) =>
      data,
  )
  .handler(async ({ data }) => {
    return suggestRejectionFix(data.rejectionReason, data.currentMetadata)
  })

export const generateSubmissionRemediationPlan = createServerFn({
  method: 'POST',
})
  .inputValidator(
    (data: {
      connectedAppId: number
      reviewSubmissionId: string
      versionId?: string | null
      latestErrors: Array<NormalizedAscError>
    }) => data,
  )
  .handler(async ({ data }) => {
    const userId = await requireCurrentUserId()

    const app = await getConnectedAppById(userId, data.connectedAppId)
    if (
      !app?.issuerId ||
      !app.keyId ||
      !app.encryptedPrivateKey ||
      !app.githubInstallationId ||
      !app.githubRepoFullName ||
      !app.watchedBranch
    ) {
      return {
        success: false,
        error: 'App is missing App Store Connect or GitHub configuration.',
      }
    }

    const issues = normalizeAscIssues(data.latestErrors)
    if (issues.length === 0) {
      return {
        success: false,
        error: 'No App Store Connect errors were provided for remediation.',
      }
    }

    const getToken = getTokenForApp(
      app.issuerId,
      app.keyId,
      app.encryptedPrivateKey,
    )

    const metadataResult =
      data.versionId
        ? await getVersionLocalizations(data.versionId, getToken)
        : { localizations: [], error: undefined }

    if (metadataResult.error) {
      return {
        success: false,
        error: metadataResult.error,
      }
    }

    const proposal = await runSubmissionRemediationWorker({
      userId,
      installationId: app.githubInstallationId,
      repoFullName: app.githubRepoFullName,
      branch: app.watchedBranch,
      issues,
      errors: data.latestErrors,
      localizations: metadataResult.localizations,
    })

    return {
      success: true,
      reviewSubmissionId: data.reviewSubmissionId,
      versionId: data.versionId ?? null,
      issues,
      repo: {
        fullName: app.githubRepoFullName,
        branch: app.watchedBranch,
        commitSha: proposal.repoCommitSha,
      },
      proposal: {
        summary: proposal.summary,
        rationale: proposal.rationale,
        missingInformation: proposal.missingInformation,
        proposedChanges: proposal.proposedChanges,
        availableTools: proposal.availableTools,
      },
    }
  })

export const getBuildById = createServerFn({
  method: 'GET',
})
  .inputValidator((data: { connectedAppId: number; versionId: string }) => data)
  .handler(async ({ data }) => {
    const userId = await requireCurrentUserId()

    const app = await getConnectedAppById(userId, data.connectedAppId)
    if (!app?.issuerId || !app.keyId || !app.encryptedPrivateKey) {
      return { build: null, error: 'App not found' }
    }

    const getToken = getTokenForApp(
      app.issuerId,
      app.keyId,
      app.encryptedPrivateKey,
    )
    return getBuildByVersionId(data.versionId, getToken)
  })

/** Refresh review submission state from ASC; detect state changes and log timeline events */
export const refreshReviewSubmissionState = createServerFn({
  method: 'POST',
})
  .inputValidator(
    (data: {
      connectedAppId: number
      reviewSubmissionId: string
      versionId: string
      previousState: string | null
    }) => data,
  )
  .handler(async ({ data }) => {
    const userId = await requireCurrentUserId()

    const app = await getConnectedAppById(userId, data.connectedAppId)
    if (
      !app?.appStoreAppId ||
      !app.issuerId ||
      !app.keyId ||
      !app.encryptedPrivateKey
    ) {
      return {
        submission: null as NormalizedReviewSubmission | null,
        stateChanged: false,
        error: 'App not found',
      }
    }

    const getToken = getTokenForApp(
      app.issuerId,
      app.keyId,
      app.encryptedPrivateKey,
    )

    const { submission, error } = await getReviewSubmission(
      data.reviewSubmissionId,
      getToken,
    )

    if (error || !submission) {
      await logTimelineEvent({
        userId,
        connectedAppId: data.connectedAppId,
        versionId: data.versionId,
        eventType: RELEASE_TIMELINE_EVENT_TYPES.ASC_REQUEST_FAILED,
        detail: error ?? 'Review submission not found',
      })
      return {
        submission: null as NormalizedReviewSubmission | null,
        stateChanged: false,
        error: error ?? 'Review submission not found',
      }
    }

    if (
      submission.appStoreVersion &&
      (submission.state === 'UNRESOLVED_ISSUES' ||
        submission.appStoreVersion.appVersionState === 'REJECTED' ||
        submission.appStoreVersion.appVersionState === 'METADATA_REJECTED')
    ) {
      const reason = await getVersionRejectionReason(
        submission.appStoreVersion.id,
        getToken,
      )
      submission.rejectionReason = reason
    }

    const newState = submission.state
    const stateChanged = newState !== data.previousState

    if (stateChanged) {
      const isRejection = newState === 'UNRESOLVED_ISSUES'
      await logTimelineEvent({
        userId,
        connectedAppId: data.connectedAppId,
        versionId: data.versionId,
        eventType: isRejection
          ? RELEASE_TIMELINE_EVENT_TYPES.REVIEW_FEEDBACK_RECEIVED
          : RELEASE_TIMELINE_EVENT_TYPES.STATE_REFRESHED,
        detail: `State changed: ${data.previousState ?? 'unknown'} → ${newState}`,
      })
    } else {
      await logTimelineEvent({
        userId,
        connectedAppId: data.connectedAppId,
        versionId: data.versionId,
        eventType: RELEASE_TIMELINE_EVENT_TYPES.STATE_REFRESHED,
        detail: `No state change detected (${newState})`,
      })
    }

    return {
      submission,
      stateChanged,
    }
  })
