'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  GitBranch,
  Github,
  Languages,
  Loader2,
  Play,
  Rocket,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AUTOMATION_LOCALE_OPTIONS } from '@/features/app-onboarding/locale-options'
import type {
  AutomationChecklistStepId,
  AutomationOnboardingStatus,
} from '@/features/app-onboarding/automation-status'
import {
  listGithubBranchesServer,
  listGithubReposServer,
  updateAutomationLocalesServer,
  updateGithubBranchServer,
} from '@/lib/client/apps-api'

type RepoOption = {
  installationId: string
  fullName: string
  owner: string
  name: string
  defaultBranch: string
  private: boolean
}

type BranchOption = string | { name: string }

const STEP_ORDER: AutomationChecklistStepId[] = [
  'app',
  'github_repo',
  'github_branch',
  'localizations',
]

function normalizeBranchOptions(branches: BranchOption[] | undefined): string[] {
  if (!branches) return []

  return Array.from(
    new Set(
      branches
        .map((branch) => (typeof branch === 'string' ? branch : branch.name))
        .map((branch) => branch.trim())
        .filter(Boolean),
    ),
  )
}

export function AutomationSetupPanel({
  open,
  activeStep,
  status,
  connectedAppId,
  githubInstallationId,
  githubRepoFullName,
  watchedBranch,
  automationLocales,
  isStartingAutomation,
  startupLogs,
  startupError,
  isAutomationActivated,
  onBeginAutomation,
  onClose,
  onStepChange,
  onGithubSaved,
  onLocalesSaved,
}: {
  open: boolean
  activeStep: AutomationChecklistStepId
  status: AutomationOnboardingStatus
  connectedAppId: number
  githubInstallationId: string | null
  githubRepoFullName: string | null
  watchedBranch: string | null
  automationLocales: string[]
  isStartingAutomation: boolean
  startupLogs: string[]
  startupError: string | null
  isAutomationActivated: boolean
  onBeginAutomation: () => void
  onClose: () => void
  onStepChange: (stepId: AutomationChecklistStepId) => void
  onGithubSaved: (payload: {
    githubInstallationId: string
    githubRepoFullName: string
    watchedBranch: string
  }) => void
  onLocalesSaved: (locales: string[]) => void
}) {
  const [repoOptions, setRepoOptions] = useState<RepoOption[]>([])
  const [repoLoading, setRepoLoading] = useState(false)
  const [branchLoading, setBranchLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedRepoKey, setSelectedRepoKey] = useState(
    githubInstallationId && githubRepoFullName ? `${githubInstallationId}:${githubRepoFullName}` : '',
  )
  const [branchOptions, setBranchOptions] = useState<string[]>([])
  const [branchValue, setBranchValue] = useState(watchedBranch ?? '')
  const [selectedLocales, setSelectedLocales] = useState(
    automationLocales.length > 0 ? automationLocales : ['en-US'],
  )
  const [repoMenuOpen, setRepoMenuOpen] = useState(false)
  const [branchMenuOpen, setBranchMenuOpen] = useState(false)

  const selectedRepo = useMemo(
    () =>
      repoOptions.find((repo) => `${repo.installationId}:${repo.fullName}` === selectedRepoKey) ??
      null,
    [repoOptions, selectedRepoKey],
  )

  const currentStepIndex = STEP_ORDER.indexOf(activeStep)
  const previousStep = currentStepIndex > 0 ? STEP_ORDER[currentStepIndex - 1] : null
  const nextStep = currentStepIndex < STEP_ORDER.length - 1 ? STEP_ORDER[currentStepIndex + 1] : null
  const installHref = `/api/github/install/start?returnTo=${encodeURIComponent(`/apps/${connectedAppId}`)}`

  useEffect(() => {
    if (!githubInstallationId || !githubRepoFullName) return
    setSelectedRepoKey(`${githubInstallationId}:${githubRepoFullName}`)
    setBranchValue(watchedBranch ?? '')
  }, [githubInstallationId, githubRepoFullName, watchedBranch])

  useEffect(() => {
    setSelectedLocales(automationLocales.length > 0 ? automationLocales : ['en-US'])
  }, [automationLocales])

  useEffect(() => {
    if (!selectedRepo || branchOptions.length > 0 || branchLoading) return
    void loadBranches(
      selectedRepo.installationId,
      selectedRepo.fullName,
      watchedBranch ?? selectedRepo.defaultBranch,
    )
  }, [selectedRepo, branchOptions.length, branchLoading, watchedBranch])

  async function loadRepos() {
    if (repoLoading) return
    setRepoLoading(true)
    setError(null)

    try {
      const result = await listGithubReposServer()
      if (result.error) {
        setError(result.error)
        return
      }

      const repos = result.repos ?? []
      setRepoOptions(repos)

      const initialRepo =
        repos.find(
          (repo) =>
            githubInstallationId === repo.installationId &&
            githubRepoFullName === repo.fullName,
        ) ??
        repos[0] ??
        null

      if (initialRepo) {
        setSelectedRepoKey(`${initialRepo.installationId}:${initialRepo.fullName}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load repositories.')
    } finally {
      setRepoLoading(false)
    }
  }

  async function loadBranches(installationId: string, repoFullName: string, preferred?: string) {
    if (branchLoading) return
    setBranchLoading(true)
    setError(null)

    try {
      const result = await listGithubBranchesServer({ installationId, repoFullName })

      if (result.error) {
        setBranchOptions([])
        setError(result.error)
        return
      }

      const options = normalizeBranchOptions(result.branches as BranchOption[] | undefined)
      setBranchOptions(options)
      setBranchValue(preferred || result.defaultBranch || options[0] || '')
    } catch (err) {
      setBranchOptions([])
      setError(err instanceof Error ? err.message : 'Failed to load branches.')
    } finally {
      setBranchLoading(false)
    }
  }

  async function saveGithubSelection() {
    if (!selectedRepo) {
      setError('Select a repository to continue.')
      return
    }

    if (!branchValue.trim()) {
      setError('Select a branch to continue.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const result = await updateGithubBranchServer({
        connectedAppId,
        githubInstallationId: selectedRepo.installationId,
        githubRepoFullName: selectedRepo.fullName,
        githubRepoOwner: selectedRepo.owner,
        githubRepoName: selectedRepo.name,
        watchedBranch: branchValue.trim(),
      })

      if (!result.success || !result.githubInstallationId || !result.githubRepoFullName) {
        setError(result.error ?? 'Failed to save repository configuration.')
        return
      }

      onGithubSaved({
        githubInstallationId: result.githubInstallationId,
        githubRepoFullName: result.githubRepoFullName,
        watchedBranch: result.watchedBranch ?? branchValue.trim(),
      })

      onStepChange('localizations')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save repository configuration.')
    } finally {
      setSaving(false)
    }
  }

  async function saveLocales() {
    setSaving(true)
    setError(null)

    try {
      const result = await updateAutomationLocalesServer({
        connectedAppId,
        automationLocales: selectedLocales,
      })

      if (!result.success) {
        setError(result.error ?? 'Failed to save localization scope.')
        return
      }

      onLocalesSaved(result.automationLocales ?? selectedLocales)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save localization scope.')
    } finally {
      setSaving(false)
    }
  }

  function toggleLocale(localeCode: string) {
    setSelectedLocales((current) => {
      if (current.includes(localeCode)) {
        if (current.length === 1) return current
        return current.filter((locale) => locale !== localeCode)
      }

      return [...current, localeCode]
    })
  }

  if (!open) return null

  return (
    <aside className="animate-slide-in-right sticky top-6 self-start rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(13,15,27,0.98),rgba(9,11,20,0.98))] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
      <div className="flex items-start justify-between gap-3 border-b border-white/8 px-5 py-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/80">
            Automation Setup
          </p>
          <h3 className="mt-2 font-display text-2xl font-semibold text-foreground">
            {status.steps.find((step) => step.id === activeStep)?.title}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {status.steps.find((step) => step.id === activeStep)?.description}
          </p>
        </div>

        <Button type="button" variant="ghost" size="icon-sm" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="border-b border-white/8 px-5 py-4">
        <div className="flex flex-wrap gap-2">
          {status.steps.map((step) => (
            <button
              key={step.id}
              type="button"
              onClick={() => onStepChange(step.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                step.id === activeStep
                  ? 'border-primary/30 bg-primary/12 text-primary'
                  : step.complete
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                    : 'border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground'
              }`}
            >
              {step.title}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 py-5">
        <div key={activeStep} className="animate-fade-in-up">
          {status.isComplete && !isAutomationActivated ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-500/20 bg-[linear-gradient(180deg,rgba(11,46,38,0.58),rgba(10,24,22,0.48))] p-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`relative flex size-11 items-center justify-center rounded-2xl ${
                      isStartingAutomation
                        ? 'bg-[linear-gradient(180deg,rgba(93,116,255,0.28),rgba(32,200,255,0.18))] text-primary shadow-[0_0_30px_rgba(93,116,255,0.18)]'
                        : 'bg-emerald-500/15 text-emerald-300'
                    }`}
                  >
                    {isStartingAutomation ? (
                      <>
                        <span className="launch-glow absolute inset-0 rounded-2xl" />
                        <Rocket className="launch-rocket size-5" />
                        <span className="launch-flame absolute -bottom-3 left-1/2 h-5 w-3 -translate-x-1/2 rounded-full" />
                      </>
                    ) : (
                      <Bot className="size-5" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {isStartingAutomation ? 'Launching automation' : 'Ready to automate'}
                    </p>
                    <p className="mt-1 text-sm text-emerald-100/70">
                      {isStartingAutomation
                        ? "The launch sequence is running now. We'll stay here and stream progress until startup completes."
                        : "Setup is complete. Start automation from here and we'll only switch into the live automation dashboard once the startup flow succeeds."}
                    </p>
                  </div>
                </div>
              </div>

              <Button
                type="button"
                className="w-full rounded-xl"
                onClick={onBeginAutomation}
                disabled={isStartingAutomation}
              >
                {isStartingAutomation ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Igniting launch sequence...
                  </>
                ) : (
                  <>
                    <Play className="size-4" />
                    Begin automating
                  </>
                )}
              </Button>

              {startupLogs.length > 0 || startupError ? (
                <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Startup logs
                  </p>
                  <div className="mt-3 space-y-2 font-mono text-xs text-muted-foreground">
                    {startupLogs.map((log, index) => (
                      <div key={`${log}-${index}`} className="rounded-lg bg-white/[0.03] px-3 py-2">
                        {log}
                      </div>
                    ))}
                  </div>
                  {startupError ? <p className="mt-3 text-sm text-destructive">{startupError}</p> : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {!status.isComplete && activeStep === 'app' ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
                    <CheckCircle2 className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">App connection is complete</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      The dashboard is ready now. The remaining steps are only needed if you want
                      ReleasePilot to help with automation flows.
                    </p>
                  </div>
                </div>
              </div>

              <Button
                type="button"
                className="w-full justify-between rounded-xl"
                onClick={() => onStepChange(status.nextStepId ?? 'github_repo')}
              >
                Continue to next setup step
                <ChevronRight className="size-4" />
              </Button>
            </div>
          ) : null}

          {!status.isComplete && (activeStep === 'github_repo' || activeStep === 'github_branch') ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                    <Github className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Repository-aware automation</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Pick the GitHub repository and branch this app should watch for release and remediation work.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => void loadRepos()}>
                  {repoLoading ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Loading repositories...
                    </>
                  ) : (
                    <>
                      <Github className="size-3.5" />
                      Refresh repositories
                    </>
                  )}
                </Button>
                <Button asChild type="button" variant="outline" size="sm">
                  <a href={installHref}>
                    Install GitHub App
                    <ExternalLink className="size-3.5" />
                  </a>
                </Button>
              </div>

              <div className="space-y-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="space-y-2 text-sm">
                  <span className="block text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Repository
                  </span>
                  <DropdownMenu
                    open={repoMenuOpen}
                    onOpenChange={(nextOpen) => {
                      setRepoMenuOpen(nextOpen)
                      if (nextOpen) {
                        void loadRepos()
                      }
                    }}
                  >
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="flex h-12 w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 text-left text-sm text-foreground transition hover:border-primary/25 hover:bg-white/[0.07] focus-visible:border-primary/40 focus-visible:outline-none"
                        disabled={saving}
                      >
                        <span className="truncate">
                          {selectedRepo?.fullName ??
                            (repoLoading ? 'Loading repositories...' : 'Select repository')}
                        </span>
                        <ChevronDown className="size-4 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="w-[var(--radix-dropdown-menu-trigger-width)] rounded-xl border-white/10 bg-[linear-gradient(180deg,rgba(18,20,33,0.98),rgba(10,12,22,0.98))] p-2 text-foreground shadow-[0_24px_80px_rgba(0,0,0,0.4)]"
                    >
                      <DropdownMenuLabel className="px-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                        Repositories
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-white/8" />
                      {repoLoading ? (
                        <DropdownMenuItem className="gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground">
                          <Loader2 className="size-4 animate-spin" />
                          Loading repositories...
                        </DropdownMenuItem>
                      ) : repoOptions.length === 0 ? (
                        <DropdownMenuItem className="rounded-lg px-2 py-2 text-sm text-muted-foreground">
                          No repositories found
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuRadioGroup
                          value={selectedRepoKey}
                          onValueChange={(nextKey) => {
                            setSelectedRepoKey(nextKey)
                            setBranchOptions([])
                            setBranchValue('')
                            const repo = repoOptions.find(
                              (option) => `${option.installationId}:${option.fullName}` === nextKey,
                            )
                            if (repo) {
                              void loadBranches(
                                repo.installationId,
                                repo.fullName,
                                repo.defaultBranch,
                              )
                            }
                          }}
                        >
                          {repoOptions.map((repo) => (
                            <DropdownMenuRadioItem
                              key={`${repo.installationId}:${repo.fullName}`}
                              value={`${repo.installationId}:${repo.fullName}`}
                              className="rounded-lg px-8 py-2 text-sm"
                            >
                              {repo.fullName}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-2 text-sm">
                  <span className="block text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Branch
                  </span>
                  <DropdownMenu
                    open={branchMenuOpen}
                    onOpenChange={(nextOpen) => {
                      setBranchMenuOpen(nextOpen)
                      if (nextOpen && selectedRepo && branchOptions.length === 0) {
                        void loadBranches(
                          selectedRepo.installationId,
                          selectedRepo.fullName,
                          selectedRepo.defaultBranch,
                        )
                      }
                    }}
                  >
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="flex h-12 w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 text-left text-sm text-foreground transition hover:border-primary/25 hover:bg-white/[0.07] focus-visible:border-primary/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={!selectedRepo || saving}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <GitBranch className="size-4 shrink-0 text-muted-foreground" />
                          <span className="truncate">
                            {branchLoading ? 'Loading branches...' : branchValue || 'Select branch'}
                          </span>
                        </div>
                        <ChevronDown className="size-4 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="w-[var(--radix-dropdown-menu-trigger-width)] rounded-xl border-white/10 bg-[linear-gradient(180deg,rgba(18,20,33,0.98),rgba(10,12,22,0.98))] p-2 text-foreground shadow-[0_24px_80px_rgba(0,0,0,0.4)]"
                    >
                      <DropdownMenuLabel className="px-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                        Branches
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-white/8" />
                      {branchLoading ? (
                        <DropdownMenuItem className="gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground">
                          <Loader2 className="size-4 animate-spin" />
                          Loading branches...
                        </DropdownMenuItem>
                      ) : branchOptions.length === 0 ? (
                        <DropdownMenuItem className="rounded-lg px-2 py-2 text-sm text-muted-foreground">
                          {selectedRepo ? 'No branches found' : 'Choose a repository first'}
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuRadioGroup value={branchValue} onValueChange={(nextBranch) => setBranchValue(nextBranch)}>
                          {branchOptions.map((branch) => (
                            <DropdownMenuRadioItem key={branch} value={branch} className="rounded-lg px-8 py-2 text-sm">
                              {branch}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <Button
                type="button"
                className="w-full justify-between rounded-xl"
                onClick={() => void saveGithubSelection()}
                disabled={saving || repoLoading || branchLoading}
              >
                {saving ? (
                  <>
                    Saving repository...
                    <Loader2 className="size-4 animate-spin" />
                  </>
                ) : (
                  <>
                    Save repository and branch
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </div>
          ) : null}

          {!status.isComplete && activeStep === 'localizations' ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                    <Languages className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Localization scope</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Pick the locales automation should prioritize first. You can update this later.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {AUTOMATION_LOCALE_OPTIONS.map((locale) => {
                  const selected = selectedLocales.includes(locale.code)

                  return (
                    <label
                      key={locale.code}
                      className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition ${
                        selected
                          ? 'border-primary/30 bg-primary/12'
                          : 'border-white/8 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.05]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleLocale(locale.code)}
                        className="size-4"
                      />
                      <div>
                        <p className="text-sm font-medium text-foreground">{locale.label}</p>
                        <p className="text-xs font-mono text-muted-foreground">{locale.code}</p>
                      </div>
                    </label>
                  )
                })}
              </div>

              <Button
                type="button"
                className="w-full justify-between rounded-xl"
                onClick={() => void saveLocales()}
                disabled={saving}
              >
                {saving ? (
                  <>
                    Saving localization scope...
                    <Loader2 className="size-4 animate-spin" />
                  </>
                ) : (
                  <>
                    Save localization scope
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
            {error}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between border-t border-white/8 px-5 py-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => previousStep && onStepChange(previousStep)}
          disabled={!previousStep || saving}
        >
          <ArrowLeft className="size-4" />
          Previous
        </Button>

        {nextStep ? (
          <Button type="button" variant="outline" size="sm" onClick={() => onStepChange(nextStep)} disabled={saving}>
            Next
            <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button type="button" size="sm" onClick={onClose}>
            <Rocket className="size-4" />
            {status.isComplete && !isAutomationActivated ? 'Close panel' : 'Close setup'}
          </Button>
        )}
      </div>
    </aside>
  )
}
