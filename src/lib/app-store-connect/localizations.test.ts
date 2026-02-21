import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getVersionLocalizations,
  updateVersionLocalization,
  type GetToken,
} from './localizations'

describe('localizations', () => {
  const getToken: GetToken = vi.fn(() => Promise.resolve('mock-jwt'))

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('getVersionLocalizations returns localizations', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: [
            {
              type: 'appStoreVersionLocalizations',
              id: 'loc-en-us',
              attributes: {
                locale: 'en-US',
                description: 'An app.',
                keywords: 'test,app',
                promotionalText: 'Promo',
                whatsNew: 'Bug fixes',
              },
            },
          ],
        }),
    } as Response)

    const result = await getVersionLocalizations('v1', getToken)
    expect(result.error).toBeUndefined()
    expect(result.localizations).toHaveLength(1)
    expect(result.localizations[0]).toEqual({
      id: 'loc-en-us',
      locale: 'en-US',
      description: 'An app.',
      keywords: 'test,app',
      promotionalText: 'Promo',
      whatsNew: 'Bug fixes',
    })
  })

  it('updateVersionLocalization succeeds', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: {
            type: 'appStoreVersionLocalizations',
            id: 'loc-en-us',
            attributes: {},
          },
        }),
    } as Response)

    const result = await updateVersionLocalization(
      'loc-en-us',
      { description: 'Updated description', keywords: 'new,keywords' },
      getToken,
    )
    expect(result.error).toBeUndefined()
    expect(result.success).toBe(true)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/appStoreVersionLocalizations/loc-en-us'),
      expect.objectContaining({
        method: 'PATCH',
        body: expect.stringContaining('Updated description'),
      }),
    )
  })
})
