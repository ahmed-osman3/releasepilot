import { Outlet, createFileRoute, useRouterState } from '@tanstack/react-router'
import { Rocket, Terminal } from 'lucide-react'
import { getAppReviewSubmissions } from '@/lib/apps/server'
import { resolveWorkingVersionId } from '@/lib/submission-dashboard'

export const Route = createFileRoute('/apps/$appId/submissions/_header')({
  loader: async ({ params }) => {
    const result = await getAppReviewSubmissions({
      data: { connectedAppId: Number(params.appId) },
    })

    return {
      submissions: result.submissions,
      appName: result.appName ?? null,
      iconUrl: result.iconUrl ?? null,
      githubRepoFullName: result.githubRepoFullName ?? null,
      watchedBranch: result.watchedBranch ?? null,
      githubInstallationId: result.githubInstallationId ?? null,
      versionOptions: result.versionOptions,
      initialSubmissionCandidate: result.initialSubmissionCandidate ?? null,
      initialSubmissionUnavailableReason:
        result.initialSubmissionUnavailableReason ?? null,
      error: result.error,
      connectedAppId: Number(params.appId),
    }
  },
  component: RouteComponent,
  gcTime: 0,
})

function RouteComponent() {
  const { appName, iconUrl, submissions, versionOptions } =
    Route.useLoaderData()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  const matchedId = pathname.match(/\/submissions\/([^/]+)(?:\/|$)/)?.[1]
  const active = matchedId
    ? submissions.find((s) => s.id === matchedId)
    : submissions[0]

  const selectedVersionId = resolveWorkingVersionId({
    submissionVersionId: active?.appStoreVersion?.id,
    submissionPlatform: active?.platform,
    versionOptions,
  })

  return (
    <div className="h-screen overflow-hidden bg-background p-3 lg:p-4">
      <div className="release-shell flex h-full flex-col overflow-hidden rounded-2xl border border-border/60">
        <div className="border-b border-border/50 px-5 py-3">
          <div className="flex w-full items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              {iconUrl ? (
                <img
                  src={iconUrl}
                  alt={appName ?? ''}
                  className="size-10 shrink-0 rounded-lg object-cover ring-1 ring-white/8"
                />
              ) : (
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/6">
                  <Rocket className="size-4.5 text-primary" />
                </div>
              )}

              <div className="flex min-w-0 flex-col">
                <div className="flex items-center gap-2">
                  <Terminal className="size-3 text-muted-foreground" />
                  <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground">
                    RELEASE CONSOLE
                  </p>
                </div>
                <p className="font-display truncate text-lg font-semibold tracking-tight text-foreground">
                  {appName ?? 'Release Pilot'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {versionOptions.length > 0 && selectedVersionId && (
                <div className="min-w-[240px]">
                  <label
                    htmlFor="linked-version"
                    className="mb-1 block text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
                  >
                    Version
                  </label>
                  <select
                    id="linked-version"
                    value={selectedVersionId}
                    disabled
                    className="h-9 w-full rounded-lg border border-border/60 bg-muted/20 px-3 text-xs text-muted-foreground outline-none disabled:cursor-not-allowed disabled:opacity-100"
                  >
                    {versionOptions.map((version) => (
                      <option key={version.id} value={version.id}>
                        v{version.versionString} •{' '}
                        {version.appVersionState.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
