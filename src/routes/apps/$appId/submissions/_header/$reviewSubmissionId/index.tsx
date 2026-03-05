import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { Route as HeaderRoute } from '../route'
import { useState } from 'react'
import {
  Check,
  Circle,
  Clock,
  GitBranch,
  Github,
  Loader2,
  Pencil,
  RefreshCw,
  Send,
  Sparkles,
  X,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Save,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type {
  ReleaseTimelineEventType,
  TimelineStatus,
} from '@/lib/release-timeline-events'
import {
  getAppReviewSubmissions,
  getReleaseTimelineEvents,
  getVersionMetadata,
  applyVersionMetadata,
  submitReviewSubmissionServer,
  refreshReviewSubmissionState,
} from '@/lib/apps/server'
import { RELEASE_TIMELINE_EVENT_CONFIG } from '@/lib/release-timeline-events'
import {
  buildActivity,
  getOperatorActions,
  getStatusMessage,
  getStateTone,
  humanizeState,
  isActionableState,
  isUnresolvedState,
  isVersionMetadataEditable,
  isExpandableTimelineEvent,
  flattenAssociatedErrors,
  getTimelineFailureCopy,
  parseTimelineErrorPayload,
  resolveWorkingVersionId,
  type TimelineErrorPayload,
} from '@/lib/submission-dashboard'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { VersionLocalizationUpdate } from '@/lib/app-store-connect/localizations'

type TimelineEvent = {
  id: number
  eventType: ReleaseTimelineEventType
  detail: string | null
  payload: Record<string, {}> | null
  createdAt: Date
}

type TimelineItem = {
  id: string
  title: string
  detail?: string
  time: string
  createdAt: Date
  status: TimelineStatus
  eventType: ReleaseTimelineEventType
  payload?: Record<string, {}> | null
  expandable?: boolean
}

export const Route = createFileRoute(
  '/apps/$appId/submissions/_header/$reviewSubmissionId/',
)({
  component: ReleaseWorkspace,
  loader: async ({ params }) => {
    const connectedAppId = Number(params.appId)
    const reviewSubmissionId = params.reviewSubmissionId

    const empty: TimelineEvent[] = []

    if (Number.isNaN(connectedAppId)) {
      return {
        connectedAppId: 0,
        reviewSubmissionId: '',
        submission: null,
        rejectionReason: null,
        localizations: [],
        timelineEvents: empty,
        error: 'Invalid app',
      }
    }

    const subsResult = await getAppReviewSubmissions({
      data: { connectedAppId },
    })

    const submission =
      subsResult.submissions.find((s) => s.id === reviewSubmissionId) ?? null
    const rejectionReason = submission?.rejectionReason ?? null
    const resolvedVersionId = resolveWorkingVersionId({
      submissionVersionId: submission?.appStoreVersion?.id,
      submissionPlatform: submission?.platform,
      versionOptions: subsResult.versionOptions,
    })

    const [metaResult, rawTimeline] = await Promise.all([
      resolvedVersionId
        ? getVersionMetadata({
            data: { connectedAppId, versionId: resolvedVersionId },
          })
        : Promise.resolve({ localizations: [], error: undefined }),
      resolvedVersionId
        ? getReleaseTimelineEvents({
            data: { connectedAppId, versionId: resolvedVersionId },
          })
        : Promise.resolve(empty),
    ])

    const timelineEvents: TimelineEvent[] = Array.isArray(rawTimeline)
      ? rawTimeline.map((e) => ({
          id: e.id as number,
          eventType: e.eventType as ReleaseTimelineEventType,
          detail: (e.detail as string | null) ?? null,
          payload: (e.payload as Record<string, {}> | null) ?? null,
          createdAt: e.createdAt instanceof Date ? e.createdAt : new Date(e.createdAt as string),
        }))
      : empty

    return {
      connectedAppId,
      reviewSubmissionId,
      submission,
      rejectionReason,
      localizations: metaResult.localizations ?? [],
      timelineEvents,
      error: subsResult.error ?? metaResult.error,
    }
  },
  wrapInSuspense: true,
})

function ReleaseWorkspace() {
  const {
    connectedAppId,
    reviewSubmissionId,
    submission,
    rejectionReason,
    localizations,
    timelineEvents,
    error,
  } = Route.useLoaderData()

  const {
    githubRepoFullName,
    watchedBranch,
    githubInstallationId,
    versionOptions,
  } = HeaderRoute.useLoaderData()

  const router = useRouter()
  const reviewState = submission?.state ?? 'READY_FOR_REVIEW'
  const versionId = resolveWorkingVersionId({
    submissionVersionId: submission?.appStoreVersion?.id,
    submissionPlatform: submission?.platform,
    versionOptions,
  })
  const selectedVersion =
    versionOptions.find((option) => option.id === versionId) ?? null
  const versionString =
    submission?.appStoreVersion?.versionString ??
    selectedVersion?.versionString ??
    reviewSubmissionId
  const appVersionState =
    submission?.appStoreVersion?.appVersionState ??
    selectedVersion?.appVersionState ??
    ''

  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const timeline = buildTimeline({ timelineEvents: timelineEvents ?? [] })
  const activity = buildActivity({
    timeline: (timelineEvents ?? []).map((e: TimelineEvent) => ({
      id: String(e.id),
      eventType: e.eventType,
      createdAt: e.createdAt instanceof Date ? e.createdAt : new Date(e.createdAt as unknown as string),
    })),
  })
  const operatorActions = getOperatorActions(reviewState)
  const statusMessage = getStatusMessage(reviewState, rejectionReason)
  const stateTone = getStateTone(reviewState)

  const handleSubmit = async (isResubmission: boolean) => {
    setActionError(null)
    setActionLoading(isResubmission ? 'resubmit' : 'submit')
    try {
      const result = await submitReviewSubmissionServer({
        data: {
          connectedAppId,
          reviewSubmissionId,
          versionId: versionId ?? undefined,
          isResubmission,
        },
      })
      if (result.error) setActionError(result.error)
      await router.invalidate()
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Submission failed',
      )
    } finally {
      setActionLoading(null)
    }
  }

  const handleRefresh = async () => {
    setActionError(null)
    setActionLoading('refresh')
    try {
      const result = await refreshReviewSubmissionState({
        data: {
          connectedAppId,
          reviewSubmissionId,
          versionId: versionId ?? '',
          previousState: reviewState,
        },
      })
      if (result.error) setActionError(result.error)
      await router.invalidate()
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Refresh failed',
      )
    } finally {
      setActionLoading(null)
    }
  }

  const handleAction = (actionId: string) => {
    if (actionId === 'submit') handleSubmit(false)
    else if (actionId === 'resubmit') handleSubmit(true)
    else if (actionId === 'refresh') handleRefresh()
  }

  const toneColor =
    stateTone === 'ok'
      ? 'text-success'
      : stateTone === 'warn'
        ? 'text-warning'
        : stateTone === 'error'
          ? 'text-destructive'
          : 'text-foreground'

  const toneDotColor =
    stateTone === 'ok'
      ? 'bg-success'
      : stateTone === 'warn'
        ? 'bg-warning'
        : stateTone === 'error'
          ? 'bg-destructive'
          : 'bg-muted-foreground'

  const canEditMetadata =
    isVersionMetadataEditable(appVersionState) || isUnresolvedState(reviewState)

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Status Hero */}
      <div className="border-b border-border/50 px-5 py-5 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2.5">
              <span
                className={`inline-block size-2 rounded-full ${toneDotColor} ${stateTone === 'warn' ? 'animate-pulse-dot' : ''}`}
              />
              <h2
                className={`font-display text-xl font-bold tracking-tight ${toneColor}`}
              >
                {humanizeState(reviewState)}
              </h2>
            </div>

            <p className="max-w-lg text-[13px] leading-relaxed text-muted-foreground">
              {statusMessage}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="size-3" />
            <span className="font-mono">v{versionString}</span>
          </div>
        </div>
      </div>

      {/* Operator Action Bar */}
      <div className="action-bar flex flex-wrap items-center gap-2 px-5 py-2.5 md:px-6">
        {operatorActions.map((action) => {
          const isLoading = actionLoading === action.id
          const icon = getActionIcon(action.id, isLoading)

          return (
            <Button
              key={action.id}
              variant={action.variant}
              size="sm"
              className="gap-1.5 text-xs"
              disabled={actionLoading !== null}
              onClick={() => handleAction(action.id)}
            >
              {icon}
              {action.label}
            </Button>
          )
        })}

        {(isActionableState(reviewState) || isUnresolvedState(reviewState)) && (
          <Link
            to="/apps/$appId/submissions/$reviewSubmissionId/fix"
            params={{ appId: String(connectedAppId), reviewSubmissionId }}
            className="inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-transparent px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
          >
            <Sparkles className="size-3" />
            AI Assist
          </Link>
        )}

        {actionError && (
          <div className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-2.5 py-1 text-xs text-destructive">
            <AlertTriangle className="size-3" />
            {actionError}
          </div>
        )}
      </div>

      {/* Two-column body */}
      <div className="grid min-h-0 flex-1 gap-0 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Left: Timeline */}
        <div className="min-h-0 overflow-y-auto px-5 py-4 md:px-6">
          <div className="flex items-baseline justify-between gap-3 pb-3">
            <h3 className="font-display text-sm font-semibold text-foreground">
              Release Timeline
            </h3>
            <span className="font-mono text-[11px] text-muted-foreground">
              {timeline.length} event{timeline.length !== 1 ? 's' : ''}
            </span>
          </div>

          {timeline.length === 0 ? (
            <div className="rounded-lg border border-border/30 bg-muted/10 px-4 py-6 text-center">
              <p className="text-xs text-muted-foreground">
                No timeline events yet. Actions you take will appear here.
              </p>
            </div>
          ) : (
            <TimelineList timeline={timeline} />
          )}
        </div>

        {/* Right: Detail Panel */}
        <div className="console-panel min-h-0 overflow-y-auto">
          {(githubRepoFullName || watchedBranch || activity.length > 0) && (
            <>
              <div className="px-4 py-4">
                <h3 className="font-display mb-3 text-sm font-semibold text-foreground">
                  Context
                </h3>
                <div className="space-y-2">
                  {githubRepoFullName && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Github className="size-3.5 shrink-0" />
                      <a
                        href={`https://github.com/${githubRepoFullName}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate font-mono hover:text-foreground"
                      >
                        {githubRepoFullName}
                      </a>
                    </div>
                  )}
                  {watchedBranch && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <GitBranch className="size-3.5 shrink-0" />
                      <span className="truncate font-mono">{watchedBranch}</span>
                    </div>
                  )}
                  {githubInstallationId && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="size-3 shrink-0 text-success" />
                      <span>GitHub App installed</span>
                    </div>
                  )}
                </div>

                {activity.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Recent Activity
                    </p>
                    <ul className="space-y-1.5">
                      {activity.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-baseline justify-between gap-3 text-xs"
                        >
                          <span className="truncate text-foreground/80">
                            {item.text}
                          </span>
                          <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                            {item.when}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <Separator className="bg-border/30" />
            </>
          )}

          <RawResponseSection
            rejectionReason={rejectionReason}
            reviewState={reviewState}
          />

          <Separator className="bg-border/30" />

          {canEditMetadata && localizations.length > 0 && versionId && (
            <MetadataEditorSection
              localizations={localizations}
              connectedAppId={connectedAppId}
              versionId={versionId}
            />
          )}
        </div>
      </div>

      {error && (
        <div className="border-t border-border/30 px-5 py-2">
          <p className="text-xs text-destructive">Data warning: {error}</p>
        </div>
      )}
    </div>
  )
}

function TimelineList({ timeline }: { timeline: TimelineItem[] }) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () =>
      new Set(
        timeline
          .filter((item, index) => item.expandable && index === timeline.length - 1)
          .map((item) => item.id),
      ),
  )

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <ol className="space-y-0">
      {timeline.map((item, index) => {
        const isLast = index === timeline.length - 1
        const isExpanded = expandedIds.has(item.id)

        return (
          <li key={item.id} className="timeline-entry">
            <div className="relative flex flex-col items-center">
              <span
                className={`relative z-10 mt-1 flex size-[18px] shrink-0 items-center justify-center rounded-full ${timelineDotClass(item.status)}`}
              >
                {timelineIcon(item.status)}
              </span>
            </div>

            <div
              className={`min-w-0 flex-1 ${isLast ? 'pb-1' : 'pb-4'}`}
            >
              <div className="flex justify-between gap-4">
                <div className="min-w-0 py-0.5">
                  {item.expandable ? (
                    <button
                      type="button"
                      className="flex items-center gap-1.5 text-left"
                      onClick={() => toggleExpand(item.id)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="size-3 shrink-0 text-destructive/60" />
                      ) : (
                        <ChevronRight className="size-3 shrink-0 text-destructive/60" />
                      )}
                      <span className="text-sm leading-tight text-destructive">
                        {item.title}
                      </span>
                    </button>
                  ) : (
                    <p
                      className={`text-sm leading-tight ${
                        item.status === 'error'
                          ? 'text-destructive'
                          : 'text-foreground/90'
                      }`}
                    >
                      {item.title}
                    </p>
                  )}
                  {item.detail && (
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {item.detail}
                    </p>
                  )}
                </div>
                <span className="shrink-0 pt-1 font-mono text-[11px] tabular-nums text-muted-foreground">
                  {item.time}
                </span>
              </div>

              {item.expandable && isExpanded && item.payload && (
                <ExpandedErrorDetail
                  payload={item.payload as TimelineErrorPayload}
                />
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function ExpandedErrorDetail({ payload }: { payload: TimelineErrorPayload }) {
  const [showRaw, setShowRaw] = useState(false)
  const errors = payload.errors ?? []
  const associated = flattenAssociatedErrors(errors)

  if (errors.length === 0) return null

  return (
    <div className="timeline-error-expanded mt-2 animate-fade-in">
      {errors.map((err, i) => (
        <div
          key={err.id ?? i}
          className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5"
        >
          <div className="flex items-baseline gap-2">
            {err.status && (
              <span className="font-mono text-[11px] font-medium text-destructive">
                {err.status}
              </span>
            )}
            {err.code && (
              <span className="font-mono text-[11px] text-destructive/70">
                {err.code}
              </span>
            )}
          </div>
          {err.title && (
            <p className="mt-1 text-xs font-medium text-foreground/90">
              {err.title}
            </p>
          )}
          {err.detail && (
            <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
              {err.detail}
            </p>
          )}
        </div>
      ))}

      {associated.length > 0 && (
        <div className="mt-2 space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Related issues
          </p>
          {associated.map((ae, i) => (
            <div
              key={i}
              className="timeline-associated-error rounded-md border border-border/30 bg-muted/10 px-2.5 py-1.5"
            >
              <span className="font-mono text-[11px] text-destructive/70">
                {ae.code}
              </span>
              {ae.detail && (
                <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                  {ae.detail}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        onClick={() => setShowRaw(!showRaw)}
      >
        {showRaw ? (
          <ChevronDown className="size-2.5" />
        ) : (
          <ChevronRight className="size-2.5" />
        )}
        Raw JSON
      </button>
      {showRaw && (
        <pre className="mt-1 max-h-[200px] overflow-auto rounded-md border border-border/40 bg-background/40 p-2 font-mono text-[11px] leading-relaxed text-foreground/60">
          {JSON.stringify(payload, null, 2)}
        </pre>
      )}
    </div>
  )
}

function RawResponseSection({
  rejectionReason,
  reviewState,
}: {
  rejectionReason: string | null
  reviewState: string
}) {
  const [expanded, setExpanded] = useState(!!rejectionReason)
  const isUnresolved = isUnresolvedState(reviewState)

  const responseBody = rejectionReason
    ? formatRawResponse(rejectionReason, extractItmsCode(rejectionReason))
    : JSON.stringify(
        {
          state: reviewState,
          detail: 'No rejection payload for this submission.',
        },
        null,
        2,
      )

  return (
    <div className="px-4 py-4">
      <button
        type="button"
        className="flex w-full items-center gap-2 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="size-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3 text-muted-foreground" />
        )}
        <h3 className="font-display text-sm font-semibold text-foreground">
          App Store Response
        </h3>
        {isUnresolved && (
          <span className="state-badge state-badge-error ml-auto">
            Unresolved Issues
          </span>
        )}
      </button>

      {expanded && (
        <div className="mt-3 animate-fade-in">
          {rejectionReason && (
            <div className="mb-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5">
              <p className="text-xs font-medium text-destructive">
                Rejection Reason
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-foreground/80">
                {rejectionReason}
              </p>
            </div>
          )}

          <pre className="max-h-[200px] overflow-auto rounded-lg border border-border/40 bg-background/40 p-3 font-mono text-[11px] leading-relaxed text-foreground/60">
            {responseBody}
          </pre>
        </div>
      )}
    </div>
  )
}

function MetadataEditorSection({
  localizations,
  connectedAppId,
  versionId,
}: {
  localizations: Array<{
    id: string
    locale: string
    description?: string
    keywords?: string
    promotionalText?: string
    whatsNew?: string
  }>
  connectedAppId: number
  versionId: string
}) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [editedValues, setEditedValues] = useState<
    Record<string, VersionLocalizationUpdate>
  >({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const updateField = (
    localeId: string,
    field: keyof VersionLocalizationUpdate,
    value: string,
  ) => {
    setEditedValues((prev) => ({
      ...prev,
      [localeId]: { ...prev[localeId], [field]: value },
    }))
    setSaveSuccess(false)
  }

  const handleSave = async () => {
    setSaveError(null)
    setSaveSuccess(false)
    setSaving(true)

    try {
      for (const [localeId, updates] of Object.entries(editedValues)) {
        const filtered: VersionLocalizationUpdate = {}
        if (updates.description !== undefined)
          filtered.description = updates.description
        if (updates.keywords !== undefined) filtered.keywords = updates.keywords
        if (updates.promotionalText !== undefined)
          filtered.promotionalText = updates.promotionalText
        if (updates.whatsNew !== undefined) filtered.whatsNew = updates.whatsNew
        if (Object.keys(filtered).length === 0) continue

        const result = await applyVersionMetadata({
          data: { connectedAppId, versionId, localeId, updates: filtered },
        })
        if (result.error) {
          setSaveError(result.error)
          setSaving(false)
          return
        }
      }
      setSaveSuccess(true)
      setEditedValues({})
      await router.invalidate()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const hasChanges = Object.keys(editedValues).length > 0

  return (
    <div className="px-4 py-4">
      <button
        type="button"
        className="flex w-full items-center gap-2 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="size-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3 text-muted-foreground" />
        )}
        <Pencil className="size-3 text-muted-foreground" />
        <h3 className="font-display text-sm font-semibold text-foreground">
          Metadata
        </h3>
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">
          {localizations.length} locale{localizations.length !== 1 ? 's' : ''}
        </span>
      </button>

      {expanded && (
        <div className="mt-3 animate-fade-in space-y-4">
          {localizations.map((loc) => {
            const edits = editedValues[loc.id] ?? {}
            return (
              <LocaleEditor
                key={loc.id}
                locale={loc.locale}
                description={edits.description ?? loc.description ?? ''}
                keywords={edits.keywords ?? loc.keywords ?? ''}
                promotionalText={
                  edits.promotionalText ?? loc.promotionalText ?? ''
                }
                whatsNew={edits.whatsNew ?? loc.whatsNew ?? ''}
                onChange={(field, value) => updateField(loc.id, field, value)}
              />
            )
          })}

          {saveError && (
            <div className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
              <AlertTriangle className="size-3" />
              {saveError}
            </div>
          )}

          {saveSuccess && (
            <div className="flex items-center gap-1.5 rounded-md bg-success/10 px-2.5 py-1.5 text-xs text-success">
              <CheckCircle2 className="size-3" />
              Changes applied to App Store Connect.
            </div>
          )}

          <Button
            size="sm"
            className="gap-1.5 text-xs"
            disabled={!hasChanges || saving}
            onClick={handleSave}
          >
            {saving ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Save className="size-3" />
            )}
            Apply to App Store Connect
          </Button>
        </div>
      )}
    </div>
  )
}

function LocaleEditor({
  locale,
  description,
  keywords,
  promotionalText,
  whatsNew,
  onChange,
}: {
  locale: string
  description: string
  keywords: string
  promotionalText: string
  whatsNew: string
  onChange: (field: keyof VersionLocalizationUpdate, value: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-lg border border-border/30 bg-background/20">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
        onClick={() => setOpen(!open)}
      >
        {open ? (
          <ChevronDown className="size-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3 text-muted-foreground" />
        )}
        <span className="font-mono text-xs font-medium text-primary">
          {locale}
        </span>
      </button>

      {open && (
        <div className="space-y-3 px-3 pb-3 animate-fade-in">
          <MetadataField
            label="Description"
            value={description}
            onChange={(v) => onChange('description', v)}
            rows={3}
          />
          <MetadataField
            label="Keywords"
            value={keywords}
            onChange={(v) => onChange('keywords', v)}
            rows={2}
          />
          <MetadataField
            label="Promotional Text"
            value={promotionalText}
            onChange={(v) => onChange('promotionalText', v)}
            rows={2}
          />
          <MetadataField
            label="What's New"
            value={whatsNew}
            onChange={(v) => onChange('whatsNew', v)}
            rows={2}
          />
        </div>
      )}
    </div>
  )
}

function MetadataField({
  label,
  value,
  onChange,
  rows,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  rows: number
}) {
  return (
    <div className="metadata-field space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="border-border/40 bg-background/50 text-xs leading-relaxed text-foreground"
      />
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
    payload?: unknown
    createdAt: Date | null
  }>
}): TimelineItem[] {
  return timelineEvents.map((event) => {
    const config = RELEASE_TIMELINE_EVENT_CONFIG[event.eventType]
    const eventTime = event.createdAt ? new Date(event.createdAt) : new Date()
    const eventPayload = parseTimelineErrorPayload(event.payload)
    const failureCopy =
      event.eventType === 'asc_request_failed' && eventPayload
        ? getTimelineFailureCopy(eventPayload, event.detail)
        : null

    return {
      id: String(event.id),
      title: failureCopy?.title ?? config.title,
      detail: failureCopy?.detail ?? event.detail ?? config.defaultDetail,
      time: formatClock(eventTime),
      createdAt: eventTime,
      status: config.status,
      eventType: event.eventType,
      payload: eventPayload ?? null,
      expandable: isExpandableTimelineEvent(event.eventType, eventPayload),
    }
  })
}

function timelineDotClass(status: TimelineStatus) {
  if (status === 'error')
    return 'border border-destructive/30 bg-destructive/12 text-destructive'
  if (status === 'warn')
    return 'border border-warning/25 bg-warning/10 text-warning'
  return 'border border-primary/20 bg-primary/8 text-primary/80'
}

function timelineIcon(status: TimelineStatus) {
  if (status === 'error') return <X className="size-2.5" />
  if (status === 'warn') return <Circle className="size-2" />
  return <Check className="size-2.5" />
}

function formatClock(value: Date) {
  return value.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function getActionIcon(actionId: string, isLoading: boolean): ReactNode {
  if (isLoading) return <Loader2 className="size-3 animate-spin" />
  if (actionId === 'submit' || actionId === 'resubmit')
    return <Send className="size-3" />
  if (actionId === 'refresh') return <RefreshCw className="size-3" />
  return null
}

function extractItmsCode(text: string | null) {
  if (!text) return null
  const match = text.match(/ITMS-\d{5}/)
  return match?.[0] ?? null
}

function formatRawResponse(message: string, code: string | null) {
  return JSON.stringify(
    {
      code: code ?? 'UNKNOWN',
      message,
      state: 'UNRESOLVED_ISSUES',
    },
    null,
    2,
  )
}
