import type { NormalizedAscError } from '@/lib/app-store-connect/fetch'
import { RELEASE_TIMELINE_EVENT_CONFIG } from '@/lib/release-timeline-events'

export type TimelineErrorPayload = {
  errors?: NormalizedAscError[]
}

export type WorkspaceVersionOption = {
  id: string
  platform?: string
  appVersionState?: string
  eligibleForInitialSubmission?: boolean
}

export type FlattenedError = {
  code: string
  detail: string
  parentCode?: string
}

export type TimelineFailureCopy = {
  title: string
  detail: string
}

export type OperatorAction = {
  id: string
  label: string
  variant: 'default' | 'outline' | 'destructive' | 'ghost'
  disabled?: boolean
}

const ACTIONABLE_STATES = new Set(['READY_FOR_REVIEW', 'UNRESOLVED_ISSUES'])

const REVIEW_STATES = new Set(['WAITING_FOR_REVIEW', 'IN_REVIEW'])

const DONE_STATES = new Set(['COMPLETE', 'COMPLETING'])

const CANCELING_STATES = new Set(['CANCELING'])

export function isActionableState(state: string) {
  return ACTIONABLE_STATES.has(state)
}

export function isReviewState(state: string) {
  return REVIEW_STATES.has(state)
}

export function isDoneState(state: string) {
  return DONE_STATES.has(state)
}

export function isUnresolvedState(state: string) {
  return state === 'UNRESOLVED_ISSUES'
}

/** Whether the related version's metadata can be edited (uses app version state) */
export function isVersionMetadataEditable(appVersionState: string) {
  return (
    appVersionState === 'PREPARE_FOR_SUBMISSION' ||
    appVersionState === 'DEVELOPER_REJECTED' ||
    appVersionState === 'REJECTED' ||
    appVersionState === 'METADATA_REJECTED'
  )
}

export function getOperatorActions(reviewState: string): OperatorAction[] {
  if (reviewState === 'READY_FOR_REVIEW') {
    return [
      { id: 'submit', label: 'Submit for Review', variant: 'default' },
      { id: 'refresh', label: 'Refresh State', variant: 'ghost' },
    ]
  }

  if (reviewState === 'UNRESOLVED_ISSUES') {
    return [
      { id: 'resubmit', label: 'Resubmit for Review', variant: 'default' },
      { id: 'refresh', label: 'Refresh State', variant: 'ghost' },
    ]
  }

  if (REVIEW_STATES.has(reviewState)) {
    return [
      { id: 'refresh', label: 'Refresh State', variant: 'default' },
    ]
  }

  if (DONE_STATES.has(reviewState)) {
    return [
      { id: 'refresh', label: 'Refresh State', variant: 'ghost' },
    ]
  }

  return [
    { id: 'refresh', label: 'Refresh State', variant: 'outline' },
  ]
}

export function getStatusMessage(
  reviewState: string,
  rejectionReason: string | null,
): string {
  if (reviewState === 'UNRESOLVED_ISSUES') {
    return rejectionReason
      ? 'Apple returned review feedback. Inspect the rejection details below, apply metadata fixes, and resubmit.'
      : 'This submission has unresolved issues. Check the details and resubmit.'
  }

  switch (reviewState) {
    case 'READY_FOR_REVIEW':
      return 'This review submission is ready to be submitted for App Store review.'
    case 'WAITING_FOR_REVIEW':
      return 'Submitted and waiting in the review queue. Use Refresh to check for updates.'
    case 'IN_REVIEW':
      return 'Apple is actively reviewing this submission. Refresh to check the outcome.'
    case 'COMPLETING':
      return 'The review is completing. The submission will be finalized shortly.'
    case 'COMPLETE':
      return 'This review submission has been completed successfully.'
    case 'CANCELING':
      return 'This review submission is being canceled.'
    default:
      return 'Current state loaded from App Store Connect.'
  }
}

