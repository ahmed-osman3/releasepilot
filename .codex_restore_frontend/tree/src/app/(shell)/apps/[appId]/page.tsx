import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  getAppReviewSubmissions,
  getConnectedAppDetails,
  getReleaseTimelineEvents,
} from '@/server/apps-service'
import {
  isActionableState,
  isReviewState,
  resolveWorkingVersionId,
} from '@/lib/submission-dashboard'
import OverviewClient from './OverviewClient'

export default async function AppOverviewPage({
  params,
}: {
  params: Promise<{ appId: string }>
}) {
  const { appId } = await params
  const connectedAppId = Number(appId)

  if (Number.isNaN(connectedAppId)) {
    redirect('/apps')
  }

  const requestHeaders = await headers()

  const [subsResult, appDetails] = await Promise.all([
    getAppReviewSubmissions(requestHeaders, { connectedAppId }),
    getConnectedAppDetails(requestHeaders, { connectedAppId }),
  ])

  if (!appDetails) {
    redirect('/apps')
  }

  const sorted = [...subsResult.submissions].sort((a, b) => {
    const aDate = Date.parse(a.submittedDate ?? '') || 0
    const bDate = Date.parse(b.submittedDate ?? '') || 0
    return bDate - aDate
  })

  const actionable = sorted.find(
    (s) => isActionableState(s.state) || isReviewState(s.state),
  )
  const activeSubmission = actionable ?? sorted[0] ?? null

  const versionId = activeSubmission
    ? resolveWorkingVersionId({
        submissionVersionId: activeSubmission.appStoreVersion?.id,
        submissionPlatform: activeSubmission.platform,
        versionOptions: subsResult.versionOptions,
      })
    : null

  const timelineEvents = versionId
    ? await getReleaseTimelineEvents(requestHeaders, {
        connectedAppId,
        versionId,
      })
    : []

  return (
    <OverviewClient
      connectedAppId={connectedAppId}
      appName={appDetails.name}
      bundleId={appDetails.bundleId}
      iconUrl={appDetails.iconUrl}
      reviewState={activeSubmission?.state ?? null}
      rejectionReason={activeSubmission?.rejectionReason ?? null}
      versionString={
        activeSubmission?.appStoreVersion?.versionString ?? null
      }
      appVersionState={
        activeSubmission?.appStoreVersion?.appVersionState ?? null
      }
      timelineEvents={timelineEvents as never}
      githubRepoFullName={appDetails.githubRepoFullName}
      watchedBranch={appDetails.watchedBranch}
      githubInstallationId={appDetails.githubInstallationId}
      error={subsResult.error}
    />
  )
}
