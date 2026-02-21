import {
  Outlet,
  createFileRoute,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router'
import { BellIcon, Rocket } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { getAppSubmissions } from '@/lib/apps/server'

export const Route = createFileRoute('/apps/$appId/submissions/_header')({
  loader: async ({ params }) => {
    const result = await getAppSubmissions({
      data: { connectedAppId: Number(params.appId) },
    })

    return {
      submissions: result.submissions,
      appName: result.appName ?? null,
      iconUrl: result.iconUrl ?? null,
      rejectionReasons: result.rejectionReasons ?? {},
      error: result.error,
      connectedAppId: Number(params.appId),
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { appName, iconUrl, submissions, connectedAppId } = Route.useLoaderData()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const navigate = useNavigate()

  const matchedVersionId = pathname.match(/\/submissions\/([^/]+)(?:\/|$)/)?.[1]
  const selectedVersionId = matchedVersionId ?? submissions[0].id

  return (
    <div className="h-screen overflow-hidden bg-background p-4 lg:p-5">
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/60 backdrop-blur-sm">
        <div className="flex w-full flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {iconUrl ? (
            <img
              src={iconUrl}
              alt={appName ?? ''}
              className="size-12 rounded-xl shrink-0 object-cover"
            />
          ) : (
            <div className="size-12 rounded-xl bg-primary/8 border border-primary/15 flex items-center justify-center shrink-0">
              <Rocket className="size-6 text-primary" />
            </div>
          )}

          <div className="flex min-w-0 flex-col gap-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {appName ?? 'Release Pilot'}
            </p>
            <label
              className="text-xs text-muted-foreground"
              htmlFor="version-select"
            >
              Version
            </label>
            <select
              id="version-select"
              value={selectedVersionId}
              onChange={(event) => {
                const versionId = event.target.value
                if (!versionId) {
                  return
                }

                void navigate({
                  to: '/apps/$appId/submissions/$versionId',
                  params: {
                    appId: String(connectedAppId),
                    versionId,
                  },
                })
              }}
              className="h-9 min-w-[260px] rounded-lg border border-border/80 bg-background/70 px-3 text-xs text-foreground outline-none"
            >
              {submissions.map((submission) => {
                const label = submission.attributes?.versionString ?? submission.id
                const state = submission.attributes?.appVersionState ?? 'UNKNOWN'
                return (
                  <option key={submission.id} value={submission.id}>
                    v{label} • {state.replace(/_/g, ' ')}
                  </option>
                )
              })}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Notifications">
            <BellIcon className="size-4" />
          </Button>
          <Avatar>
            <AvatarImage src="https://github.com/shadcn.png" />
            <AvatarFallback>CN</AvatarFallback>
          </Avatar>
        </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
