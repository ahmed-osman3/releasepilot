import { Navigate, createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { Loader2, PackageX, Send } from 'lucide-react'
import { Route as HeaderRoute } from './route'
import { Button } from '@/components/ui/button'
import { submitReviewSubmissionServer } from '@/lib/apps/server'
import { isActionableState, isReviewState } from '@/lib/submission-dashboard'

export const Route = createFileRoute('/apps/$appId/submissions/_header/')({
  component: SubmissionsIndexRedirect,
  wrapInSuspense: true,
})

function SubmissionsIndexRedirect() {
  const {
    connectedAppId,
    submissions,
    versionOptions,
    initialSubmissionCandidate,
    initialSubmissionUnavailableReason,
  } = HeaderRoute.useLoaderData()
  const router = useRouter()
  const [selectedVersionId, setSelectedVersionId] = useState(
    initialSubmissionCandidate?.versionId ?? (versionOptions[0]?.id || ''),
  )
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const sorted = [...submissions].sort((a, b) => {
    const aDate = Date.parse(a.submittedDate ?? '') || 0
    const bDate = Date.parse(b.submittedDate ?? '') || 0
    return bDate - aDate
  })

  const actionable = sorted.find(
    (s) => isActionableState(s.state) || isReviewState(s.state),
  )
  const target = actionable ?? sorted[0]
  const selectedVersion =
    versionOptions.find((version) => version.id === selectedVersionId) ?? null
  const canCreateInitialSubmission = !!selectedVersion?.eligibleForInitialSubmission

  const handleCreateInitialSubmission = async () => {
    if (!selectedVersion || !canCreateInitialSubmission || isCreating) return

    setCreateError(null)
    setIsCreating(true)

    try {
      const result = await submitReviewSubmissionServer({
        data: {
          connectedAppId,
          versionId: selectedVersion.id,
          platform: selectedVersion.platform,
        },
      })

      if (result.error || !result.reviewSubmissionId) {
        setCreateError(result.error ?? 'Failed to create the initial submission')
        return
      }

      await router.navigate({
        to: '/apps/$appId/submissions/$reviewSubmissionId',
        params: {
          appId: String(connectedAppId),
          reviewSubmissionId: result.reviewSubmissionId,
        },
      })
    } catch (error) {
      setCreateError(
        error instanceof Error
          ? error.message
          : 'Failed to create the initial submission',
      )
    } finally {
      setIsCreating(false)
    }
  }

  if (submissions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl border border-border/50 bg-muted/30">
            <PackageX className="size-5 text-muted-foreground" />
          </div>
          <p className="font-display text-sm font-medium text-foreground">
            No review submissions found
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {selectedVersion
              ? `Choose the App Store version to use for the first review submission.`
              : initialSubmissionUnavailableReason ??
                'Create a version in App Store Connect to get started.'}
          </p>
          {versionOptions.length > 0 && (
            <div className="mt-5 space-y-3">
              <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                Version
              </p>
              <div className="space-y-3 rounded-xl border border-border/50 bg-muted/20 px-4 py-3 text-left">
                <select
                  value={selectedVersionId}
                  onChange={(event) => setSelectedVersionId(event.target.value)}
                  className="h-10 w-full rounded-lg border border-border/60 bg-background/70 px-3 text-sm text-foreground outline-none"
                >
                  {versionOptions.map((version) => (
                    <option key={version.id} value={version.id}>
                      v{version.versionString} • {version.appVersionState.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>

                {selectedVersion && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Platform: {selectedVersion.platform}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Version state: {selectedVersion.appVersionState}
                    </p>
                    {!canCreateInitialSubmission && (
                      <p className="text-xs text-warning">
                        This version is not eligible for initial submission yet.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <Button
                onClick={handleCreateInitialSubmission}
                disabled={isCreating || !canCreateInitialSubmission}
                className="gap-2"
              >
                {isCreating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Create Initial Submission
              </Button>

              {createError && (
                <p className="text-xs text-destructive">{createError}</p>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <Navigate
      to="/apps/$appId/submissions/$reviewSubmissionId"
      params={{
        appId: String(connectedAppId),
        reviewSubmissionId: target.id,
      }}
      replace
    />
  )
}
