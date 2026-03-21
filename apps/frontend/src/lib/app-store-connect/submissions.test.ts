import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getSubmissionState,
  listAppStoreVersions,
  submitVersionForReview,
  type GetToken,
} from './submissions'

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
    expect(result.versions[0]).toEqual({
      id: 'v1',
      versionString: '1.0.0',
      state: 'READY_FOR_SUBMISSION',
    })
  })

  it('getSubmissionState returns state and rejection reason when rejected', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            data: {
              type: 'appStoreVersions',
              id: 'v1',
              attributes: { versionString: '1.0.0' },
            },
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            data: [
              {
                type: 'appStoreVersionSubmissions',
                id: 'sub1',
                attributes: { state: 'REJECTED' },
              },
            ],
          }),
      } as Response)
      .mockResolvedValueOnce({
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

    const result = await getSubmissionState('v1', getToken)
    expect(result.error).toBeUndefined()
    expect(result.state).not.toBeNull()
    expect(result.state?.state).toBe('REJECTED')
    expect(result.state?.rejectionReason).toBe(
      'Guideline 4.2 - Minimum Functionality.',
    )
    expect(result.state?.versionString).toBe('1.0.0')
  })

  it('submitVersionForReview returns success when POST succeeds', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: () =>
        Promise.resolve({
          data: {
            type: 'appStoreVersionSubmissions',
            id: 'sub-new',
            attributes: {},
          },
        }),
    } as Response)

    const result = await submitVersionForReview('v1', getToken)
    expect(result.error).toBeUndefined()
    expect(result.success).toBe(true)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/appStoreVersionSubmissions'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('v1'),
      }),
    )
  })
})
