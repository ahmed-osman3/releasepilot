'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { FaAppStore, FaGithub } from 'react-icons/fa'
import {
  BadgeCheck,
  EllipsisVertical,
  Pause,
  RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { AutomationChecklistCard } from '@/features/app-onboarding/AutomationChecklistCard'
import { AutomationSetupPanel } from '@/features/app-onboarding/AutomationSetupPanel'
import type {
  AutomationChecklistStepId,
  AutomationOnboardingStatus,
} from '@/features/app-onboarding/automation-status'
import { deriveAutomationOnboardingStatus } from '@/features/app-onboarding/automation-status'
import type { ReleaseTimelineEventType } from '@/lib/release-timeline-events'
import { RELEASE_TIMELINE_EVENT_CONFIG } from '@/lib/release-timeline-events'
import { formatRelativeTime, getStatusMessage, humanizeState } from '@/lib/submission-dashboard'
import {
  ActionRequiredCard,
  OverviewHeroCard,
  type DashboardTimelineItem,
  type DashboardViewModel,
} from './components'
import { Card } from './components/Card'

type TimelineEvent = {
  id: number
  eventType: ReleaseTimelineEventType
  detail: string | null
  createdAt: string | Date
}

function getStatusLabel(reviewState: string | null): string {
  if (!reviewState) return 'Automation monitoring'
  return humanizeState(reviewState)
}

function getActionTitle(reviewState: string | null): string {
  switch (reviewState) {
    case 'WAITING_FOR_REVIEW':
      return 'Waiting for App Store review'
    case 'IN_REVIEW':
      return 'Build currently in review'
    case 'READY_FOR_REVIEW':
      return 'Submission is ready for review'
    case 'UNRESOLVED_ISSUES':
      return 'Detected issues need attention'
    case 'COMPLETE':
      return 'Release completed successfully'
    default:
      return 'Pull Request #42 created'
  }
}

function buildTimelineItems(timelineEvents: TimelineEvent[]): DashboardTimelineItem[] {
  if (timelineEvents.length === 0) {
    return [
      {
        id: 1,
        eventType: 'automation_setup',
        title: 'App setup complete',
        detail: 'Connected app and automation baseline are ready for release monitoring.',
        when: 'just now',
        status: 'ok',
      },
      {
        id: 2,
        eventType: 'state_refreshed',
        title: 'Waiting for first live event',
        detail: 'Timeline entries will stream in as automation and App Store events are processed.',
        when: 'just now',
        status: 'warn',
      },
    ]
  }

  return timelineEvents.map((event) => {
    const config = RELEASE_TIMELINE_EVENT_CONFIG[event.eventType]
    return {
      id: event.id,
      eventType: event.eventType,
      title: config?.title ?? humanizeState(event.eventType),
      detail: event.detail ?? config?.defaultDetail ?? 'Update captured for this release step.',
      when: formatRelativeTime(new Date(event.createdAt)),
      status: (config?.status ?? 'warn') as DashboardTimelineItem['status'],
    }
  })
}

function buildDashboardModel(input: {
  connectedAppId: number
  appName: string | null
  bundleId: string | null
  iconUrl: string | null
  reviewState: string | null
  rejectionReason: string | null
  versionString: string | null
  timelineItems: DashboardTimelineItem[]
  githubRepoFullName: string | null
  watchedBranch: string | null
  githubInstallationId: string | null
  automationActivatedAt: string | Date | null
}): DashboardViewModel {
  const latestTimeline = input.timelineItems[0]
  const appName = input.appName ?? 'Untitled app'

  return {
    appName,
    appIdentifier: input.bundleId ?? `App #${input.connectedAppId}`,
    appInitial: appName.charAt(0).toUpperCase() || 'A',
    iconUrl: input.iconUrl,
    statusLabel: getStatusLabel(input.reviewState),
    versionLabel: `Version ${input.versionString ?? '1.0.0'}`,
    branchLabel: `Branch: ${input.watchedBranch ?? 'main'}`,
    lastUpdatedLabel: latestTimeline?.when ?? 'just now',
    actionTitle: getActionTitle(input.reviewState),
    actionDescription:
      getStatusMessage(input.reviewState ?? 'READY_FOR_REVIEW', input.rejectionReason) ||
      'A pull request has been created to update metadata and localization files.',
    githubRepoLabel: input.githubRepoFullName ?? 'GitHub not connected yet',
    prLabel: 'PR #42',
    prStatusLabel: input.githubInstallationId ? 'Open' : 'Placeholder',
    filesChangedLabel: '3 files changed',
    githubUpdatedLabel: latestTimeline?.when ?? 'just now',
    buildLabel: `Version ${input.versionString ?? '1.0.0'}`,
    buildStatusLabel: 'Build 45',
    buildUpdatedLabel: input.reviewState ? humanizeState(input.reviewState) : 'Processing',
    timelineItems: input.timelineItems,
    modeLabel: input.automationActivatedAt ? 'Assisted' : 'Setup pending',
    lastRunLabel: input.automationActivatedAt
      ? formatRelativeTime(new Date(input.automationActivatedAt))
      : 'Not started',
  }
}

export default function OverviewClient({
  connectedAppId,
  appName,
  bundleId,
  iconUrl,
  reviewState,
  rejectionReason,
  versionString,
  timelineEvents,
  githubRepoFullName,
  watchedBranch,
  githubInstallationId,
  automationLocales,
  automationActivatedAt,
  onboardingStatus,
  error,
}: {
  connectedAppId: number
  appName: string | null
  bundleId: string | null
  iconUrl: string | null
  reviewState: string | null
  rejectionReason: string | null
  versionString: string | null
  timelineEvents: TimelineEvent[]
  githubRepoFullName: string | null
  watchedBranch: string | null
  githubInstallationId: string | null
  automationLocales: string[]
  automationActivatedAt: string | Date | null
  onboardingStatus: AutomationOnboardingStatus
  error?: string | null
}) {
  const searchParams = useSearchParams()
  const [githubState, setGithubState] = useState({
    githubInstallationId: githubInstallationId ?? '',
    githubRepoFullName: githubRepoFullName ?? '',
    watchedBranch: watchedBranch ?? '',
  })
  const [savedLocales, setSavedLocales] = useState<string[]>(automationLocales ?? [])
  const [activatedAt, setActivatedAt] = useState<string | Date | null>(automationActivatedAt)
  const [isStartingAutomation, setIsStartingAutomation] = useState(false)
  const [startupError, setStartupError] = useState<string | null>(null)
  const [startupLogs, setStartupLogs] = useState<string[]>([])

  useEffect(() => {
    setGithubState({
      githubInstallationId: githubInstallationId ?? '',
      githubRepoFullName: githubRepoFullName ?? '',
      watchedBranch: watchedBranch ?? '',
    })
  }, [githubInstallationId, githubRepoFullName, watchedBranch])

  useEffect(() => {
    setSavedLocales(automationLocales ?? [])
  }, [automationLocales])

  useEffect(() => {
    setActivatedAt(automationActivatedAt)
  }, [automationActivatedAt])

  const derivedStatus = useMemo(
    () =>
      deriveAutomationOnboardingStatus({
        appStoreAppId: String(connectedAppId),
        githubInstallationId: githubState.githubInstallationId || null,
        githubRepoFullName: githubState.githubRepoFullName || null,
        watchedBranch: githubState.watchedBranch || null,
        automationLocales: savedLocales,
      }),
    [connectedAppId, githubState, savedLocales],
  )

  const initialStep = onboardingStatus.nextStepId ?? 'github_repo'
  const [activeStep, setActiveStep] = useState<AutomationChecklistStepId>(initialStep)
  const [panelOpen, setPanelOpen] = useState(
    onboardingStatus.shouldAutoOpen || searchParams.get('github') === 'installed',
  )

  useEffect(() => {
    if (derivedStatus.nextStepId) {
      setActiveStep(derivedStatus.nextStepId)
    }
  }, [derivedStatus.nextStepId])

  useEffect(() => {
    if (searchParams.get('github') === 'installed') {
      setPanelOpen(true)
      if (derivedStatus.nextStepId) {
        setActiveStep(derivedStatus.nextStepId)
      }
    }
  }, [derivedStatus.nextStepId, searchParams])

  async function beginAutomation() {
    setIsStartingAutomation(true)
    setStartupError(null)
    setStartupLogs([])

    try {
      const response = await fetch('/api/apps/automation/begin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectedAppId }),
      })

      if (!response.ok || !response.body) {
        const result = (await response.json().catch(() => ({}))) as { error?: string }
        setStartupError(result.error ?? 'Failed to begin automation.')
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue

          const event = JSON.parse(trimmed) as
            | { type: 'log'; message: string }
            | { type: 'success'; message: string; automationActivatedAt?: string | null }
            | { type: 'error'; message: string }

          if (event.type === 'log') {
            setStartupLogs((current) => [...current, event.message])
          }

          if (event.type === 'error') {
            setStartupLogs((current) => [...current, event.message])
            setStartupError(event.message)
          }

          if (event.type === 'success') {
            setStartupLogs((current) => [...current, event.message])
            setActivatedAt(event.automationActivatedAt ?? new Date().toISOString())
            setPanelOpen(false)
          }
        }
      }
    } catch (err) {
      setStartupError(err instanceof Error ? err.message : 'Failed to begin automation.')
    } finally {
      setIsStartingAutomation(false)
    }
  }

  const isAutomationActivated = Boolean(activatedAt)
  const shouldShowOnboarding = !isAutomationActivated
  const timelineItems = useMemo(() => buildTimelineItems(timelineEvents), [timelineEvents])

  const model = useMemo(
    () =>
      buildDashboardModel({
        connectedAppId,
        appName,
        bundleId,
        iconUrl,
        reviewState,
        rejectionReason,
        versionString,
        timelineItems,
        githubRepoFullName,
        watchedBranch,
        githubInstallationId,
        automationActivatedAt: activatedAt,
      }),
    [
      connectedAppId,
      appName,
      bundleId,
      iconUrl,
      reviewState,
      rejectionReason,
      versionString,
      timelineItems,
      githubRepoFullName,
      watchedBranch,
      githubInstallationId,
      activatedAt,
    ],
  )

  if (shouldShowOnboarding) {
    return (
      <div className="space-y-6 p-6 lg:p-8">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-6">
            <AutomationChecklistCard
              status={derivedStatus}
              isStartingAutomation={isStartingAutomation}
              isAutomationActivated={isAutomationActivated}
              onBeginAutomation={() => {
                setPanelOpen(true)
                setActiveStep('localizations')
                void beginAutomation()
              }}
              onOpenStep={(stepId) => {
                setActiveStep(stepId)
                setPanelOpen(true)
              }}
            />
          </div>

          <AutomationSetupPanel
            key={connectedAppId}
            open={panelOpen}
            activeStep={activeStep}
            status={derivedStatus}
            connectedAppId={connectedAppId}
            githubInstallationId={githubState.githubInstallationId || null}
            githubRepoFullName={githubState.githubRepoFullName || null}
            watchedBranch={githubState.watchedBranch || null}
            automationLocales={savedLocales}
            isStartingAutomation={isStartingAutomation}
            startupLogs={startupLogs}
            startupError={startupError}
            isAutomationActivated={isAutomationActivated}
            onBeginAutomation={() => void beginAutomation()}
            onClose={() => setPanelOpen(false)}
            onStepChange={setActiveStep}
            onGithubSaved={(payload) => {
              setGithubState(payload)
            }}
            onLocalesSaved={(locales) => {
              setSavedLocales(locales)
              setActiveStep('localizations')
              setPanelOpen(true)
            }}
          />
        </div>

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
            <p className="text-xs text-destructive">Data warning: {error}</p>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="relative isolate h-[calc(100vh-3rem)] overflow-hidden px-5 py-4 lg:px-6 lg:py-5">
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(90%_120%_at_50%_0%,rgba(88,102,255,0.2),transparent_60%),radial-gradient(65%_100%_at_100%_20%,rgba(52,77,166,0.18),transparent_72%)]"
        aria-hidden="true"
      />

      <div className="flex h-full min-h-0 flex-col gap-4">
        <OverviewHeroCard model={model} />

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-h-0 flex-col gap-4">
            <ActionRequiredCard model={model} />
          </div>

          <aside className="flex min-h-0 flex-col gap-4">
            <div className="flex-1 rounded-2xl border border-white/10 p-4 shadow-sm">
              <div className="flex h-full flex-col gap-3">
                <Card>
                  <div className="flex flex-row items-center justify-between p-2">
                    <h2 className="text-md font-semibold leading-tight text-foreground">Github</h2>
                    <FaGithub className="size-5 text-foreground" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="rounded-xl border border-white/10 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold leading-tight text-foreground">
                            {model.prLabel}
                          </p>
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/15 px-1 py-1 text-xs font-medium uppercase tracking-[0.04em] text-amber-200">
                            <BadgeCheck className="size-1" />
                            {model.prStatusLabel}
                          </span>
                        </div>
                        <EllipsisVertical className="size-4 text-foreground" />
                      </div>
                      <div className="flex flex-col gap-2 py-2">
                        <span className="text-sm font-medium">{model.filesChangedLabel}</span>
                        <span className="text-sm font-medium">
                          Updated: {model.githubUpdatedLabel}
                        </span>
                        <Button>View Pull Request</Button>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card>
                  <div className="flex flex-row items-center justify-between p-2">
                    <h2 className="text-md font-semibold leading-tight text-foreground">Build</h2>
                    <FaAppStore className="size-5 text-foreground" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="rounded-xl border border-white/10 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold leading-tight text-foreground">
                            {model.buildStatusLabel}
                          </p>
                          <span className="inline-flex items-center gap-1 rounded-full border bg-[#132430] px-1 py-1 text-xs font-medium uppercase tracking-[0.04em] text-[#61b3c9]">
                            <BadgeCheck className="size-1" />
                            {model.versionLabel}
                          </span>
                        </div>
                        <EllipsisVertical className="size-4 text-foreground" />
                      </div>
                      <div className="flex flex-col gap-2 py-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Spinner className="size-4" />
                          <span>{model.buildUpdatedLabel}</span>
                        </div>
                        <Button variant="secondary" className="border">
                          View in TestFlight
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>

                <div className="border-t border-white/10 pt-3">
                  <div className="px-2 pb-2">
                    <h3 className="text-md font-semibold leading-tight text-foreground">
                      Controls
                    </h3>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="secondary"
                      className="h-11 justify-start rounded-xl border border-white/10 px-4"
                    >
                      <RotateCcw className="size-4" />
                      Run again
                      <span className="mx-2 h-4 w-px bg-white/10" />
                      <Pause className="size-4" />
                      Pause automation
                    </Button>
                    <Button
                      variant="secondary"
                      className="h-11 justify-start rounded-xl border border-white/10 px-4"
                    >
                      <RotateCcw className="size-4" />
                      Retry failed step
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>

        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3">
            <p className="text-sm text-destructive">Data warning: {error}</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
