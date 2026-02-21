import { createFileRoute, useRouter, Link } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import {
  listUnconnectedApps,
  connectApp,
  listGithubBranchesForRepo,
  listGithubReposForCurrentUser,
} from '@/lib/apps/server'
import { Button } from '@/components/ui/button'
import { ArrowLeft, AppWindow, Loader2, Plus, Github, GitBranch } from 'lucide-react'

export const Route = createFileRoute('/apps/add')({
  component: AddAppPage,
  loader: async () => {
    const [appsResult, reposResult] = await Promise.all([
      listUnconnectedApps(),
      listGithubReposForCurrentUser(),
    ])

    return {
      apps: appsResult.apps,
      appsError: appsResult.error,
      repos: reposResult.repos,
      reposError: reposResult.error,
    }
  },
})

function AddAppPage() {
  const router = useRouter()
  const { apps, appsError, repos, reposError } = Route.useLoaderData()

  const [selectedAppId, setSelectedAppId] = useState('')
  const [selectedRepoKey, setSelectedRepoKey] = useState('')
  const [watchedBranch, setWatchedBranch] = useState('')
  const [branchOptions, setBranchOptions] = useState<string[]>([])
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedApp = useMemo(
    () => apps.find((app) => app.id === selectedAppId) ?? null,
    [apps, selectedAppId],
  )

  const selectedRepo = useMemo(
    () => repos.find((repo) => repoKey(repo) === selectedRepoKey) ?? null,
    [repos, selectedRepoKey],
  )

  useEffect(() => {
    let cancelled = false

    async function loadBranches() {
      if (!selectedRepo) {
        setBranchOptions([])
        setWatchedBranch('')
        return
      }

      setLoadingBranches(true)
      const result = await listGithubBranchesForRepo({
        data: {
          installationId: selectedRepo.installationId,
          repoFullName: selectedRepo.fullName,
        },
      })

      if (cancelled) return

      const branches = result.branches?.map((branch) => branch.name) ?? []
      setBranchOptions(branches)
      setWatchedBranch(result.defaultBranch ?? selectedRepo.defaultBranch ?? '')
      setLoadingBranches(false)
    }

    void loadBranches()
    return () => {
      cancelled = true
    }
  }, [selectedRepo])

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!selectedApp || !selectedRepo || !watchedBranch) {
      setError('Select app, repo, and branch to continue.')
      return
    }

    setSaving(true)

    try {
      const result = await connectApp({
        data: {
          appStoreAppId: selectedApp.id,
          name: selectedApp.name,
          bundleId: selectedApp.bundleId,
          githubInstallationId: selectedRepo.installationId,
          githubRepoFullName: selectedRepo.fullName,
          githubRepoOwner: selectedRepo.owner,
          githubRepoName: selectedRepo.name,
          watchedBranch,
        },
      })

      if (result.error) {
        setError(result.error)
        return
      }

      await router.invalidate()
      router.navigate({ to: '/apps' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add app.')
    } finally {
      setSaving(false)
    }
  }

  const hasInstallations = repos.length > 0

  return (
    <div className="min-h-screen p-8 lg:p-12">
      <div className="max-w-2xl mx-auto">
        <Link
          to="/apps"
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="size-3.5" />
          Back to Apps
        </Link>

        <div className="animate-fade-in-up">
          <div className="flex items-start gap-4 mb-8">
            <div className="size-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Plus className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground tracking-tight">
                Add an app
              </h1>
              <p className="text-[13px] text-muted-foreground mt-1">
                Connect App Store app to a GitHub repository
              </p>
            </div>
          </div>

          {appsError && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 mb-4">
              <p className="text-[12px] text-destructive-foreground">{appsError}</p>
            </div>
          )}

          {reposError && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 mb-4">
              <p className="text-[12px] text-destructive-foreground">{reposError}</p>
            </div>
          )}

          {!hasInstallations ? (
            <div className="glass-card rounded-xl p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="size-8 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
                  <Github className="size-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-[14px] font-medium text-foreground">GitHub app not installed</p>
                  <p className="text-[12px] text-muted-foreground mt-1">
                    Install the GitHub App first, then return to select repository and branch.
                  </p>
                </div>
              </div>
              <a href="/api/github/install/start?returnTo=%2Fapps%2Fadd">
                <Button size="sm" className="gap-1.5">
                  <Github className="size-3.5" />
                  Install GitHub App
                </Button>
              </a>
            </div>
          ) : (
            <form onSubmit={handleConnect} className="glass-card rounded-xl p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-[12px] text-muted-foreground">App Store app</label>
                <select
                  className="h-10 w-full rounded-md border border-border/70 bg-background/60 px-3 text-sm"
                  value={selectedAppId}
                  onChange={(event) => setSelectedAppId(event.target.value)}
                >
                  <option value="">Select app</option>
                  {apps.map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.name} ({app.bundleId})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[12px] text-muted-foreground">GitHub repository</label>
                <select
                  className="h-10 w-full rounded-md border border-border/70 bg-background/60 px-3 text-sm"
                  value={selectedRepoKey}
                  onChange={(event) => setSelectedRepoKey(event.target.value)}
                >
                  <option value="">Select repository</option>
                  {repos.map((repo) => (
                    <option key={repoKey(repo)} value={repoKey(repo)}>
                      {repo.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[12px] text-muted-foreground">Branch to watch</label>
                <div className="flex items-center gap-2">
                  <GitBranch className="size-4 text-muted-foreground" />
                  <select
                    className="h-10 w-full rounded-md border border-border/70 bg-background/60 px-3 text-sm"
                    value={watchedBranch}
                    onChange={(event) => setWatchedBranch(event.target.value)}
                    disabled={loadingBranches || branchOptions.length === 0}
                  >
                    <option value="">Select branch</option>
                    {branchOptions.map((branch) => (
                      <option key={branch} value={branch}>
                        {branch}
                      </option>
                    ))}
                  </select>
                </div>
                {loadingBranches && (
                  <p className="text-[11px] text-muted-foreground">Loading branches...</p>
                )}
              </div>

              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
                  <p className="text-[12px] text-destructive-foreground">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                size="sm"
                className="gap-1.5"
                disabled={!selectedApp || !selectedRepo || !watchedBranch || saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <AppWindow className="size-3.5" />
                    Add app
                  </>
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

function repoKey(repo: { installationId: string; fullName: string }) {
  return `${repo.installationId}:${repo.fullName}`
}
