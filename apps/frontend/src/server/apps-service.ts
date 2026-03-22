import { and, asc, eq } from 'drizzle-orm'
import { getBuildByVersionId } from '@/lib/asc/builds'
import type {
  NormalizedAscError,
  NormalizedReviewSubmission,
} from '@/lib/asc/submissions'
import type { LocaleMetadata } from '@/lib/ai/suggest-rejection-fix'
import type { VersionLocalizationUpdate } from '@/lib/asc/localization-mutations'
import type { ReleaseTimelineEventType } from '@/lib/release-timeline-events'
import { runSubmissionRemediationWorker } from '@/lib/ai/submission-remediation-worker'
import { normalizeAscIssues } from '@/lib/asc/issues'
import { runWithAscCredentials } from '@/lib/asc/client'
import { getAppIconUrl, listApps } from '@/lib/asc/apps'
import {
  createAndSubmitReviewSubmission,
  getReviewSubmission,
  getVersionRejectionReason,
  listAppStoreVersions,
  listReviewSubmissions,
  submitExistingReviewSubmission,
} from '@/lib/asc/submissions'
import {
  listLocalizations,
} from '@/lib/asc/localizations'
import {
  updateVersionLocalization,
  invalidateLocalizationsCache,
} from '@/lib/asc/localization-mutations'
import { db } from '@repo/db'
import { ascApiKeys, connectedApps, releaseTimelineEvents } from '@repo/db/schema'
import { decrypt, encrypt } from '@/lib/encrypt'
import {
  RELEASE_TIMELINE_EVENT_CONFIG,
  RELEASE_TIMELINE_EVENT_TYPES,
} from '@/lib/release-timeline-events'
import { suggestRejectionFix as suggestRejectionFixWithModel } from '@/lib/ai/suggest-rejection-fix'
import { requireCurrentUserId } from '@/lib/auth.server'
import {
  listBranchesForRepo,
  listReposForUserInstallations,
} from '@/lib/github/server'

type AppStoreVersion = {
  id: string
  attributes?: {
    createdDate?: string
    appVersionState?: string
    versionString?: string
    platform?: string
  }
}

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
  githubInstallationId?: string
  githubRepoFullName?: string
  githubRepoOwner?: string
  githubRepoName?: string
  watchedBranch?: string
}

async function withAscContext<T>(
  input: {
    issuerId: string
    keyId: string
    encryptedPrivateKey: string
    scope: string
  },
  fn: () => Promise<T>,
): Promise<T> {
  const privateKey = decrypt(input.encryptedPrivateKey)
  if (!privateKey) {
    throw new Error('Failed to decrypt API key')
  }

  return runWithAscCredentials(
    {
      issuerId: input.issuerId,
      keyId: input.keyId,
      privateKey,
      scope: input.scope,
    },
    fn,
  )
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

export async function getConnectedAppDetails(
  requestHeaders: HeadersInit,
  { connectedAppId }: { connectedAppId: number },
) {
  const userId = await requireCurrentUserId(requestHeaders)

  const rows = await db
    .select({
      id: connectedApps.id,
      name: connectedApps.name,
      bundleId: connectedApps.bundleId,
      appStoreAppId: connectedApps.appStoreAppId,
      githubRepoFullName: connectedApps.githubRepoFullName,
      watchedBranch: connectedApps.watchedBranch,
      githubInstallationId: connectedApps.githubInstallationId,
      automationLocales: connectedApps.automationLocales,
      automationActivatedAt: connectedApps.automationActivatedAt,
    })
    .from(connectedApps)
    .where(
      and(
        eq(connectedApps.id, connectedAppId),
        eq(connectedApps.userId, userId),
      ),
    )
    .limit(1)

  const row = rows[0]
  if (!row) return null

  let iconUrl: string | null = null
  if (row.appStoreAppId) {
    try {
      iconUrl = await getAppIconUrl(row.appStoreAppId)
    } catch {
      // Icon fetch is best-effort
    }
  }

  return {
    id: row.id,
    name: row.name,
    bundleId: row.bundleId,
    appStoreAppId: row.appStoreAppId,
    iconUrl,
    githubRepoFullName: row.githubRepoFullName,
    watchedBranch: row.watchedBranch,
    githubInstallationId: row.githubInstallationId,
    automationLocales: row.automationLocales ?? [],
    automationActivatedAt: row.automationActivatedAt,
  }
}

export async function saveAscApiKey(
  requestHeaders: HeadersInit,
  data: { issuerId: string; keyId: string; privateKey: string },
) {
  const userId = await requireCurrentUserId(requestHeaders)

  try {
    await withAscContext(
      {
        issuerId: data.issuerId,
        keyId: data.keyId,
        encryptedPrivateKey: encrypt(data.privateKey.trim()),
        scope: `user:${userId}`,
      },
      () => listApps(true),
    )
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to validate key',
    }
  }

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
}

