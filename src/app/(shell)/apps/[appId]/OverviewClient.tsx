'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  ExternalLink,
  GitBranch,
  Github,
  Loader2,
  Upload,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ReleaseTimelineEventType } from '@/lib/release-timeline-events'
import { RELEASE_TIMELINE_EVENT_CONFIG } from '@/lib/release-timeline-events'
import {
  buildActivity,
  formatRelativeTime,
  getStateTone,
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
  appVersionState,
  timelineEvents,
  githubRepoFullName,
  watchedBranch,
  githubInstallationId,
  error,
}: {
  connectedAppId: number
  appName: string | null
  bundleId: string | null
  iconUrl: string | null
  reviewState: string | null
  rejectionReason: string | null
  versionString: string | null
  appVersionState: string | null
  timelineEvents: TimelineEvent[]
  githubRepoFullName: string | null
  watchedBranch: string | null
  githubInstallationId: string | null
  error?: string | null
}) {
  const stateTone = reviewState ? getStateTone(reviewState) : 'neutral'
  const statusMessage = reviewState
    ? getStatusMessage(reviewState, rejectionReason)
    : 'No active submission. Connect your app to get started.'

  const timeline = useMemo(
    () =>
      timelineEvents.map((event) => ({
        ...event,
        title:
          RELEASE_TIMELINE_EVENT_CONFIG[event.eventType]?.title ??
          event.eventType,
        status:
          RELEASE_TIMELINE_EVENT_CONFIG[event.eventType]?.status ?? 'warn',
        when: formatRelativeTime(new Date(event.createdAt)),
      })),
    [timelineEvents],
  )

  const activity = useMemo(
    () =>
      buildActivity({
        timeline: timelineEvents.map((e) => ({
          id: String(e.id),
          eventType: e.eventType,
          createdAt: new Date(e.createdAt),
        })),
      }),
    [timelineEvents],
  )

  const isAutomationActive = reviewState !== null

  return (
    <div className="space-y-6 p-6 lg:p-8">
      {/* App header */}
      <div className="flex items-center gap-4">
        {iconUrl ? (
          <img
            src={iconUrl}
            alt={appName ?? 'App icon'}
            className="size-14 rounded-xl object-cover shadow-sm"
          />
        ) : (
          <div className="flex size-14 items-center justify-center rounded-xl bg-muted text-lg font-bold text-muted-foreground">
            {appName?.charAt(0).toUpperCase() ?? 'A'}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {appName ?? 'Untitled app'}
          </h1>
          <p className="text-sm text-muted-foreground font-mono">
            {bundleId ?? `App #${connectedAppId}`}
          </p>
        </div>
      </div>

      {/* Main grid: left (wide) + right (narrow) */}
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        {/* Left column */}
        <div className="space-y-6">
          {/* Automation Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
                Automation Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                {versionString && (
                  <span className="text-xl font-bold tabular-nums">
                    v{versionString}
                  </span>
                )}
                {reviewState && (
                  <span
                    className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${STATE_BADGE_CLASSES[reviewState] ?? 'bg-muted text-muted-foreground border-border'}`}
                  >
                    {humanizeState(reviewState)}
                  </span>
                )}
                <span
                  className={`text-sm font-medium ${isAutomationActive ? 'text-emerald-500' : 'text-muted-foreground'}`}
                >
                  Automation:{' '}
                  {isAutomationActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="space-y-1.5">
                <p className="text-sm text-foreground">
                  <span className="font-medium">Next Action:</span>{' '}
                  {getNextAction(reviewState)}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="size-3" />
                  <span>
                    Last Check:{' '}
                    {timeline.length > 0
                      ? timeline[timeline.length - 1]!.when
                      : 'never'}
                  </span>
                </div>
              </div>

              <p className="text-[13px] leading-relaxed text-muted-foreground">
                {statusMessage}
              </p>
            </CardContent>
          </Card>

          {/* System Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Github className="size-4" />
                  <span className="font-medium">GitHub</span>
                  {githubInstallationId ? (
                    <span className="text-emerald-500 font-medium">
                      Connected
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      Not connected
                    </span>
                  )}
                </div>
                {githubRepoFullName && (
                  <>
                    <ChevronRight className="size-3.5 text-muted-foreground" />
                    <div className="flex items-center gap-2">
                      <GitBranch className="size-4" />
                      <span className="font-medium">Branch</span>
                      <span className="font-mono text-foreground">
                        {watchedBranch ?? 'main'}
                      </span>
                    </div>
                  </>
                )}
                {reviewState && (
                  <>
                    <ChevronRight className="size-3.5 text-muted-foreground" />
                    <div className="flex items-center gap-2">
                      {stateTone === 'ok' ? (
                        <CheckCircle2 className="size-4 text-emerald-500" />
                      ) : stateTone === 'warn' ? (
                        <AlertTriangle className="size-4 text-amber-500" />
                      ) : (
                        <Circle className="size-4 text-muted-foreground" />
                      )}
                      <span className="font-medium">CI:</span>
                      <span
                        className={
                          stateTone === 'ok'
                            ? 'text-emerald-500'
                            : stateTone === 'warn'
                              ? 'text-amber-500'
                              : 'text-muted-foreground'
                        }
                      >
                        {appVersionState === 'PREPARE_FOR_SUBMISSION'
                          ? 'Waiting for build'
                          : reviewState === 'WAITING_FOR_REVIEW'
                            ? 'Waiting for build'
                            : 'Ready'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Automation Timeline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
                Automation Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No timeline events yet. Actions will appear here as
                  automation runs.
                </p>
              ) : (
                <div className="space-y-1">
                  {timeline.map((item) => {
                    const iconConfig =
                      TIMELINE_ICON_MAP[item.status] ??
                      TIMELINE_ICON_MAP.warn!
                    const Icon = iconConfig.icon

                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 rounded-lg px-1 py-2"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Icon
                            className={`size-4 shrink-0 ${iconConfig.className}`}
                          />
                          <span
                            className={`text-sm truncate ${
                              item.status === 'warn'
                                ? 'text-amber-500 font-medium'
                                : 'text-foreground'
                            }`}
                          >
                            {item.title}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                          {item.when}
                        </span>
                      </div>
                    )
                  })}

                  {reviewState &&
                    (reviewState === 'WAITING_FOR_REVIEW' ||
                      reviewState === 'IN_REVIEW') && (
                      <div className="flex items-center gap-2 pt-2 pl-1 text-xs text-muted-foreground">
                        <Loader2 className="size-3 animate-spin" />
                        <span>
                          Monitoring release lifecycle while waiting for
                          Apple&apos;s decision.
                        </span>
                      </div>
                    )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Detected Issues */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
                Detected Issues
              </CardTitle>
              <Link
                href={`/apps/${connectedAppId}/detected-issues`}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                View all
                <ChevronRight className="size-3" />
              </Link>
            </CardHeader>
            <CardContent>
              {rejectionReason ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="size-4 mt-0.5 shrink-0 text-amber-500" />
                    <span className="text-sm font-medium text-foreground">
                      {rejectionReason.length > 80
                        ? `${rejectionReason.slice(0, 77)}...`
                        : rejectionReason}
                    </span>
                  </div>
                  <div className="space-y-1.5 pl-6">
                    <Link
                      href={`/apps/${connectedAppId}/detected-issues`}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      Fix generated
                    </Link>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Upload className="size-3" />
                      <span>
                        Build{' '}
                        {versionString
                          ? `v${versionString}`
                          : 'pending'}
                      </span>
                      <ExternalLink className="size-3" />
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-2">
                  No issues detected.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Automation Activity */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
                Automation Activity
              </CardTitle>
              <span className="text-xs text-primary flex items-center gap-1 cursor-default">
                View logs
                <ChevronRight className="size-3" />
              </span>
            </CardHeader>
            <CardContent>
              {isAutomationActive && (
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2.5 text-sm">
                    <Circle className="size-3 shrink-0 text-muted-foreground" />
                    <span>Checked App Store Connect</span>
                  </div>
                  {(reviewState === 'WAITING_FOR_REVIEW' ||
                    reviewState === 'IN_REVIEW') && (
                    <div className="flex items-center gap-2.5 text-sm text-emerald-500">
                      <Loader2 className="size-3 shrink-0 animate-spin" />
                      <span>Monitoring App Store Connect</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity log with timestamps */}
          {activity.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
                  Automation Activity
                </CardTitle>
                <span className="text-xs text-primary flex items-center gap-1 cursor-default">
                  View logs
                  <ChevronRight className="size-3" />
                </span>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {activity.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
                        <span className="truncate">{item.text}</span>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                        {item.when}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-xs text-destructive">Data warning: {error}</p>
        </div>
      )}
    </div>
  )
}
