import { Link, createFileRoute } from '@tanstack/react-router'
import {
  Check,
  CheckCheck,
  Circle,
  Clock3,
  ExternalLink,
  GitBranch,
  Lock,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  getAppSubmissions,
  getReleaseTimelineEvents,
  getVersionMetadata,
} from '@/lib/apps/server'
import {
  RELEASE_TIMELINE_EVENT_CONFIG,
  type TimelineStatus,
  type ReleaseTimelineEventType,
} from '@/lib/release-timeline-events'

type TimelineItem = {
  id: string
  title: string
  detail?: string
  time: string
  createdAt: Date
  status: TimelineStatus
  eventType: ReleaseTimelineEventType
}

type ActivityItem = {
  id: string
  text: string
  when: string
}

export const Route = createFileRoute(
  '/apps/$appId/submissions/_header/$versionId/',
)({
  component: VersionDetailPage,
  loader: async ({ params }) => {
    const connectedAppId = Number(params.appId)
    const versionId = params.versionId

    if (Number.isNaN(connectedAppId)) {
      return {
        connectedAppId: 0,
        versionId: '',
        version: null,
        submissions: [],
        appName: null,
        iconUrl: null,
        rejectionReason: null,
        localizations: [],
        error: 'Invalid app',
      }
    }

    const [subsResult, metaResult, timelineEvents] = await Promise.all([
      getAppSubmissions({ data: { connectedAppId } }),
      getVersionMetadata({ data: { connectedAppId, versionId } }),
      getReleaseTimelineEvents({ data: { connectedAppId, versionId } }),
    ])

    const submissions = subsResult.submissions
    const version = submissions.find((s) => s.id === versionId) ?? null
    const rejectionReason = subsResult.rejectionReasons?.[versionId] ?? null

    return {
      connectedAppId,
      versionId,
      version,
      submissions,
      appName: subsResult.appName ?? null,
      iconUrl: subsResult.iconUrl ?? null,
      githubRepoFullName: subsResult.githubRepoFullName ?? null,
      watchedBranch: subsResult.watchedBranch ?? null,
      githubInstallationId: subsResult.githubInstallationId ?? null,
      rejectionReason,
      localizations: metaResult.localizations,
      timelineEvents,
      error: subsResult.error ?? metaResult.error,
    }
  },
  wrapInSuspense: true,
})