export async function testAscApiKey(
  requestHeaders: HeadersInit,
  data: { issuerId: string; keyId: string; privateKey: string },
) {
  const userId = await requireCurrentUserId(requestHeaders)

  try {
    await withAscContext(
      {
        issuerId: data.issuerId,
        keyId: data.keyId,
        encryptedPrivateKey: encrypt(data.privateKey.trim()),
        scope: `user:${userId}:test`,
      },
      () => listApps(true),
    )
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to validate key',
    }
  }

  return { success: true }
}

export async function hasAscApiKey(requestHeaders: HeadersInit) {
  const userId = await requireCurrentUserId(requestHeaders)

  const rows = await db
    .select({ id: ascApiKeys.id })
    .from(ascApiKeys)
    .where(eq(ascApiKeys.userId, userId))
    .limit(1)
  return !!rows[0]
}

export async function hasConnectedApps(requestHeaders: HeadersInit) {
  const userId = await requireCurrentUserId(requestHeaders)

  const rows = await db
    .select({ id: connectedApps.id })
    .from(connectedApps)
    .where(eq(connectedApps.userId, userId))
    .limit(1)

  return !!rows[0]
}

export async function listUnconnectedApps(requestHeaders: HeadersInit) {
  const userId = await requireCurrentUserId(requestHeaders)

  const keyRow = await db
    .select()
    .from(ascApiKeys)
    .where(eq(ascApiKeys.userId, userId))
    .limit(1)
  const row = keyRow[0]
  if (!row) return { apps: [], error: 'No App Store Connect key connected' }

  let listResult
  try {
    listResult = await withAscContext(
      {
        issuerId: row.issuerId,
        keyId: row.keyId,
        encryptedPrivateKey: row.encryptedPrivateKey,
        scope: `user:${userId}`,
      },
      () => listApps(),
    )
  } catch (error) {
    return {
      apps: [],
      error: error instanceof Error ? error.message : 'Failed to load apps',
    }
  }

  const connected = await db
    .select({ appStoreAppId: connectedApps.appStoreAppId })
    .from(connectedApps)
    .where(eq(connectedApps.userId, userId))
  const connectedIds = new Set(
    connected.map((c) => c.appStoreAppId).filter(Boolean),
  )

  const apps = listResult
    .filter((app) => !connectedIds.has(app.id))
    .map((app) => ({
      id: app.id,
      name: app.attributes.name,
      bundleId: app.attributes.bundleId,
      iconUrl: app.attributes.iconUrl,
    }))
  return { apps }
}

export async function listGithubReposForCurrentUser(requestHeaders: HeadersInit) {
  const userId = await requireCurrentUserId(requestHeaders)

  try {
    const repos = await listReposForUserInstallations(userId)
    return { repos }
  } catch (error) {
    return {
      repos: [],
      error: error instanceof Error ? error.message : 'Failed to load repos',
    }
  }
}

export async function listGithubBranchesForRepo(
  requestHeaders: HeadersInit,
  data: { installationId: string; repoFullName: string },
) {
  const userId = await requireCurrentUserId(requestHeaders)

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
}

