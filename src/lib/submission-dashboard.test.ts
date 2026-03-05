import { describe, expect, it } from 'vitest'
import {
  getOperatorActions,
  getStatusMessage,
  getStateTone,
  humanizeState,
  isActionableState,
  isUnresolvedState,
  isDoneState,
  isVersionMetadataEditable,
  isExpandableTimelineEvent,
  getErrorPreview,
  flattenAssociatedErrors,
  buildActivity,
  parseTimelineErrorPayload,
  resolveWorkingVersionId,
  getTimelineFailureCopy,
} from '@/lib/submission-dashboard'

describe('getOperatorActions', () => {
  it('returns submit + refresh for READY_FOR_REVIEW', () => {
    const actions = getOperatorActions('READY_FOR_REVIEW')
    const ids = actions.map((a) => a.id)
    expect(ids).toContain('submit')
    expect(ids).toContain('refresh')
  })

  it('returns resubmit + refresh for UNRESOLVED_ISSUES', () => {
    const actions = getOperatorActions('UNRESOLVED_ISSUES')
    expect(actions[0]).toMatchObject({ id: 'resubmit', label: 'Resubmit for Review' })
    expect(actions.map((a) => a.id)).toContain('refresh')
  })

  it('returns only refresh for WAITING_FOR_REVIEW', () => {
    const actions = getOperatorActions('WAITING_FOR_REVIEW')
    expect(actions).toHaveLength(1)
    expect(actions[0]!.id).toBe('refresh')
    expect(actions[0]!.variant).toBe('default')
  })

  it('returns ghost refresh for COMPLETE', () => {
    const actions = getOperatorActions('COMPLETE')
    expect(actions).toHaveLength(1)
    expect(actions[0]!.variant).toBe('ghost')
  })
})

describe('getStatusMessage', () => {
  it('returns rejection guidance when state is UNRESOLVED_ISSUES with reason', () => {
    const msg = getStatusMessage('UNRESOLVED_ISSUES', 'Guideline 5.1.1')
    expect(msg).toContain('rejection details')
  })

  it('returns submission guidance for READY_FOR_REVIEW', () => {
    const msg = getStatusMessage('READY_FOR_REVIEW', null)
    expect(msg).toContain('ready to be submitted')
  })

  it('returns completion message for COMPLETE', () => {
    const msg = getStatusMessage('COMPLETE', null)
    expect(msg).toContain('completed successfully')
  })
})

describe('getStateTone', () => {
  it('returns error for UNRESOLVED_ISSUES', () => {
    expect(getStateTone('UNRESOLVED_ISSUES')).toBe('error')
  })

  it('returns ok for done states', () => {
    expect(getStateTone('COMPLETE')).toBe('ok')
    expect(getStateTone('COMPLETING')).toBe('ok')
  })

  it('returns warn for review states', () => {
    expect(getStateTone('WAITING_FOR_REVIEW')).toBe('warn')
    expect(getStateTone('IN_REVIEW')).toBe('warn')
  })

  it('returns neutral for READY_FOR_REVIEW', () => {
    expect(getStateTone('READY_FOR_REVIEW')).toBe('neutral')
  })
})

describe('humanizeState', () => {
  it('replaces underscores with spaces', () => {
    expect(humanizeState('READY_FOR_REVIEW')).toBe('READY FOR REVIEW')
  })
})

describe('state predicates', () => {
  it('isActionableState identifies actionable review submission states', () => {
    expect(isActionableState('READY_FOR_REVIEW')).toBe(true)
    expect(isActionableState('UNRESOLVED_ISSUES')).toBe(true)
    expect(isActionableState('IN_REVIEW')).toBe(false)
  })

  it('isUnresolvedState identifies unresolved issues', () => {
    expect(isUnresolvedState('UNRESOLVED_ISSUES')).toBe(true)
    expect(isUnresolvedState('COMPLETE')).toBe(false)
  })

  it('isDoneState identifies completed states', () => {
    expect(isDoneState('COMPLETE')).toBe(true)
    expect(isDoneState('COMPLETING')).toBe(true)
    expect(isDoneState('WAITING_FOR_REVIEW')).toBe(false)
  })

  it('isVersionMetadataEditable checks version-level editability', () => {
    expect(isVersionMetadataEditable('PREPARE_FOR_SUBMISSION')).toBe(true)
    expect(isVersionMetadataEditable('REJECTED')).toBe(true)
    expect(isVersionMetadataEditable('METADATA_REJECTED')).toBe(true)
    expect(isVersionMetadataEditable('IN_REVIEW')).toBe(false)
  })
})

describe('isExpandableTimelineEvent', () => {
  it('returns true for asc_request_failed with payload', () => {
    expect(
      isExpandableTimelineEvent('asc_request_failed', { errors: [] }),
    ).toBe(true)
  })

  it('returns false for asc_request_failed without payload', () => {
    expect(isExpandableTimelineEvent('asc_request_failed', null)).toBe(false)
  })

  it('returns false for non-error event types', () => {
    expect(
      isExpandableTimelineEvent('submission_requested', { errors: [] }),
    ).toBe(false)
  })
})

