import { Link, useParams, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getConnectedAppName } from '@/lib/apps/server'
import { ChevronRight } from 'lucide-react'

export default function AppBreadcrumbs() {
  const params = useParams({ strict: false })
  const appId = params?.appId
  const pathname = useRouterState({ select: (s) => s.location.pathname }) ?? ''

  const { data: appName } = useQuery({
    queryKey: ['appName', appId],
    queryFn: () =>
      getConnectedAppName({
        data: { connectedAppId: Number(appId) },
      }),
    enabled: Boolean(appId) && !Number.isNaN(Number(appId)),
  })

  if (!appId || Number.isNaN(Number(appId))) return null
  const isFixPage = pathname.includes('/fix')
  const isSubmissionsPage = pathname.includes('/submissions') && !pathname.includes('/fix')

  return (
    <div className="border-b border-border bg-card px-4 py-2">
      <div className="max-w-4xl mx-auto flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/apps" className="hover:text-foreground transition-colors">
          Apps
        </Link>
        <ChevronRight className="size-4 shrink-0" aria-hidden />
        <span className="text-foreground font-medium truncate">
          {appName ?? `App #${appId}`}
        </span>
        <ChevronRight className="size-4 shrink-0" aria-hidden />
        {isFixPage ? (
          <>
            <Link
              to="/apps/$appId/submissions"
              params={{ appId }}
              className="hover:text-foreground transition-colors"
            >
              Submissions
            </Link>
            <ChevronRight className="size-4 shrink-0" aria-hidden />
            <span className="text-foreground font-medium">Fix</span>
          </>
        ) : isSubmissionsPage ? (
          <span className="text-foreground font-medium">Submissions</span>
        ) : null}
      </div>
    </div>
  )
}
