import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppConnectPicker } from '@/features/app-onboarding/AppConnectPicker'

const push = vi.fn()
const refresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push,
    refresh,
  }),
}))

describe('AppConnectPicker', () => {
  beforeEach(() => {
    push.mockReset()
    refresh.mockReset()
    vi.restoreAllMocks()
  })

  it('connects an app and routes to its dashboard', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, connectedAppId: 42 }),
      }),
    )

    render(
      <AppConnectPicker
        initialApps={[{ id: '123', name: 'Deenya', bundleId: 'com.example.deenya' }]}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /deenya/i }))

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/apps/42')
      expect(refresh).toHaveBeenCalled()
    })
  })
})
