import { createFileRoute, Link } from '@tanstack/react-router'
import { getConnectedApps, hasAscApiKey } from '@/lib/apps/server'
import { Button } from '@/components/ui/button'
import { AppWindow, Key, Plus, ArrowRight } from 'lucide-react'

export const Route = createFileRoute('/apps/')({
  component: AppsDashboardPage,
  loader: async () => {
    const [apps, hasKey] = await Promise.all([
      getConnectedApps(),
      hasAscApiKey(),
    ])
    return { apps, hasAscApiKey: hasKey }
  },
})

function AppsDashboardPage() {
  const { apps, hasAscApiKey } = Route.useLoaderData()

  return (
    <div className="min-h-screen p-8 lg:p-12">
      <div className="max-w-5xl mx-auto">
        {/* Page header */}
        <div className="flex items-center justify-between mb-10 animate-fade-in">
          <div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">
              Apps
            </h1>
            <p className="text-[13px] text-muted-foreground mt-1">
              Manage your connected App Store applications
            </p>
          </div>
          {hasAscApiKey && (
            <Link to="/apps/add">
              <Button size="sm" className="gap-1.5">
                <Plus className="size-3.5" />
                Add app
              </Button>
            </Link>
          )}
        </div>

        {/* No API key state */}
        {!hasAscApiKey ? (
          <div className="glass-card rounded-xl p-8 animate-fade-in-up">
            <div className="flex items-start gap-4">
              <div className="size-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <Key className="size-5 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-foreground">
                  Connect App Store Connect
                </h2>
                <p className="text-[13px] text-muted-foreground mt-1 max-w-md">
                  Add your API key to start managing app submissions. Your key is encrypted and stored securely.
                </p>
                <Link to="/apps/connect" className="mt-4 inline-block">
                  <Button size="sm" className="gap-1.5">
                    <Key className="size-3.5" />
                    Connect API key
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        ) : apps.length === 0 ? (
          /* No apps yet */
          <div className="glass-card rounded-xl p-8 animate-fade-in-up">
            <div className="flex items-start gap-4">
              <div className="size-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <AppWindow className="size-5 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-foreground">
                  Add your first app
                </h2>
                <p className="text-[13px] text-muted-foreground mt-1 max-w-md">
                  Your API key is connected. Choose an app from your account to start managing submissions.
                </p>
                <Link to="/apps/add" className="mt-4 inline-block">
                  <Button size="sm" className="gap-1.5">
                    <Plus className="size-3.5" />
                    Add app
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        ) : (
          /* App grid */
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {apps.map((app, index) => (
              <div
                key={app.id}
                className="glass-card-hover rounded-xl p-5 group animate-fade-in-up block"
                style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
              >
                <Link
                  to="/apps/$appId/submissions"
                  params={{ appId: String(app.id) }}
                  className="block"
                >
                  <div className="flex items-start gap-3">
                    {app.iconUrl ? (
                      <img
                        src={app.iconUrl}
                        alt={app.name ?? ''}
                        className="size-9 rounded-lg shrink-0 object-cover"
                      />
                    ) : (
                      <div className="size-9 rounded-lg bg-primary/8 border border-primary/15 flex items-center justify-center shrink-0">
                        <AppWindow className="size-4 text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[14px] font-semibold text-foreground truncate">
                        {app.name ?? 'Unnamed app'}
                      </h3>
                      <p className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">
                        {app.bundleId ?? app.appStoreAppId ?? ''}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground group-hover:text-primary transition-colors">
                    View submissions
                    <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
                {!app.githubRepoFullName && (
                  <div className="mt-3 rounded-md border border-amber-400/25 bg-amber-300/10 px-2.5 py-2 flex items-center justify-between gap-2">
                    <p className="text-[11px] text-amber-200">
                      GitHub setup required
                    </p>
                    <Link to="/apps/add">
                      <Button size="sm" variant="outline" className="h-7 text-[11px]">
                        Configure
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
