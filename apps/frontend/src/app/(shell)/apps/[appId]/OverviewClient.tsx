'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  Loader2,
  Upload,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AutomationChecklistCard } from '@/features/app-onboarding/AutomationChecklistCard'
import { AutomationSetupPanel } from '@/features/app-onboarding/AutomationSetupPanel'
import type {
  AutomationChecklistStepId,
  AutomationOnboardingStatus,
} from '@/features/app-onboarding/automation-status'
import { deriveAutomationOnboardingStatus } from '@/features/app-onboarding/automation-status'
import type { ReleaseTimelineEventType } from '@/lib/release-timeline-events'
import { RELEASE_TIMELINE_EVENT_CONFIG } from '@/lib/release-timeline-events'
import {
  buildActivity,
  formatRelativeTime,
  getStatusMessage,
  humanizeState,
} from '@/lib/submission-dashboard'

type TimelineEvent = {
  id: number
  eventType: ReleaseTimelineEventType
  detail: string | null
  createdAt: string | Date
}

const STATE_BADGE_CLASSES: Record<string, string> = {
  WAITING_FOR_REVIEW:
    'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25',
  IN_REVIEW:
    'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/25',
  COMPLETE:
    'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/25',
  COMPLETING:
    'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/25',
  READY_FOR_REVIEW:
    'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/25',
  UNRESOLVED_ISSUES:
    'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25',
}

const TIMELINE_ICON_MAP: Record<string, { icon: typeof CheckCircle2; className: string }> = {
  ok: { icon: CheckCircle2, className: 'text-emerald-500' },
  warn: { icon: Circle, className: 'text-amber-500' },
  error: { icon: AlertTriangle, className: 'text-red-500' },
}

