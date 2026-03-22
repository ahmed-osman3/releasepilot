'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'

type AppOption = {
  id: string
  name: string
  bundleId: string
  iconUrl?: string | null
}

export function AppConnectPicker({
  initialApps,
  initialError,
}: {
  initialApps: AppOption[]
  initialError?: string
}) {
  const router = useRouter()
  const [apps] = useState(initialApps)
  const [query, setQuery] = useState('')
  const [connectingId, setConnectingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(initialError ?? null)

  const filteredApps = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return apps
    return apps.filter((app) => {
      const name = app.name.toLowerCase()
      const bundleId = app.bundleId.toLowerCase()
      return name.includes(trimmed) || bundleId.includes(trimmed)
    })
  }, [apps, query])

  async function connectApp(app: AppOption) {
    setConnectingId(app.id)
    setError(null)

    try {
      const response = await fetch('/api/apps/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appStoreAppId: app.id,
          name: app.name,
          bundleId: app.bundleId,
        }),
      })

      const result = (await response.json()) as {
        success?: boolean
        error?: string
        connectedAppId?: number | null
      }

      if (!response.ok || !result.success || !result.connectedAppId) {
        setError(result.error ?? 'Failed to connect app.')
        return
      }

      router.push(`/apps/${result.connectedAppId}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect app.')
    } finally {
      setConnectingId(null)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6 lg:p-8">
      <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(102,126,234,0.22),transparent_38%),linear-gradient(180deg,rgba(16,18,31,0.98),rgba(10,12,22,0.96))] shadow-[0_28px_100px_rgba(0,0,0,0.4)]">
        <div className="flex flex-col gap-6 px-6 py-8 lg:flex-row lg:items-end lg:justify-between lg:px-8">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary/85">
              Add App
            </p>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-foreground">
              Connect an App Store app in one step
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Pick an unconnected app and we&apos;ll drop you straight into its dashboard. GitHub,
              branches, and localization scope can all be configured later inside the automation panel.
            </p>
          </div>

          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Available apps</p>
            <p className="mt-3 text-3xl font-semibold text-foreground">{apps.length}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Unconnected apps detected in App Store Connect.
            </p>
          </div>
        </div>

        <div className="border-t border-white/8 px-6 py-6 lg:px-8">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by app name or bundle id"
              className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.05] pl-11 pr-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/35"
            />
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredApps.map((app, index) => (
          <button
            key={app.id}
            type="button"
            onClick={() => void connectApp(app)}
            disabled={Boolean(connectingId)}
            className="animate-fade-in-up flex min-h-44 flex-col rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,20,33,0.96),rgba(11,13,24,0.96))] p-5 text-left transition hover:border-primary/25 hover:bg-[linear-gradient(180deg,rgba(25,27,43,0.98),rgba(14,16,28,0.98))] disabled:cursor-wait disabled:opacity-70"
            style={{ animationDelay: `${index * 40}ms` }}
          >
            <div className="flex items-start justify-between gap-3">
              {app.iconUrl ? (
                <img
                  src={app.iconUrl}
                  alt={app.name}
                  className="size-12 rounded-2xl object-cover shadow-sm"
                />
              ) : (
                <div className="flex size-12 items-center justify-center rounded-2xl bg-white/6 text-sm font-semibold text-muted-foreground">
                  {app.name.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="rounded-full border border-primary/15 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                App Store
              </div>
            </div>

            <div className="mt-6 flex-1">
              <p className="text-base font-semibold text-foreground">{app.name}</p>
              <p className="mt-2 font-mono text-xs text-muted-foreground">{app.bundleId}</p>
            </div>

            <div className="mt-6 flex items-center justify-between text-sm">
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <Plus className="size-4" />
                Connect instantly
              </span>
              {connectingId === app.id ? (
                <Loader2 className="size-4 animate-spin text-primary" />
              ) : (
                <ArrowRight className="size-4 text-muted-foreground" />
              )}
            </div>
          </button>
        ))}
      </div>

      {filteredApps.length === 0 ? (
        <section className="rounded-[24px] border border-white/10 bg-white/[0.03] px-6 py-10 text-center">
          <p className="text-base font-semibold text-foreground">No matching apps</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Try a different search, or make sure the app is visible in App Store Connect.
          </p>
        </section>
      ) : null}

      {apps.length === 0 ? (
        <section className="rounded-[24px] border border-white/10 bg-white/[0.03] px-6 py-10 text-center">
          <p className="text-base font-semibold text-foreground">No unconnected apps found</p>
          <p className="mt-2 text-sm text-muted-foreground">
            All available App Store apps are already connected for this workspace.
          </p>
          <div className="mt-5">
            <Button type="button" variant="outline" onClick={() => router.push('/apps')}>
              Back to apps
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  )
}
