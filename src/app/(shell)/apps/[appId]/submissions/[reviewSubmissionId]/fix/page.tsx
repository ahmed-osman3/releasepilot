import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import FixPageClient from './FixPageClient'
import { getAppReviewSubmissions, getVersionMetadata } from '@/server/apps-service'

export default async function FixPage({
  params,
}: {
  params: Promise<{ appId: string; reviewSubmissionId: string }>
}) {
  const { appId, reviewSubmissionId } = await params
  const connectedAppId = Number(appId)

  if (Number.isNaN(connectedAppId)) {
    redirect('/apps')
  }

  const requestHeaders = await headers()
  const subsResult = await getAppReviewSubmissions(requestHeaders, { connectedAppId })
  const submission =
    subsResult.submissions.find((s) => s.id === reviewSubmissionId) ?? null

  if (!submission) {
    redirect(`/apps/${connectedAppId}/submissions`)
  }

  const versionId = submission.appStoreVersion?.id ?? null
  const metaResult = versionId
    ? await getVersionMetadata(requestHeaders, { connectedAppId, versionId })
    : { localizations: [], error: undefined }

  return (
    <FixPageClient
      connectedAppId={connectedAppId}
      reviewSubmissionId={reviewSubmissionId}
      versionId={versionId}
      rejectionReason={submission.rejectionReason ?? null}
      localizations={metaResult.localizations ?? []}
      error={subsResult.error ?? metaResult.error}
    />
  )
}