function VersionDetailPage() {
  const {
    connectedAppId,
    versionId,
    version,
    submissions,
    appName,
    iconUrl,
    githubRepoFullName,
    watchedBranch,
    githubInstallationId,
    rejectionReason,
    localizations,
    timelineEvents,
    error,
  } = Route.useLoaderData()

  const attrs = version?.attributes
  const appVersionState = attrs?.appVersionState ?? 'UNKNOWN'
  const hasGithubRepo = !!githubRepoFullName && !!watchedBranch
  const isRejected =
    appVersionState === 'REJECTED' || appVersionState === 'METADATA_REJECTED'

  const timeline = buildTimeline({
    timelineEvents: timelineEvents ?? [],
  })

  const activity = buildActivity({ timeline })
  const nextAction = !hasGithubRepo
    ? 'GitHub repository setup required before automation can run'
    : isRejected
    ? 'Waiting for PR #42 to be merged into main'
    : appVersionState === 'READY_FOR_DISTRIBUTION'
      ? 'Release is approved and ready for rollout'
      : 'Monitoring App Store Connect review progress'

  const responseCode = extractItmsCode(rejectionReason)
  const rawResponse = rejectionReason
    ? formatRawResponse(rejectionReason, responseCode)
    : `{
  "status": "MONITORING",
  "detail": "No rejection payload found for this submission yet.",
  "next": "Polling App Store Connect for updated review signal"
}`

  return (
    <div className="h-full min-h-0 bg-background p-3 md:p-4">
      <div className="mx-auto h-full w-full max-w-[1320px]">
        <div className="release-shell animate-fade-in-up h-full overflow-hidden rounded-2xl border border-border/70">
          <div className="grid h-full gap-3 p-3 md:p-4 lg:grid-cols-[minmax(0,1.8fr)_330px]">
            {/* Left column */}
            <div className="min-h-0 space-y-3">
              {/* Current Release card */}
              <Card className="glass-card border-border/70 py-0">
                <CardContent className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
                      Current Release
                    </p>
                    <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/40 px-3 py-1 text-xs text-muted-foreground">
                      <Lock className="size-3" />
                      Public
                      <span className="opacity-40">|</span>
                      API
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <span className={statusPillClass(appVersionState)}>
                      {humanizeState(appVersionState)}
                    </span>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                      {isRejected ? (
                        <>
                          <X className="size-3.5 text-destructive" />
                          <span className="text-red-300">Needs Attention</span>
                        </>
                      ) : (
                        <>
                          <CheckCheck className="size-3.5 text-emerald-400" />
                          <span className="text-emerald-300">Active</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/50 bg-background/25 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-1">
                      Next Action
                    </p>
                    <p className="text-sm leading-relaxed text-foreground">
                      {nextAction}
                    </p>
                  </div>

                  <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock3 className="size-3" />
                    {isRejected ? '18 minutes ago' : '5 minutes ago'}
                    <span className="opacity-50 mx-0.5">—</span>
                    {isRejected
                      ? `Detected submission issue ${responseCode ?? 'ITMS-90683'}`
                      : 'Monitoring automated release workflow'}
                  </p>
                </CardContent>
              </Card>

              {/* Timeline card */}
              <Card className="glass-card border-border/70 py-0 min-h-0">
                <CardContent className="px-0 py-0">
                  <div className="border-b border-border/60 px-5 py-3">
                    <p className="text-sm font-semibold text-foreground">
                      Release Timeline
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {timeline.length} events recorded
                    </p>
                  </div>

                  <ol className="max-h-[44vh] overflow-auto px-5 py-3">
                    {timeline.map((item, index) => {
                      const isLast = index === timeline.length - 1
                      return (
                        <li key={item.id} className="relative flex gap-3">
                          {/* Vertical connector line + dot */}
                          <div className="relative flex flex-col items-center">
                            <span
                              className={`relative z-10 mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${timelineDotClass(item.status)}`}
                            >
                              {timelineIcon(item.status)}
                            </span>
                            {!isLast && (
                              <span
                                className="absolute top-5 left-1/2 -translate-x-1/2 w-px flex-1 self-stretch bg-border/50"
                                style={{
                                  bottom: 0,
                                  height: 'calc(100% - 20px)',
                                }}
                              />
                            )}
                          </div>

                          {/* Content */}
                          <div
                            className={`flex flex-1 justify-between gap-3 pb-4 min-w-0 ${isLast ? 'pb-1' : ''}`}
                          >
                            <div className="min-w-0 space-y-0.5">
                              <p
                                className={`text-sm font-medium leading-tight ${
                                  item.status === 'error'
                                    ? 'text-red-300'
                                    : 'text-foreground'
                                }`}
                              >
                                {item.title}
                              </p>
                              {item.detail && (
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                  {item.detail}
                                </p>
                              )}
                            </div>
                            <p className="shrink-0 pt-0.5 text-right text-xs tabular-nums text-muted-foreground">
                              {item.time}
                            </p>
                          </div>
                        </li>
                      )
                    })}
                  </ol>
                </CardContent>
              </Card>
            </div>

            {/* Right column */}
            <div className="min-h-0 space-y-3">
              {/* Automation card */}
              <Card className="glass-card border-border/70 py-0">
                <CardContent className="space-y-3 px-4 py-4">
                  <p className="text-sm font-semibold text-foreground">
                    Automation
                  </p>

                  <div className="rounded-lg border border-border/60 bg-background/30 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-foreground">
                        GitHub Repo
                      </p>
                      {hasGithubRepo ? (
                        <div className="flex items-center gap-1 text-xs text-emerald-300">
                          <span className="size-1.5 rounded-full bg-emerald-400 inline-block" />
                          Connected
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-xs text-amber-300">
                          <span className="size-1.5 rounded-full bg-amber-400 inline-block" />
                          Setup Required
                        </div>
                      )}
                    </div>
                    {hasGithubRepo ? (
                      <>
                        <a
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                          href={`https://github.com/${githubRepoFullName}`}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <GitBranch className="size-3.5 shrink-0" />
                          <span className="truncate">github.com/{githubRepoFullName}</span>
                          <ExternalLink className="size-3 shrink-0 ml-auto" />
                        </a>
                        <p className="text-[11px] text-muted-foreground">
                          Watching branch{' '}
                          <span className="font-medium text-foreground">{watchedBranch}</span>
                        </p>
                        <a
                          href={`/api/github/install/start?returnTo=${encodeURIComponent(`/apps/${connectedAppId}/submissions/${versionId}`)}`}
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full border-border/60 bg-background/30 text-xs text-foreground hover:bg-background/50"
                          >
                            Reconnect
                          </Button>
                        </a>
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground">
                          Select a repository and branch in Add App before running automation.
                        </p>
                        <Link to="/apps/add">
                          <Button size="sm" className="w-full">
                            Complete GitHub Setup
                          </Button>
                        </Link>
                      </>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-border/60 bg-background/30 text-foreground hover:bg-background/50"
                    disabled={!hasGithubRepo}
                  >
                    Retry Fix
                  </Button>

                  {isRejected ? (
                    <Link
                      to="/apps/$appId/submissions/$versionId/fix"
                      params={{ appId: String(connectedAppId), versionId }}
                    >
                      <Button size="sm" className="w-full">
                        Open AI Fix
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-border/60 bg-background/30 text-foreground hover:bg-background/50"
                      disabled={!hasGithubRepo}
                    >
                      Resubmit Manually
                    </Button>
                  )}

                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full bg-linear-to-r from-rose-700 to-red-600 text-white"
                    disabled={!hasGithubRepo}
                  >
                    Disable Automation
                  </Button>
                </CardContent>
              </Card>

              {/* Automation Activity card */}
              <Card className="glass-card border-border/70 py-0">
                <CardContent className="space-y-3 px-4 py-4">
                  <p className="text-sm font-semibold text-foreground">
                    Automation Activity
                  </p>

                  <ul className="space-y-2.5">
                    {activity.map((item) => (
                      <li key={item.id} className="flex items-start gap-2.5">
                        <span className="mt-1.5 flex size-1.5 shrink-0 rounded-full bg-emerald-400/90" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs leading-relaxed text-foreground">
                            {item.text}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {item.when}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Raw response card */}
              <Card className="glass-card border-border/70 py-0 min-h-0">
                <CardContent className="space-y-2 px-4 py-4">
                  <p className="text-sm font-semibold text-foreground">
                    Raw App Store Response
                  </p>
                  <pre className="max-h-[120px] overflow-auto rounded-lg border border-border/60 bg-black/30 p-3 text-xs leading-relaxed text-zinc-300 font-mono">
                    {rawResponse}
                  </pre>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {error && (
          <p className="mt-2 text-xs text-destructive">Data warning: {error}</p>
        )}
      </div>
    </div>
  )
}

function buildTimeline({
  timelineEvents,
}: {
  timelineEvents: Array<{
    id: number
    eventType: ReleaseTimelineEventType
    detail: string | null
    createdAt: Date | null
  }>
}): Array<TimelineItem> {
  return timelineEvents.map((event) => {
    const config = RELEASE_TIMELINE_EVENT_CONFIG[event.eventType]
    const eventTime = event.createdAt ? new Date(event.createdAt) : new Date()
    return {
      id: String(event.id),
      title: config.title,
      detail: event.detail ?? config.defaultDetail,
      time: formatClock(eventTime),
      createdAt: eventTime,
      status: config.status,
      eventType: event.eventType,
    }
  })
}

function buildActivity({
  timeline,
}: {
  timeline: Array<TimelineItem>
}): Array<ActivityItem> {
  return [...timeline]
    .slice(-4)
    .reverse()
    .map((item) => ({
      id: `activity-${item.id}`,
      text: RELEASE_TIMELINE_EVENT_CONFIG[item.eventType].activityText,
      when: formatRelativeTime(item.createdAt),
    }))
}

function timelineDotClass(status: TimelineStatus) {
  if (status === 'error') {
    return 'bg-red-500/85 text-white'
  }
  if (status === 'warn') {
    return 'bg-amber-400/80 text-amber-900'
  }
  return 'bg-emerald-400/85 text-emerald-950'
}

function timelineIcon(status: TimelineStatus) {
  if (status === 'error') {
    return <X className="size-3" />
  }
  if (status === 'warn') {
    return <Circle className="size-2.5" />
  }
  return <Check className="size-3" />
}

function formatClock(value: Date) {
  return value.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatRelativeTime(value: Date) {
  const diffMs = value.getTime() - Date.now()
  const diffMins = Math.round(diffMs / 60_000)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

  if (Math.abs(diffMins) < 60) {
    return rtf.format(diffMins, 'minute')
  }

  const diffHours = Math.round(diffMins / 60)
  if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, 'hour')
  }

  const diffDays = Math.round(diffHours / 24)
  return rtf.format(diffDays, 'day')
}

function humanizeState(state: string) {
  return state.replace(/_/g, ' ')
}

function statusPillClass(state: string) {
  if (state === 'REJECTED' || state === 'METADATA_REJECTED') {
    return 'rounded-md border border-red-500/30 bg-red-500/15 px-2.5 py-1 text-xs font-semibold tracking-wide text-red-300'
  }
  if (state === 'READY_FOR_SALE' || state === 'ACCEPTED') {
    return 'rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold tracking-wide text-emerald-300'
  }
  return 'rounded-md border border-border/70 bg-background/50 px-2.5 py-1 text-xs font-semibold tracking-wide text-foreground'
}

function extractItmsCode(text: string | null) {
  if (!text) {
    return null
  }

  const match = text.match(/ITMS-\d{5}/)
  return match?.[0] ?? null
}

function formatRawResponse(message: string, code: string | null) {
  return `{
  "code": "${code ?? 'UNKNOWN'}",
  "message": ${JSON.stringify(message)},
  "guideline": "5.1.1",
  "state": "REJECTED"
}`
}
