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
import { deriveAutomationOnboardingStatus } from '@/features/app-onboarding/automation-status'

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

  const connectedApp = appDetails!

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
      appName={connectedApp.name}
      bundleId={connectedApp.bundleId}
      iconUrl={connectedApp.iconUrl}
      reviewState={activeSubmission?.state ?? null}
      rejectionReason={activeSubmission?.rejectionReason ?? null}
      versionString={
        activeSubmission?.appStoreVersion?.versionString ?? null
      }
      timelineEvents={timelineEvents as never}
      githubRepoFullName={connectedApp.githubRepoFullName}
      watchedBranch={connectedApp.watchedBranch}
      githubInstallationId={connectedApp.githubInstallationId}
      automationLocales={connectedApp.automationLocales}
      automationActivatedAt={connectedApp.automationActivatedAt}
      onboardingStatus={deriveAutomationOnboardingStatus({
        appStoreAppId: connectedApp.appStoreAppId,
        githubInstallationId: connectedApp.githubInstallationId,
        githubRepoFullName: connectedApp.githubRepoFullName,
        watchedBranch: connectedApp.watchedBranch,
        automationLocales: connectedApp.automationLocales,
      })}
      error={subsResult.error}
    />
  )
}