export async function updateConnectedAppGithubConfig(
  requestHeaders: HeadersInit,
  data: {
    connectedAppId: number
    githubInstallationId: string
    githubRepoFullName: string
    githubRepoOwner: string
    githubRepoName: string
    watchedBranch: string
  },
) {
  const userId = await requireCurrentUserId(requestHeaders)

  const updated = await db
    .update(connectedApps)
    .set({
      githubInstallationId: data.githubInstallationId.trim(),
      githubRepoFullName: data.githubRepoFullName.trim(),
      githubRepoOwner: data.githubRepoOwner.trim(),
      githubRepoName: data.githubRepoName.trim(),
      watchedBranch: data.watchedBranch.trim(),
    })
    .where(
      and(
        eq(connectedApps.id, data.connectedAppId),
        eq(connectedApps.userId, userId),
      ),
    )
    .returning({
      githubInstallationId: connectedApps.githubInstallationId,
      githubRepoFullName: connectedApps.githubRepoFullName,
      watchedBranch: connectedApps.watchedBranch,
    })

  const row = updated[0]
  if (!row?.githubInstallationId || !row.githubRepoFullName) {
    return { success: false, error: 'App not found' }
  }

  return {
    success: true,
    githubInstallationId: row.githubInstallationId,
    githubRepoFullName: row.githubRepoFullName,
    watchedBranch: row.watchedBranch,
  }
}

export async function updateConnectedAppAutomationLocales(
  requestHeaders: HeadersInit,
  data: { connectedAppId: number; automationLocales: string[] },
) {
  const userId = await requireCurrentUserId(requestHeaders)
  const locales = Array.from(new Set(data.automationLocales.map((locale) => locale.trim()).filter(Boolean)))

  const updated = await db
    .update(connectedApps)
    .set({
      automationLocales: locales,
    })
    .where(
      and(
        eq(connectedApps.id, data.connectedAppId),
        eq(connectedApps.userId, userId),
      ),
    )
    .returning({
      id: connectedApps.id,
      automationLocales: connectedApps.automationLocales,
    })

  if (!updated[0]) {
    return { success: false, error: 'App not found' }
  }

  return {
    success: true,
    automationLocales: updated[0].automationLocales ?? [],
  }
}

export async function activateConnectedAppAutomation(
  requestHeaders: HeadersInit,
  data: { connectedAppId: number },
) {
  const userId = await requireCurrentUserId(requestHeaders)
  const activatedAt = new Date()

  const updated = await db
    .update(connectedApps)
    .set({
      automationActivatedAt: activatedAt,
    })
    .where(
      and(
        eq(connectedApps.id, data.connectedAppId),
        eq(connectedApps.userId, userId),
      ),
    )
    .returning({
      id: connectedApps.id,
      automationActivatedAt: connectedApps.automationActivatedAt,
    })

  if (!updated[0]) {
    return { success: false, error: 'App not found' }
  }

  return {
    success: true,
    automationActivatedAt: updated[0].automationActivatedAt,
  }
}