function getNextAction(reviewState: string | null): string {
  switch (reviewState) {
    case 'WAITING_FOR_REVIEW':
      return 'Waiting for Apple to review build'
    case 'IN_REVIEW':
      return 'Apple is reviewing your build'
    case 'READY_FOR_REVIEW':
      return 'Submit build for App Store review'
    case 'UNRESOLVED_ISSUES':
      return 'Resolve detected issues and resubmit'
    case 'COMPLETE':
      return 'Release is complete'
    case 'COMPLETING':
      return 'Release is being finalized'
    default:
      return 'Monitoring release lifecycle'
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
  const statusMessage = reviewState
    ? getStatusMessage(reviewState, rejectionReason)
    : 'No active submission yet. Your app is connected and ready to manage.'

  const timeline = useMemo(
    () =>
      timelineEvents.map((event) => ({
        ...event,
        title:
          RELEASE_TIMELINE_EVENT_CONFIG[event.eventType]?.title ?? event.eventType,
        status:
          RELEASE_TIMELINE_EVENT_CONFIG[event.eventType]?.status ?? 'warn',
        when: formatRelativeTime(new Date(event.createdAt)),
      })),
    [timelineEvents],
  )

  const activity = useMemo(
    () =>
      buildActivity({
        timeline: timelineEvents.map((event) => ({
          id: String(event.id),
          eventType: event.eventType,
          createdAt: new Date(event.createdAt),
        })),
      }),
    [timelineEvents],
  )

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

  const isAutomationActive = reviewState !== null
  const isAutomationActivated = Boolean(activatedAt)
  const shouldShowOnboarding = !isAutomationActivated

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

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="flex items-center gap-4">
        {iconUrl ? (
          <img
            src={iconUrl}
            alt={appName ?? 'App icon'}
            className="size-14 rounded-2xl object-cover shadow-sm"
          />
        ) : (
          <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-lg font-bold text-muted-foreground">
            {appName?.charAt(0).toUpperCase() ?? 'A'}
          </div>
        )}
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {appName ?? 'Untitled app'}
          </h1>
          <p className="font-mono text-sm text-muted-foreground">
            {bundleId ?? `App #${connectedAppId}`}
          </p>
        </div>
      </div>

      <div
        className={`grid gap-6 ${shouldShowOnboarding ? 'xl:grid-cols-[minmax(0,1fr)_420px]' : ''
          }`}
      >
        <div className="space-y-6">
          {shouldShowOnboarding ? (
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
          ) : null}

          {!shouldShowOnboarding ? (
            <>
              <Card className="border-white/8 bg-card/80">
                <CardHeader className="pb-3">
                  <CardTitle className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
                    Automation Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    {versionString && (
                      <span className="text-xl font-bold tabular-nums">v{versionString}</span>
                    )}
                    {reviewState && (
                      <span
                        className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${STATE_BADGE_CLASSES[reviewState] ?? 'bg-muted text-muted-foreground border-border'}`}
                      >
                        {humanizeState(reviewState)}
                      </span>
                    )}
                    <span
                      className={`text-sm font-medium ${isAutomationActive ? 'text-emerald-500' : 'text-muted-foreground'
                        }`}
                    >
                      Automation: {isAutomationActive ? 'Active' : 'Waiting for setup'}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-sm text-foreground">
                      <span className="font-medium">Next Action:</span> {getNextAction(reviewState)}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="size-3" />
                      <span>
                        Last Check:{' '}
                        {timeline.length > 0 ? timeline[timeline.length - 1]!.when : 'never'}
                      </span>
                    </div>
                  </div>

                  <p className="text-[13px] leading-relaxed text-muted-foreground">
                    {statusMessage}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-white/8 bg-card/80">
                <CardHeader className="pb-3">
                  <CardTitle className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
                    Automation Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {timeline.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      No timeline events yet. Automation activity will appear here after setup begins.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {timeline.map((item) => {
                        const iconConfig = TIMELINE_ICON_MAP[item.status] ?? TIMELINE_ICON_MAP.warn!
                        const Icon = iconConfig.icon

                        return (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-3 rounded-lg px-1 py-2"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <Icon className={`size-4 shrink-0 ${iconConfig.className}`} />
                              <span
                                className={`truncate text-sm ${item.status === 'warn'
                                    ? 'font-medium text-amber-500'
                                    : 'text-foreground'
                                  }`}
                              >
                                {item.title}
                              </span>
                            </div>
                            <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                              {item.when}
                            </span>
                          </div>
                        )
                      })}

                      {reviewState &&
                        (reviewState === 'WAITING_FOR_REVIEW' || reviewState === 'IN_REVIEW') ? (
                        <div className="flex items-center gap-2 pt-2 pl-1 text-xs text-muted-foreground">
                          <Loader2 className="size-3 animate-spin" />
                          <span>Monitoring release lifecycle while waiting for Apple&apos;s decision.</span>
                        </div>
                      ) : null}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="border-white/8 bg-card/80">
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
                      Detected Issues
                    </CardTitle>
                    <Link
                      href={`/apps/${connectedAppId}/detected-issues`}
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      View all
                      <ChevronRight className="size-3" />
                    </Link>
                  </CardHeader>
                  <CardContent>
                    {rejectionReason ? (
                      <div className="space-y-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                          <span className="text-sm font-medium text-foreground">
                            {rejectionReason.length > 80
                              ? `${rejectionReason.slice(0, 77)}...`
                              : rejectionReason}
                          </span>
                        </div>
                        <div className="space-y-1.5 pl-6">
                          <Link
                            href={`/apps/${connectedAppId}/detected-issues`}
                            className="text-xs text-primary hover:underline"
                          >
                            Fix generated
                          </Link>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Upload className="size-3" />
                            <span>Build {versionString ? `v${versionString}` : 'pending'}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="py-2 text-sm text-muted-foreground">No issues detected.</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-white/8 bg-card/80">
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
                      Automation Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {activity.length > 0 ? (
                      <div className="space-y-2">
                        {activity.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-3 text-sm"
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
                              <span className="truncate">{item.text}</span>
                            </div>
                            <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                              {item.when}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No automation activity yet. Finish setup to start repository-aware workflows.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </div>

        {shouldShowOnboarding ? (
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
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-xs text-destructive">Data warning: {error}</p>
        </div>
      ) : null}
    </div>
  )
}
