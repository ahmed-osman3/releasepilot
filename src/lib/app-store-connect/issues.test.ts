import { describe, expect, it } from 'vitest'
import { normalizeAscIssues } from './issues'
import type { NormalizedAscError } from './fetch'

describe('normalizeAscIssues', () => {
  it('classifies localization gaps', () => {
    const issues = normalizeAscIssues([
      {
        id: 'err-1',
        title: 'Missing required field',
        detail:
          'A description is required for the en-US localization before submission.',
        source: { pointer: '/data/attributes/localizations/en-US/description' },
      },
    ] satisfies Array<NormalizedAscError>)

    expect(issues).toEqual([
      expect.objectContaining({
        id: 'err-1',
        category: 'localization',
        code: 'missing_localization',
        field: 'description',
        locale: 'en-US',
      }),
    ])
  })

  it('classifies URL gaps', () => {
    const issues = normalizeAscIssues([
      {
        title: 'Missing URL',
        detail: 'A privacy policy URL is required to submit this version.',
        source: { pointer: '/data/attributes/privacyPolicyUrl' },
      },
    ] satisfies Array<NormalizedAscError>)

    expect(issues[0]).toMatchObject({
      category: 'url',
      code: 'missing_url',
      field: 'privacyPolicyUrl',
    })
  })

  it('classifies pricing issues', () => {
    const issues = normalizeAscIssues([
      {
        title: 'Pricing is required',
        detail: 'A price schedule must be configured before submission.',
        source: { pointer: '/data/relationships/prices' },
      },
    ] satisfies Array<NormalizedAscError>)

    expect(issues[0]).toMatchObject({
      category: 'pricing',
      code: 'pricing_required',
      field: 'priceSchedule',
    })
  })

  it('falls back to unknown issues defensively', () => {
    const issues = normalizeAscIssues([
      {
        title: 'Submission blocked',
        detail: 'Something went wrong.',
      },
    ] satisfies Array<NormalizedAscError>)

    expect(issues[0]).toMatchObject({
      category: 'unknown',
      code: 'unknown_submission_issue',
      blocking: true,
    })
  })
})