export async function connectApp(
  requestHeaders: HeadersInit,
  data: ConnectAppInput,
) {
  const userId = await requireCurrentUserId(requestHeaders)

  const keyRow = await db
    .select({ id: ascApiKeys.id })
    .from(ascApiKeys)
    .where(eq(ascApiKeys.userId, userId))
    .limit(1)
  const key = keyRow[0]

  if (!key) {
    return { success: false, error: 'No App Store Connect key connected' }
  }

  const inserted = await db
    .insert(connectedApps)
    .values({
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
    .returning({ id: connectedApps.id })

  return { success: true, connectedAppId: inserted[0]?.id ?? null }
}

export async function getConnectedApps(requestHeaders: HeadersInit) {
  const userId = await requireCurrentUserId(requestHeaders)

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
}

export async function getAppReviewSubmissions(
  requestHeaders: HeadersInit,
  data: { connectedAppId: number },
) {
  const userId = await requireCurrentUserId(requestHeaders)

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

  let subsResult: Awaited<ReturnType<typeof listReviewSubmissions>>
  let versionsResult: Awaited<ReturnType<typeof listAppStoreVersions>>
  let iconUrl: string | null

  try {
    ;[subsResult, versionsResult, iconUrl] = await Promise.all([
      withAscContext(
        {
          issuerId: app.issuerId,
          keyId: app.keyId,
          encryptedPrivateKey: app.encryptedPrivateKey,
          scope: `user:${userId}:app:${data.connectedAppId}`,
        },
        () => listReviewSubmissions(app.appStoreAppId!),
      ),
      withAscContext(
        {
          issuerId: app.issuerId,
          keyId: app.keyId,
          encryptedPrivateKey: app.encryptedPrivateKey,
          scope: `user:${userId}:app:${data.connectedAppId}`,
        },
        () => listAppStoreVersions(app.appStoreAppId!),
      ),
      getAppIconUrl(app.appStoreAppId),
    ])
  } catch (error) {
    return {
      submissions: [] as Array<NormalizedReviewSubmission>,
      appName: app.name,
      iconUrl: null,
      githubRepoFullName: app.githubRepoFullName,
      watchedBranch: app.watchedBranch,
      githubInstallationId: app.githubInstallationId,
      versionOptions: [] as Array<ReviewSubmissionVersionOption>,
      initialSubmissionCandidate: null as InitialSubmissionCandidate | null,
      initialSubmissionUnavailableReason: null as string | null,
      error: error instanceof Error ? error.message : 'Failed to load submissions',
    }
  }

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
        const reason = await withAscContext(
          {
            issuerId: app.issuerId!,
            keyId: app.keyId!,
            encryptedPrivateKey: app.encryptedPrivateKey!,
            scope: `user:${userId}:app:${data.connectedAppId}`,
          },
          () => getVersionRejectionReason(sub.appStoreVersion!.id),
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
}

export async function getReleaseTimelineEvents(
  requestHeaders: HeadersInit,
  data: { connectedAppId: number; versionId: string },
) {
  const userId = await requireCurrentUserId(requestHeaders)

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
}

export async function getVersionMetadata(
  requestHeaders: HeadersInit,
  data: { connectedAppId: number; versionId: string },
) {
  const userId = await requireCurrentUserId(requestHeaders)

  const app = await getConnectedAppById(userId, data.connectedAppId)
  if (!app?.issuerId || !app.keyId || !app.encryptedPrivateKey) {
    return { localizations: [], error: 'App not found' }
  }

  try {
    const localizations = await withAscContext(
      {
        issuerId: app.issuerId,
        keyId: app.keyId,
        encryptedPrivateKey: app.encryptedPrivateKey,
        scope: `user:${userId}:app:${data.connectedAppId}`,
      },
      () => listLocalizations(data.versionId),
    )

    return {
      localizations: localizations.map((localization) => ({
        id: localization.id,
        locale: localization.attributes.locale,
        description: localization.attributes.description ?? undefined,
        keywords: localization.attributes.keywords ?? undefined,
        promotionalText: localization.attributes.promotionalText ?? undefined,
        whatsNew: localization.attributes.whatsNew ?? undefined,
      })),
    }
  } catch (error) {
    return {
      localizations: [],
      error: error instanceof Error ? error.message : 'Failed to load metadata',
    }
  }
}

export async function applyVersionMetadata(
  requestHeaders: HeadersInit,
  data: {
    connectedAppId: number
    versionId: string
    localeId: string
    updates: VersionLocalizationUpdate
  },
) {
  const userId = await requireCurrentUserId(requestHeaders)

  const app = await getConnectedAppById(userId, data.connectedAppId)
  if (
    !app?.appStoreAppId ||
    !app.issuerId ||
    !app.keyId ||
    !app.encryptedPrivateKey
  ) {
    return { success: false, error: 'App not found' }
  }

  let result: { success: boolean; error?: string }
  try {
    await withAscContext(
      {
        issuerId: app.issuerId,
        keyId: app.keyId,
        encryptedPrivateKey: app.encryptedPrivateKey,
        scope: `user:${userId}:app:${data.connectedAppId}`,
      },
      () => updateVersionLocalization(data.localeId, data.updates),
    )
    invalidateLocalizationsCache(data.versionId)
    result = { success: true }
  } catch (error) {
    result = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update metadata',
    }
  }

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
}

export async function submitReviewSubmission(
  requestHeaders: HeadersInit,
  data: {
    connectedAppId: number
    reviewSubmissionId?: string
    versionId?: string
    platform?: string
    isResubmission?: boolean
  },
) {
  const userId = await requireCurrentUserId(requestHeaders)

  const app = await getConnectedAppById(userId, data.connectedAppId)

  if (
    !app?.appStoreAppId ||
    !app.issuerId ||
    !app.keyId ||
    !app.encryptedPrivateKey
  ) {
    return { success: false, error: 'App not found' }
  }

  let resolvedVersionId = data.versionId ?? null

  if (!resolvedVersionId) {
    const versionsResult = await withAscContext(
      {
        issuerId: app.issuerId,
        keyId: app.keyId,
        encryptedPrivateKey: app.encryptedPrivateKey,
        scope: `user:${userId}:app:${data.connectedAppId}`,
      },
      () => listAppStoreVersions(app.appStoreAppId!),
    )
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
    result = await withAscContext(
      {
        issuerId: app.issuerId,
        keyId: app.keyId,
        encryptedPrivateKey: app.encryptedPrivateKey,
        scope: `user:${userId}:app:${data.connectedAppId}`,
      },
      () =>
        submitExistingReviewSubmission(
          data.reviewSubmissionId!,
          resolvedVersionId ?? undefined,
          app.appStoreAppId!,
        ),
    )
  } else if (resolvedVersionId) {
    result = await withAscContext(
      {
        issuerId: app.issuerId,
        keyId: app.keyId,
        encryptedPrivateKey: app.encryptedPrivateKey,
        scope: `user:${userId}:app:${data.connectedAppId}`,
      },
      () =>
        createAndSubmitReviewSubmission(
          app.appStoreAppId!,
          resolvedVersionId!,
          data.platform ?? 'IOS',
        ),
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
}

export async function suggestRejectionFix(
  _requestHeaders: HeadersInit,
  data: { rejectionReason: string; currentMetadata: Array<LocaleMetadata> },
) {
  return suggestRejectionFixWithModel(data.rejectionReason, data.currentMetadata)
}

export async function getBuildById(
  requestHeaders: HeadersInit,
  data: { connectedAppId: number; versionId: string },
) {
  const userId = await requireCurrentUserId(requestHeaders)

  const app = await getConnectedAppById(userId, data.connectedAppId)
  if (!app?.issuerId || !app.keyId || !app.encryptedPrivateKey) {
    return { build: null, error: 'App not found' }
  }

  try {
    return await withAscContext(
      {
        issuerId: app.issuerId,
        keyId: app.keyId,
        encryptedPrivateKey: app.encryptedPrivateKey,
        scope: `user:${userId}:app:${data.connectedAppId}`,
      },
      () => getBuildByVersionId(data.versionId),
    )
  } catch (error) {
    return {
      build: null,
      error: error instanceof Error ? error.message : 'Failed to load build',
    }
  }
}

export async function refreshReviewSubmissionState(
  requestHeaders: HeadersInit,
  data: {
    connectedAppId: number
    reviewSubmissionId: string
    versionId: string
    previousState: string | null
  },
) {
  const userId = await requireCurrentUserId(requestHeaders)

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

  const { submission, error } = await withAscContext(
    {
      issuerId: app.issuerId,
      keyId: app.keyId,
      encryptedPrivateKey: app.encryptedPrivateKey,
      scope: `user:${userId}:app:${data.connectedAppId}`,
    },
    () => getReviewSubmission(data.reviewSubmissionId, true),
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
    const reason = await withAscContext(
      {
        issuerId: app.issuerId,
        keyId: app.keyId,
        encryptedPrivateKey: app.encryptedPrivateKey,
        scope: `user:${userId}:app:${data.connectedAppId}`,
      },
      () => getVersionRejectionReason(submission.appStoreVersion!.id),
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
}

export async function generateSubmissionRemediationPlan(
  requestHeaders: HeadersInit,
  data: {
    connectedAppId: number
    reviewSubmissionId: string
    versionId?: string | null
    latestErrors: Array<NormalizedAscError>
  },
) {
  const userId = await requireCurrentUserId(requestHeaders)

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

  const metadataResult =
    data.versionId
      ? await withAscContext(
          {
            issuerId: app.issuerId,
            keyId: app.keyId,
            encryptedPrivateKey: app.encryptedPrivateKey,
            scope: `user:${userId}:app:${data.connectedAppId}`,
          },
          async () => {
            const localizations = await listLocalizations(data.versionId!)
            return {
              localizations: localizations.map((localization) => ({
                id: localization.id,
                locale: localization.attributes.locale,
                description: localization.attributes.description ?? undefined,
                keywords: localization.attributes.keywords ?? undefined,
                promotionalText:
                  localization.attributes.promotionalText ?? undefined,
                whatsNew: localization.attributes.whatsNew ?? undefined,
              })),
              error: undefined,
            }
          },
        )
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
}
