'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Github,
  GitBranch,
  Globe,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

type AppOption = { id: string; name: string; bundleId: string }
type RepoOption = {
  installationId: string
  fullName: string
  owner: string
  name: string
  defaultBranch: string | null
}

const STEP_COUNT = 3
const STORAGE_KEY = 'releasepilot:initial-setup'

const PLACEHOLDER_LOCALES = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'fr-FR', label: 'French' },
  { code: 'de-DE', label: 'German' },
  { code: 'es-ES', label: 'Spanish' },
  { code: 'it-IT', label: 'Italian' },
  { code: 'pt-BR', label: 'Portuguese (BR)' },
  { code: 'ar-SA', label: 'Arabic' },
] as const

function repoKey(repo: RepoOption): string {
  return `${repo.installationId}:${repo.fullName}`
}

export default function InitialSetupWizardClient({
  initialApps,
  initialAppsError,
  initialRepos,
  initialReposError,
}: {
  initialApps: AppOption[]
  initialAppsError?: string
  initialRepos: RepoOption[]
  initialReposError?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState(1)
  const [selectedAppId, setSelectedAppId] = useState('')
  const [selectedLocales, setSelectedLocales] = useState<string[]>(['en-US'])
  const [useGithub, setUseGithub] = useState(initialRepos.length > 0)
  const [selectedRepoKey, setSelectedRepoKey] = useState('')
  const [watchedBranch, setWatchedBranch] = useState('')
  const [branchOptions, setBranchOptions] = useState<string[]>([])
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const githubStatus = searchParams.get('github')

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return

      const parsed = JSON.parse(raw) as {
        selectedAppId?: string
        selectedLocales?: string[]
        step?: number
      }

      if (parsed.selectedAppId) setSelectedAppId(parsed.selectedAppId)
      if (Array.isArray(parsed.selectedLocales) && parsed.selectedLocales.length > 0) {
        setSelectedLocales(parsed.selectedLocales)
      }
      if (typeof parsed.step === 'number' && parsed.step >= 1 && parsed.step <= STEP_COUNT) {
        setStep(parsed.step)
      }
    } catch {
      // ignore restore failures
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ selectedAppId, selectedLocales, step }),
    )
  }, [selectedAppId, selectedLocales, step])

  useEffect(() => {
    if (githubStatus === 'installed') {
      setUseGithub(true)
      setStep(3)
    }
  }, [githubStatus])

  const selectedApp = useMemo(
    () => initialApps.find((app) => app.id === selectedAppId) ?? null,
    [initialApps, selectedAppId],
  )

  const selectedRepo = useMemo(
    () => initialRepos.find((repo) => repoKey(repo) === selectedRepoKey) ?? null,
    [initialRepos, selectedRepoKey],
  )

  useEffect(() => {
    let cancelled = false

    async function loadBranches() {
      if (!selectedRepo || !useGithub) {
        setBranchOptions([])
        setWatchedBranch('')
        return
      }

      setLoadingBranches(true)

      try {
        const response = await fetch('/api/apps/github/branches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            installationId: selectedRepo.installationId,
            repoFullName: selectedRepo.fullName,
          }),
        })

        const result = (await response.json()) as {
          branches?: Array<{ name: string }>
          defaultBranch?: string | null
        }

        if (cancelled) return

        const branches = result.branches?.map((branch) => branch.name) ?? []
        setBranchOptions(branches)
        setWatchedBranch(result.defaultBranch ?? selectedRepo.defaultBranch ?? '')
      } finally {
        if (!cancelled) {
          setLoadingBranches(false)
        }
      }
    }

    void loadBranches()

    return () => {
      cancelled = true
    }
  }, [selectedRepo, useGithub])

  function toggleLocale(localeCode: string) {
    setSelectedLocales((current) => {
      if (current.includes(localeCode)) {
        if (current.length === 1) return current
        return current.filter((code) => code !== localeCode)
      }
      return [...current, localeCode]
    })
  }

  function canContinue(): boolean {
    if (step === 1) return !!selectedApp
    if (step === 2) return selectedLocales.length > 0
    if (!useGithub) return true
    if (initialRepos.length === 0) return false
    return !!selectedRepo && !!watchedBranch
  }

  function handleBack() {
    setError(null)
    setStep((current) => Math.max(1, current - 1))
  }

  async function handleFinish() {
    if (!selectedApp) {
      setError('Select an app to continue.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const payload: Record<string, string> = {
        appStoreAppId: selectedApp.id,
        name: selectedApp.name,
        bundleId: selectedApp.bundleId,
      }

      if (useGithub && selectedRepo && watchedBranch) {
        payload.githubInstallationId = selectedRepo.installationId
        payload.githubRepoFullName = selectedRepo.fullName
        payload.githubRepoOwner = selectedRepo.owner
        payload.githubRepoName = selectedRepo.name
        payload.watchedBranch = watchedBranch
      }

      const response = await fetch('/api/apps/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = (await response.json()) as {
        success?: boolean
        error?: string
        connectedAppId?: number | null
      }

      if (!response.ok || !result.success) {
        setError(result.error ?? 'Failed to connect app.')
        return
      }

      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(STORAGE_KEY)
      }

      if (result.connectedAppId) {
        router.push(`/apps/${result.connectedAppId}`)
      } else {
        router.push('/apps')
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect app.')
    } finally {
      setSaving(false)
    }
  }

  async function handleContinue() {
    if (!canContinue()) return

    if (step < STEP_COUNT) {
      setError(null)
      setStep((current) => current + 1)
      return
    }

    await handleFinish()
  }

  const stepTitle =
    step === 1
      ? 'Choose your first app'
      : step === 2
        ? 'Select languages (placeholder)'
        : 'Connect GitHub (optional)'

  const stepDescription =
    step === 1
      ? 'Pick the app you want ReleasePilot to manage first.'
      : step === 2
        ? 'This is a placeholder step for now. It will later drive localization scope.'
        : 'Link a repository for code-fix automation, or skip and keep localization-only automation.'

  return (
    <div className="min-h-screen bg-background px-6 py-8 lg:px-10 lg:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl flex-col rounded-2xl border border-border/70 bg-card/70 p-8 shadow-2xl backdrop-blur-sm lg:p-10">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-primary/80">
              Initial Setup
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              {stepTitle}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{stepDescription}</p>
          </div>

          <div className="flex items-center gap-2">
            {Array.from({ length: STEP_COUNT }, (_, index) => {
              const stepNumber = index + 1
              const active = stepNumber === step
              const done = stepNumber < step

              return (
                <div
                  key={stepNumber}
                  className={`h-2 rounded-full transition-all ${
                    active ? 'w-9 bg-primary' : done ? 'w-6 bg-primary/45' : 'w-6 bg-muted'
                  }`}
                />
              )
            })}
          </div>
        </div>

        {(initialAppsError || initialReposError || githubStatus === 'install_failed') && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
            <p className="text-xs text-destructive-foreground">
              {initialAppsError ||
                initialReposError ||
                searchParams.get('message') ||
                'GitHub install failed.'}
            </p>
          </div>
        )}

        <div className="flex-1">
          {step === 1 && (
            <div className="grid gap-3">
              {initialApps.length === 0 ? (
                <div className="rounded-xl border border-border/70 bg-background/50 px-4 py-5 text-sm text-muted-foreground">
                  No unconnected apps found in App Store Connect.
                </div>
              ) : (
                initialApps.map((app) => {
                  const isActive = selectedAppId === app.id

                  return (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => setSelectedAppId(app.id)}
                      className={`flex items-start justify-between rounded-xl border px-4 py-4 text-left transition-colors ${
                        isActive
                          ? 'border-primary/55 bg-primary/10'
                          : 'border-border/70 bg-background/50 hover:border-border hover:bg-background/70'
                      }`}
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">{app.name}</p>
                        <p className="mt-1 text-xs font-mono text-muted-foreground">{app.bundleId}</p>
                      </div>
                      {isActive ? <CheckCircle2 className="size-4 text-primary" /> : null}
                    </button>
                  )
                })
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-lg border border-primary/25 bg-primary/8 px-3 py-2">
                <p className="text-xs text-primary/90">
                  Languages are not persisted yet. This step is currently UI-only and will be wired later.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {PLACEHOLDER_LOCALES.map((locale) => {
                  const selected = selectedLocales.includes(locale.code)

                  return (
                    <label
                      key={locale.code}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                        selected
                          ? 'border-primary/50 bg-primary/10'
                          : 'border-border/70 bg-background/50 hover:bg-background/70'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleLocale(locale.code)}
                        className="size-4"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{locale.label}</p>
                        <p className="text-xs font-mono text-muted-foreground">{locale.code}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div className="rounded-lg border border-amber-400/30 bg-amber-300/10 px-3 py-2">
                <p className="text-xs text-amber-100">
                  If you skip GitHub, ReleasePilot will only automate localization fixes. Code-based remediation will stay disabled until a repo is connected.
                </p>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border/70 bg-background/50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Github className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Enable GitHub automation</p>
                    <p className="text-xs text-muted-foreground">Connect repository + branch for code fixes</p>
                  </div>
                </div>
                <button
                  type="button"
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    useGithub
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => setUseGithub((current) => !current)}
                >
                  {useGithub ? 'Enabled' : 'Skipped'}
                </button>
              </div>

              {useGithub && initialRepos.length === 0 ? (
                <div className="space-y-3 rounded-xl border border-border/70 bg-background/50 px-4 py-4">
                  <p className="text-sm text-foreground">No GitHub installation detected yet.</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <a href="/api/github/install/start?returnTo=%2Fapps">
                      <Button size="sm" className="gap-1.5">
                        <Github className="size-3.5" />
                        Install GitHub App
                      </Button>
                    </a>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setUseGithub(false)}
                    >
                      Skip for now
                    </Button>
                  </div>
                </div>
              ) : useGithub ? (
                <div className="space-y-4 rounded-xl border border-border/70 bg-background/50 px-4 py-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Repository</label>
                    <select
                      className="h-10 w-full rounded-md border border-border/70 bg-background px-3 text-sm"
                      value={selectedRepoKey}
                      onChange={(event) => setSelectedRepoKey(event.target.value)}
                    >
                      <option value="">Select repository</option>
                      {initialRepos.map((repo) => (
                        <option key={repoKey(repo)} value={repoKey(repo)}>
                          {repo.fullName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Branch</label>
                    <div className="flex items-center gap-2">
                      <GitBranch className="size-4 text-muted-foreground" />
                      <select
                        className="h-10 w-full rounded-md border border-border/70 bg-background px-3 text-sm"
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
                </div>
              ) : (
                <div className="rounded-xl border border-border/70 bg-background/50 px-4 py-4 text-sm text-muted-foreground">
                  GitHub is skipped for now. You can connect it later from app settings.
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2">
            <p className="text-xs text-destructive-foreground">{error}</p>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={step === 1 || saving}
            onClick={handleBack}
            className="gap-1.5"
          >
            <ArrowLeft className="size-3.5" />
            Back
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleContinue}
            disabled={!canContinue() || saving}
            className="gap-1.5"
          >
            {saving ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Finishing setup...
              </>
            ) : step < STEP_COUNT ? (
              <>
                Continue
                <ArrowRight className="size-3.5" />
              </>
            ) : (
              <>
                <Sparkles className="size-3.5" />
                Finish setup
              </>
            )}
          </Button>
        </div>

        <div className="mt-5 border-t border-border/70 pt-4 text-[11px] text-muted-foreground">
          <p className="inline-flex items-center gap-1.5">
            <Globe className="size-3" />
            Setup is sequential: app selection, language scope placeholder, then GitHub automation.
          </p>
        </div>
      </div>
    </div>
  )
}