export function getStateTone(
  state: string,
): 'ok' | 'warn' | 'error' | 'neutral' {
  if (isUnresolvedState(state)) return 'error'
  if (isDoneState(state)) return 'ok'
  if (isReviewState(state)) return 'warn'
  if (CANCELING_STATES.has(state)) return 'warn'
  if (state === 'READY_FOR_REVIEW') return 'neutral'
  return 'neutral'
}

export function humanizeState(state: string) {
  return state.replace(/_/g, ' ')
}

export function formatRelativeTime(value: Date) {
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

export function buildActivity({
  timeline,
}: {
  timeline: Array<{
    id: string
    eventType: keyof typeof RELEASE_TIMELINE_EVENT_CONFIG
    createdAt: Date
  }>
}) {
  return [...timeline]
    .slice(-6)
    .reverse()
    .map((item) => ({
      id: `activity-${item.id}`,
      text: RELEASE_TIMELINE_EVENT_CONFIG[item.eventType].activityText,
      when: formatRelativeTime(item.createdAt),
    }))
}

export function isExpandableTimelineEvent(
  eventType: string,
  payload: unknown,
): boolean {
  return eventType === 'asc_request_failed' && payload != null
}

export function getErrorPreview(payload: TimelineErrorPayload): string {
  const first = payload.errors?.[0]
  if (!first) return 'Unknown error'
  const text = first.title ?? first.detail ?? 'App Store Connect error'
  return text.length > 120 ? `${text.slice(0, 117)}...` : text
}

export function flattenAssociatedErrors(
  errors: NormalizedAscError[],
): FlattenedError[] {
  const result: FlattenedError[] = []
  for (const err of errors) {
    if (!err.associatedErrors?.length) continue
    for (const ae of err.associatedErrors) {
      result.push({
        code: ae.code ?? 'UNKNOWN',
        detail: ae.detail ?? '',
        parentCode: err.code,
      })
    }
  }
  return result
}

export function parseTimelineErrorPayload(
  payload: unknown,
): TimelineErrorPayload | null {
  if (typeof payload === 'string') {
    try {
      return parseTimelineErrorPayload(JSON.parse(payload))
    } catch {
      return null
    }
  }

  if (!payload || typeof payload !== 'object') {
    return null
  }

  const candidate = payload as TimelineErrorPayload
  return Array.isArray(candidate.errors) ? candidate : null
}

export function getTimelineFailureCopy(
  payload: TimelineErrorPayload,
  fallbackDetail?: string | null,
): TimelineFailureCopy {
  const first = payload.errors?.[0]
  const relatedIssueCount = flattenAssociatedErrors(payload.errors ?? []).length

  const title =
    first?.title ?? 'App Store Connect blocked this submission'

  const baseDetail =
    first?.detail ?? fallbackDetail ?? getErrorPreview(payload)

  const detail =
    relatedIssueCount > 0
      ? `${baseDetail} Expand to view ${relatedIssueCount} related issue${
          relatedIssueCount === 1 ? '' : 's'
        }.`
      : baseDetail

  return { title, detail }
}

export function resolveWorkingVersionId({
  submissionVersionId,
  submissionPlatform,
  versionOptions,
}: {
  submissionVersionId?: string | null
  submissionPlatform?: string | null
  versionOptions: WorkspaceVersionOption[]
}): string | null {
  if (submissionVersionId) return submissionVersionId
  if (versionOptions.length === 0) return null
  if (versionOptions.length === 1) return versionOptions[0]?.id ?? null

  const eligibleForSubmission = versionOptions.find(
    (option) => option.eligibleForInitialSubmission,
  )
  if (eligibleForSubmission) return eligibleForSubmission.id

  if (submissionPlatform) {
    const matchingPlatform = versionOptions.find(
      (option) => option.platform === submissionPlatform,
    )
    if (matchingPlatform) return matchingPlatform.id
  }

  return versionOptions[0]?.id ?? null
}
