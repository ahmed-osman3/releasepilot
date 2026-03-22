export type TimelineStatus = 'ok' | 'warn' | 'error'

export const RELEASE_TIMELINE_EVENT_TYPES = {
  // Legacy automation events (kept for backward compat with stored rows)
  AUTOMATION_SETUP: 'automation_setup',
  INITIAL_SUBMISSION_ATTEMPT: 'initial_submission_attempt',
  VALIDATING_METADATA: 'validating_metadata',
  AGENT_METADATA_CHANGES: 'agent_metadata_changes',
  MAKING_SUBMISSION: 'making_submission',
  WAITING_FOR_FEEDBACK: 'waiting_for_feedback',
  SUBMISSION_FAILURE_RECEIVED: 'submission_failure_received',
  AGENT_FAILURE_FIX_APPLIED: 'agent_failure_fix_applied',
  WAITING_FOR_PR_APPROVAL: 'waiting_for_pr_approval',
  PR_APPROVED: 'pr_approved',
  NEW_BUILD_CREATED_FROM_WORKFLOW: 'new_build_created_from_workflow',

  // Manual release console events
  WORKING_VERSION_LOADED: 'working_version_loaded',
  SUBMISSION_REQUESTED: 'submission_requested',
  SUBMISSION_ACCEPTED: 'submission_accepted',
  STATE_REFRESHED: 'state_refreshed',
  REVIEW_FEEDBACK_RECEIVED: 'review_feedback_received',
  METADATA_FIX_APPLIED: 'metadata_fix_applied',
  RESUBMISSION_REQUESTED: 'resubmission_requested',
  ASC_REQUEST_FAILED: 'asc_request_failed',
} as const

export type ReleaseTimelineEventType =
  (typeof RELEASE_TIMELINE_EVENT_TYPES)[keyof typeof RELEASE_TIMELINE_EVENT_TYPES]

type EventConfig = {
  title: string
  status: TimelineStatus
  defaultDetail?: string
  activityText: string
}

export const RELEASE_TIMELINE_EVENT_CONFIG: Record<
  ReleaseTimelineEventType,
  EventConfig
> = {
  [RELEASE_TIMELINE_EVENT_TYPES.AUTOMATION_SETUP]: {
    title: 'Automation set up',
    status: 'ok',
    activityText: 'Connected automation for this app',
  },
  [RELEASE_TIMELINE_EVENT_TYPES.INITIAL_SUBMISSION_ATTEMPT]: {
    title: 'Initial submission attempt',
    status: 'warn',
    activityText: 'Started first submission attempt',
  },
  [RELEASE_TIMELINE_EVENT_TYPES.VALIDATING_METADATA]: {
    title: 'Validating metadata',
    status: 'warn',
    activityText: 'Validating metadata for required fields',
  },
  [RELEASE_TIMELINE_EVENT_TYPES.AGENT_METADATA_CHANGES]: {
    title: 'Agent updated metadata',
    status: 'ok',
    activityText: 'Applied metadata fixes',
  },
  [RELEASE_TIMELINE_EVENT_TYPES.MAKING_SUBMISSION]: {
    title: 'Making submission',
    status: 'warn',
    activityText: 'Submitting this version to App Store review',
  },
  [RELEASE_TIMELINE_EVENT_TYPES.WAITING_FOR_FEEDBACK]: {
    title: 'Waiting for feedback',
    status: 'warn',
    activityText: 'Waiting for App Store review feedback',
  },
  [RELEASE_TIMELINE_EVENT_TYPES.SUBMISSION_FAILURE_RECEIVED]: {
    title: 'Submission failure logged',
    status: 'error',
    activityText: 'Received submission failure from App Store',
  },
  [RELEASE_TIMELINE_EVENT_TYPES.AGENT_FAILURE_FIX_APPLIED]: {
    title: 'Agent applied failure fix',
    status: 'ok',
    activityText: 'Applied fix for binary or metadata failure',
  },
  [RELEASE_TIMELINE_EVENT_TYPES.WAITING_FOR_PR_APPROVAL]: {
    title: 'Waiting for PR approval',
    status: 'warn',
    activityText: 'Waiting on pull request approval',
  },
  [RELEASE_TIMELINE_EVENT_TYPES.PR_APPROVED]: {
    title: 'PR approved',
    status: 'ok',
    activityText: 'Pull request approved',
  },
  [RELEASE_TIMELINE_EVENT_TYPES.NEW_BUILD_CREATED_FROM_WORKFLOW]: {
    title: 'New build created from workflow',
    status: 'ok',
    activityText: 'Created a new build from release workflow',
  },

  [RELEASE_TIMELINE_EVENT_TYPES.WORKING_VERSION_LOADED]: {
    title: 'Working version loaded',
    status: 'ok',
    defaultDetail: 'Resolved the latest editable App Store version',
    activityText: 'Loaded active release version',
  },
  [RELEASE_TIMELINE_EVENT_TYPES.SUBMISSION_REQUESTED]: {
    title: 'Submission requested',
    status: 'warn',
    defaultDetail: 'Operator submitted this version for App Store review',
    activityText: 'Submitted version for review',
  },
  [RELEASE_TIMELINE_EVENT_TYPES.SUBMISSION_ACCEPTED]: {
    title: 'Submission accepted',
    status: 'ok',
    defaultDetail: 'App Store Connect accepted the submission',
    activityText: 'Submission accepted by App Store',
  },
  [RELEASE_TIMELINE_EVENT_TYPES.STATE_REFRESHED]: {
    title: 'State refreshed',
    status: 'ok',
    defaultDetail: 'Refreshed release state from App Store Connect',
    activityText: 'Refreshed App Store state',
  },
  [RELEASE_TIMELINE_EVENT_TYPES.REVIEW_FEEDBACK_RECEIVED]: {
    title: 'Review feedback received',
    status: 'error',
    defaultDetail: 'New review feedback or rejection detected',
    activityText: 'Received review feedback from Apple',
  },
  [RELEASE_TIMELINE_EVENT_TYPES.METADATA_FIX_APPLIED]: {
    title: 'Metadata fix applied',
    status: 'ok',
    defaultDetail: 'Operator applied metadata changes to App Store Connect',
    activityText: 'Applied metadata fix to App Store',
  },
  [RELEASE_TIMELINE_EVENT_TYPES.RESUBMISSION_REQUESTED]: {
    title: 'Resubmission requested',
    status: 'warn',
    defaultDetail: 'Operator resubmitted version after applying fixes',
    activityText: 'Resubmitted version for review',
  },
  [RELEASE_TIMELINE_EVENT_TYPES.ASC_REQUEST_FAILED]: {
    title: 'App Store request failed',
    status: 'error',
    defaultDetail: 'An App Store Connect API call returned an error',
    activityText: 'App Store Connect request failed',
  },
}
