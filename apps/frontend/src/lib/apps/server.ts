import { createServerFn } from '@tanstack/react-start'
import { and, asc, eq } from 'drizzle-orm'
import { createAscJwt } from '@/lib/app-store-connect/jwt'
import { listApps, getAppIconUrl } from '@/lib/app-store-connect/apps'
import {
  listAppStoreVersions,
  getSubmissionState,
  submitVersionForReview,
} from '@/lib/app-store-connect/submissions'
import {
  getVersionLocalizations,
  updateVersionLocalization,
  type VersionLocalizationUpdate,
} from '@/lib/app-store-connect/localizations'
import { db } from '@repo/db'
import { ascApiKeys, connectedApps, releaseTimelineEvents } from '@repo/db/schema'
import { encrypt, decrypt } from '@/lib/encrypt'
import {
  RELEASE_TIMELINE_EVENT_CONFIG,
  RELEASE_TIMELINE_EVENT_TYPES,
  type ReleaseTimelineEventType,
} from '@/lib/release-timeline-events'
import {
  suggestRejectionFix,
  type LocaleMetadata,
} from '@/lib/ai/suggest-rejection-fix'
import { requireCurrentUserId } from '@/lib/auth.server'
import {
  listReposForUserInstallations,
  listBranchesForRepo,
} from '@/lib/github/server'
import type { GetToken } from '../app-store-connect/fetch'
import { getBuildByVersionId } from '../app-store-connect/builds'

type LogTimelineEventInput = {
  userId: string
  connectedAppId: number
  versionId: string
  eventType: ReleaseTimelineEventType
  detail?: string | null
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

async function logTimelineEvent({
  userId,
  connectedAppId,
  versionId,
  eventType,
  detail,
}: LogTimelineEventInput): Promise<void> {
  if (!versionId.trim()) return

  const app = await db
    .select({ id: connectedApps.id })
    .from(connectedApps)
    .where(
      and(eq(connectedApps.id, connectedAppId), eq(connectedApps.userId, userId)),
    )
    .limit(1)

  if (!app[0]) return

  await db.insert(releaseTimelineEvents).values({
    connectedAppId,
    versionId: versionId.trim(),
    eventType,
    detail: detail ?? null,
  })
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
        ...row,
        eventType: row.eventType,
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
      and(eq(connectedApps.id, connectedAppId), eq(connectedApps.userId, userId)),
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

/** Release state: versions with submission state and rejection info */
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
      return { versions: [], error: 'App not found' }
    }

    const getToken = getTokenForApp(
      app.issuerId,
      app.keyId,
      app.encryptedPrivateKey,
    )

    const { versions, error } = await listAppStoreVersions(
      app.appStoreAppId,
      getToken,
    )
    if (error) return { versions: [], error }

    const withState = await Promise.all(
      versions.map(async (v) => {
        const { state } = await getSubmissionState(v.id, getToken)
        return { ...v, submissionState: state }
      }),
    )

    return { versions: withState }
  })

/** Submissions for one app: versions with state, rejection reason, and app name */
export const getAppSubmissions = createServerFn({
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
        submissions: [],
        appName: null,
        iconUrl: null,
        githubRepoFullName: null,
        watchedBranch: null,
        githubInstallationId: null,
        error: 'App not found',
      }
    }

    const getToken = getTokenForApp(
      app.issuerId,
      app.keyId,
      app.encryptedPrivateKey,
    )

    const { versions, error } = await listAppStoreVersions(
      app.appStoreAppId,
      getToken,
    )

    const iconUrlPromise = app.appStoreAppId
      ? getAppIconUrl(app.appStoreAppId)
      : Promise.resolve(null)

    if (error) {
      const iconUrl = await iconUrlPromise
      return {
        submissions: [],
        appName: app.name,
        iconUrl,
        githubRepoFullName: app.githubRepoFullName,
        watchedBranch: app.watchedBranch,
        githubInstallationId: app.githubInstallationId,
        error,
      }
    }

    const rejectionReasons: Record<string, string> = {}
    const rejectedVersions = versions.filter(
      (v) =>
        v.attributes?.appVersionState === 'REJECTED' ||
        v.attributes?.appVersionState === 'METADATA_REJECTED',
    )

    await Promise.all(
      rejectedVersions.map(async (v) => {
        const { state } = await getSubmissionState(v.id, getToken)
        if (state?.rejectionReason) {
          rejectionReasons[v.id] = state.rejectionReason
        }
      }),
    )

    const iconUrl = await iconUrlPromise
    return {
      submissions: versions,
      appName: app.name,
      iconUrl,
      githubRepoFullName: app.githubRepoFullName,
      watchedBranch: app.watchedBranch,
      githubInstallationId: app.githubInstallationId,
      rejectionReasons,
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
        eventType: RELEASE_TIMELINE_EVENT_TYPES.AGENT_METADATA_CHANGES,
        detail: `Updated localization ${data.localeId}`,
      })
    }

    return result
  })

/** Submit version for review */
export const submitVersionForReviewServer = createServerFn({
  method: 'POST',
})
  .inputValidator((data: { connectedAppId: number; versionId: string }) => data)
  .handler(async ({ data }) => {
    const userId = await requireCurrentUserId()

    await logTimelineEvent({
      userId,
      connectedAppId: data.connectedAppId,
      versionId: data.versionId,
      eventType: RELEASE_TIMELINE_EVENT_TYPES.INITIAL_SUBMISSION_ATTEMPT,
    })

    await logTimelineEvent({
      userId,
      connectedAppId: data.connectedAppId,
      versionId: data.versionId,
      eventType: RELEASE_TIMELINE_EVENT_TYPES.MAKING_SUBMISSION,
    })

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
    const result = await submitVersionForReview(data.versionId, getToken)

    if (result.error) {
      await logTimelineEvent({
        userId,
        connectedAppId: data.connectedAppId,
        versionId: data.versionId,
        eventType: RELEASE_TIMELINE_EVENT_TYPES.SUBMISSION_FAILURE_RECEIVED,
        detail: result.error,
      })
      return result
    }

    await logTimelineEvent({
      userId,
      connectedAppId: data.connectedAppId,
      versionId: data.versionId,
      eventType: RELEASE_TIMELINE_EVENT_TYPES.WAITING_FOR_FEEDBACK,
    })

    return result
  })

/** AI suggestion for rejection fix (no ASC write) */
export const suggestRejectionFixServer = createServerFn({
  method: 'POST',
})
  .inputValidator(
    (data: { rejectionReason: string; currentMetadata: LocaleMetadata[] }) =>
      data,
  )
  .handler(async ({ data }) => {
    return suggestRejectionFix(data.rejectionReason, data.currentMetadata)
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