describe('getErrorPreview', () => {
  it('returns the first error title', () => {
    const preview = getErrorPreview({
      errors: [
        {
          title: 'The resource is not in a valid state',
          detail: 'Some longer detail text',
        },
      ],
    })
    expect(preview).toBe('The resource is not in a valid state')
  })

  it('falls back to detail when title is missing', () => {
    const preview = getErrorPreview({
      errors: [{ detail: 'Something went wrong' }],
    })
    expect(preview).toBe('Something went wrong')
  })

  it('truncates long text', () => {
    const longTitle = 'A'.repeat(150)
    const preview = getErrorPreview({ errors: [{ title: longTitle }] })
    expect(preview.length).toBeLessThanOrEqual(120)
    expect(preview).toContain('...')
  })

  it('returns fallback for empty errors', () => {
    expect(getErrorPreview({ errors: [] })).toBe('Unknown error')
    expect(getErrorPreview({})).toBe('Unknown error')
  })
})

describe('flattenAssociatedErrors', () => {
  it('flattens associatedErrors from multiple top-level errors', () => {
    const result = flattenAssociatedErrors([
      {
        code: 'STATE_ERROR.ENTITY_STATE_INVALID',
        associatedErrors: [
          { code: 'SCREENSHOT_REQUIRED', detail: 'Missing screenshot' },
          { code: 'ICON_REQUIRED', detail: 'Missing icon' },
        ],
      },
      {
        code: 'ANOTHER_ERROR',
        associatedErrors: [
          { code: 'SUB_ERROR', detail: 'Sub detail' },
        ],
      },
    ])
    expect(result).toHaveLength(3)
    expect(result[0]).toMatchObject({
      code: 'SCREENSHOT_REQUIRED',
      detail: 'Missing screenshot',
      parentCode: 'STATE_ERROR.ENTITY_STATE_INVALID',
    })
    expect(result[2]).toMatchObject({
      code: 'SUB_ERROR',
      parentCode: 'ANOTHER_ERROR',
    })
  })

  it('returns empty array when no associatedErrors exist', () => {
    const result = flattenAssociatedErrors([
      { code: 'SOME_ERROR', title: 'Error' },
    ])
    expect(result).toHaveLength(0)
  })
})

describe('buildActivity', () => {
  it('maps timeline events including ASC_REQUEST_FAILED to activity text', () => {
    const activity = buildActivity({
      timeline: [
        {
          id: '1',
          eventType: 'submission_requested',
          createdAt: new Date(),
        },
        {
          id: '2',
          eventType: 'asc_request_failed',
          createdAt: new Date(),
        },
      ],
    })
    expect(activity).toHaveLength(2)
    expect(activity[0]!.text).toBe('App Store Connect request failed')
    expect(activity[1]!.text).toBe('Submitted version for review')
  })
})

describe('parseTimelineErrorPayload', () => {
  it('parses stringified payload values', () => {
    const payload = parseTimelineErrorPayload(
      JSON.stringify({
        errors: [{ code: 'STATE_ERROR.ENTITY_STATE_INVALID' }],
      }),
    )

    expect(payload?.errors?.[0]?.code).toBe('STATE_ERROR.ENTITY_STATE_INVALID')
  })

  it('returns null for invalid values', () => {
    expect(parseTimelineErrorPayload('bad json')).toBeNull()
    expect(parseTimelineErrorPayload({ foo: 'bar' })).toBeNull()
  })
})

describe('resolveWorkingVersionId', () => {
  it('prefers the explicit submission version id', () => {
    expect(
      resolveWorkingVersionId({
        submissionVersionId: 'version-1',
        versionOptions: [{ id: 'version-2' }],
      }),
    ).toBe('version-1')
  })

  it('falls back to the eligible version option', () => {
    expect(
      resolveWorkingVersionId({
        submissionVersionId: null,
        submissionPlatform: 'IOS',
        versionOptions: [
          { id: 'version-old', platform: 'IOS' },
          {
            id: 'version-ready',
            platform: 'IOS',
            eligibleForInitialSubmission: true,
          },
        ],
      }),
    ).toBe('version-ready')
  })
})

describe('getTimelineFailureCopy', () => {
  it('uses the ASC payload for timeline title and detail', () => {
    const copy = getTimelineFailureCopy(
      {
        errors: [
          {
            title: 'App is missing required pricing.',
            detail: 'App is not eligible for submission until pricing has been set.',
            associatedErrors: [
              { code: 'ANOTHER_BLOCKER', detail: 'Another blocker' },
            ],
          },
        ],
      },
      'fallback detail',
    )

    expect(copy.title).toBe('App is missing required pricing.')
    expect(copy.detail).toContain('pricing has been set')
    expect(copy.detail).toContain('Expand to view 1 related issue')
  })
})
