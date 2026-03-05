import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  listAppStoreVersions,
  listReviewSubmissions,
  getReviewSubmission,
  submitExistingReviewSubmission,
  createAndSubmitReviewSubmission,
  getVersionRejectionReason,
} from './submissions'
import type { GetToken } from './fetch'

describe('submissions', () => {
  const getToken: GetToken = vi.fn(() => Promise.resolve('mock-jwt'))

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('listAppStoreVersions returns versions', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: [
            {
              type: 'appStoreVersions',
              id: 'v1',
              attributes: {
                versionString: '1.0.0',
                appStoreState: 'READY_FOR_SUBMISSION',
              },
            },
          ],
        }),
    } as Response)

    const result = await listAppStoreVersions('app-123', getToken)
    expect(result.error).toBeUndefined()
    expect(result.versions).toHaveLength(1)
  })

  it('listReviewSubmissions returns normalized submissions with included version', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: [
            {
              type: 'reviewSubmissions',
              id: 'rs1',
              attributes: {
                state: 'WAITING_FOR_REVIEW',
                submittedDate: '2026-03-01T10:00:00Z',
                platform: 'IOS',
              },
              relationships: {
                appStoreVersionForReview: {
                  data: { type: 'appStoreVersions', id: 'v1' },
                },
              },
            },
          ],
          included: [
            {
              type: 'appStoreVersions',
              id: 'v1',
              attributes: {
                versionString: '2.0.0',
                appVersionState: 'IN_REVIEW',
              },
            },
          ],
        }),
    } as Response)

    const result = await listReviewSubmissions('app-123', getToken)
    expect(result.error).toBeUndefined()
    expect(result.submissions).toHaveLength(1)
    expect(result.submissions[0]).toMatchObject({
      id: 'rs1',
      state: 'WAITING_FOR_REVIEW',
      platform: 'IOS',
      appStoreVersion: {
        id: 'v1',
        versionString: '2.0.0',
        appVersionState: 'IN_REVIEW',
      },
    })
  })

  it('getReviewSubmission returns a single normalized submission', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: {
            type: 'reviewSubmissions',
            id: 'rs1',
            attributes: {
              state: 'READY_FOR_REVIEW',
              platform: 'IOS',
            },
            relationships: {
              appStoreVersionForReview: {
                data: { type: 'appStoreVersions', id: 'v2' },
              },
            },
          },
          included: [
            {
              type: 'appStoreVersions',
              id: 'v2',
              attributes: {
                versionString: '3.0.0',
                appVersionState: 'PREPARE_FOR_SUBMISSION',
              },
            },
          ],
        }),
    } as Response)

    const result = await getReviewSubmission('rs1', getToken)
    expect(result.error).toBeUndefined()
    expect(result.submission).toMatchObject({
      id: 'rs1',
      state: 'READY_FOR_REVIEW',
      appStoreVersion: { id: 'v2', versionString: '3.0.0' },
    })
  })

  it('falls back to review submission items when appStoreVersionForReview is missing', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: {
            type: 'reviewSubmissions',
            id: 'rs-item',
            attributes: {
              state: 'READY_FOR_REVIEW',
              platform: 'IOS',
            },
            relationships: {
              items: {
                data: [{ type: 'reviewSubmissionItems', id: 'rsi-1' }],
              },
            },
          },
          included: [
            {
              type: 'reviewSubmissionItems',
              id: 'rsi-1',
              relationships: {
                appStoreVersion: {
                  data: { type: 'appStoreVersions', id: 'v-item' },
                },
              },
            },
            {
              type: 'appStoreVersions',
              id: 'v-item',
              attributes: {
                versionString: '4.2.0',
                appVersionState: 'PREPARE_FOR_SUBMISSION',
              },
            },
          ],
        }),
    } as Response)

    const result = await getReviewSubmission('rs-item', getToken)
    expect(result.error).toBeUndefined()
    expect(result.submission?.appStoreVersion).toMatchObject({
      id: 'v-item',
      versionString: '4.2.0',
      appVersionState: 'PREPARE_FOR_SUBMISSION',
    })
  })

  it('submitExistingReviewSubmission patches with submitted: true', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: {
            type: 'reviewSubmissions',
            id: 'rs1',
            attributes: { state: 'WAITING_FOR_REVIEW', platform: 'IOS' },
            relationships: {
              appStoreVersionForReview: {
                data: { type: 'appStoreVersions', id: 'v1' },
              },
            },
          },
          included: [
            {
              type: 'appStoreVersions',
              id: 'v1',
              attributes: {
                versionString: '1.0.0',
                appVersionState: 'IN_REVIEW',
              },
            },
          ],
        }),
    } as Response)

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: {
            type: 'reviewSubmissions',
            id: 'rs1',
            attributes: { state: 'WAITING_FOR_REVIEW', platform: 'IOS' },
            relationships: {
              appStoreVersionForReview: {
                data: { type: 'appStoreVersions', id: 'v1' },
              },
            },
          },
          included: [
            {
              type: 'appStoreVersions',
              id: 'v1',
              attributes: {
                versionString: '1.0.0',
                appVersionState: 'IN_REVIEW',
              },
            },
          ],
        }),
    } as Response)

    const result = await submitExistingReviewSubmission('rs1', getToken)
    expect(result.error).toBeUndefined()
    expect(result.submission?.state).toBe('WAITING_FOR_REVIEW')

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/reviewSubmissions\/rs1$/),
      expect.objectContaining({
        method: 'PATCH',
        body: expect.stringContaining('"submitted":true'),
      }),
    )
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(
        '/reviewSubmissions/rs1?include=appStoreVersionForReview,items',
      ),
      expect.any(Object),
    )
  })

  it('submitExistingReviewSubmission attaches the version before submit when missing', async () => {
    const mockFetch = vi.mocked(fetch)

    // 1. GET /reviewSubmissions/rs1?include=appStoreVersionForReview,items
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: {
            type: 'reviewSubmissions',
            id: 'rs1',
            attributes: { state: 'READY_FOR_REVIEW', platform: 'IOS' },
          },
        }),
    } as Response)

    // 2. POST /reviewSubmissionItems
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: () =>
        Promise.resolve({
          data: {
            type: 'reviewSubmissionItems',
            id: 'rsi-1',
            attributes: { state: 'READY_FOR_REVIEW' },
          },
        }),
    } as Response)

    // 3. PATCH /reviewSubmissions/rs1
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: {
            type: 'reviewSubmissions',
            id: 'rs1',
            attributes: { state: 'WAITING_FOR_REVIEW', platform: 'IOS' },
          },
        }),
    } as Response)

    // 4. GET /reviewSubmissions/rs1?include=appStoreVersionForReview,items
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: {
            type: 'reviewSubmissions',
            id: 'rs1',
            attributes: { state: 'WAITING_FOR_REVIEW', platform: 'IOS' },
            relationships: {
              appStoreVersionForReview: {
                data: { type: 'appStoreVersions', id: 'v1' },
              },
            },
          },
          included: [
            {
              type: 'appStoreVersions',
              id: 'v1',
              attributes: {
                versionString: '1.0.0',
                appVersionState: 'IN_REVIEW',
              },
            },
          ],
        }),
    } as Response)

    const result = await submitExistingReviewSubmission('rs1', getToken, 'v1')
    expect(result.error).toBeUndefined()
    expect(result.submission).toMatchObject({
      id: 'rs1',
      state: 'WAITING_FOR_REVIEW',
      appStoreVersion: { id: 'v1', versionString: '1.0.0' },
    })
    expect(mockFetch).toHaveBeenCalledTimes(4)
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/reviewSubmissionItems'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"appStoreVersions","id":"v1"'),
      }),
    )
    expect(mockFetch).toHaveBeenNthCalledWith(
      3,
      expect.stringMatching(/\/reviewSubmissions\/rs1$/),
      expect.objectContaining({
        method: 'PATCH',
        body: expect.stringContaining('"submitted":true'),
      }),
    )
  })

  it('createAndSubmitReviewSubmission orchestrates create, add item, and submit', async () => {
    const mockFetch = vi.mocked(fetch)

    // 1. POST /reviewSubmissions
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: () =>
        Promise.resolve({
          data: {
            type: 'reviewSubmissions',
            id: 'rs-new',
            attributes: { state: 'READY_FOR_REVIEW', platform: 'IOS' },
          },
        }),
    } as Response)

    // 2. POST /reviewSubmissionItems
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: () =>
        Promise.resolve({
          data: {
            type: 'reviewSubmissionItems',
            id: 'rsi-1',
            attributes: { state: 'READY_FOR_REVIEW' },
          },
        }),
    } as Response)

    // 3. PATCH /reviewSubmissions/rs-new (submit)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: {
            type: 'reviewSubmissions',
            id: 'rs-new',
            attributes: {
              state: 'WAITING_FOR_REVIEW',
              submittedDate: '2026-03-01T12:00:00Z',
              platform: 'IOS',
            },
          },
        }),
    } as Response)

    // 4. GET /reviewSubmissions/rs-new?include=appStoreVersionForReview,items
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: {
            type: 'reviewSubmissions',
            id: 'rs-new',
            attributes: {
              state: 'WAITING_FOR_REVIEW',
              submittedDate: '2026-03-01T12:00:00Z',
              platform: 'IOS',
            },
            relationships: {
              appStoreVersionForReview: {
                data: { type: 'appStoreVersions', id: 'v1' },
              },
            },
          },
          included: [
            {
              type: 'appStoreVersions',
              id: 'v1',
              attributes: {
                versionString: '1.0.0',
                appVersionState: 'IN_REVIEW',
              },
            },
          ],
        }),
    } as Response)

    const result = await createAndSubmitReviewSubmission(
      'app-123',
      'v1',
      'IOS',
      getToken,
    )
    expect(result.error).toBeUndefined()
    expect(result.submission).toMatchObject({
      id: 'rs-new',
      state: 'WAITING_FOR_REVIEW',
    })
    expect(mockFetch).toHaveBeenCalledTimes(4)
  })

  it('submitExistingReviewSubmission preserves structured ASC errors on 409', async () => {
    const mockFetch = vi.mocked(fetch)

    // PATCH returns 409 with structured errors and associatedErrors
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: () =>
        Promise.resolve({
          errors: [
            {
              id: 'err-1',
              status: '409',
              code: 'STATE_ERROR.ENTITY_STATE_INVALID',
              title: 'The resource is not in a valid state',
              detail:
                "The resource 'ReviewSubmission' is not in a valid state to process this request.",
              meta: {
                associatedErrors: {
                  '/v1/reviewSubmissionItems/rsi-1': [
                    {
                      code: 'STATE_ERROR.SCREENSHOT_REQUIRED.IOS',
                      detail: 'At least one screenshot is required.',
                    },
                  ],
                },
              },
            },
          ],
        }),
    } as Response)

    const result = await submitExistingReviewSubmission('rs1', getToken)
    expect(result.error).toContain('not in a valid state')
    expect(result.errors).toBeDefined()
    expect(result.errors?.[0]).toMatchObject({
      status: '409',
      code: 'STATE_ERROR.ENTITY_STATE_INVALID',
      title: expect.stringContaining('not in a valid state'),
    })
    expect(result.errors?.[0]?.associatedErrors).toHaveLength(1)
    expect(result.errors?.[0]?.associatedErrors?.[0]).toMatchObject({
      code: 'STATE_ERROR.SCREENSHOT_REQUIRED.IOS',
      detail: 'At least one screenshot is required.',
    })
  })

  it('getVersionRejectionReason returns rejection notes from review detail', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: {
            type: 'appStoreReviewDetails',
            id: 'rd1',
            attributes: {
              rejectionNotes: 'Guideline 4.2 - Minimum Functionality.',
            },
          },
        }),
    } as Response)

    const reason = await getVersionRejectionReason('v1', getToken)
    expect(reason).toBe('Guideline 4.2 - Minimum Functionality.')
  })

  it('getVersionRejectionReason returns null when no rejection', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: null }),
    } as Response)

    const reason = await getVersionRejectionReason('v1', getToken)
    expect(reason).toBeNull()
  })
})
