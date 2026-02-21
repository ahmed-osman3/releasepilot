import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { assertAuthenticated } from '@/lib/auth-guard.server'

export const Route = createFileRoute('/apps')({
  beforeLoad: async () => {
    try {
      await assertAuthenticated()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error ?? '')
      if (!message.toLowerCase().includes('unauthorized')) {
        throw error
      }
      throw redirect({ to: '/auth' })
    }
  },
  component: AppsLayout,
})

function AppsLayout() {
  return <Outlet />
}
