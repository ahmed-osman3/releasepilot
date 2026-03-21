import { createFileRoute } from '@tanstack/react-router'
import { getCurrentUserId } from '@/lib/auth.server'
import { handleGithubAppSetupCallback } from '@/lib/github/server'

function redirectTo(url: string): Response {
  return Response.redirect(url, 302)
}

export const Route = createFileRoute('/api/github/install/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = await getCurrentUserId()
        if (!userId) {
          return redirectTo('/apps/add?github=auth_required')
        }

        const url = new URL(request.url)

        try {
          const { returnTo } = await handleGithubAppSetupCallback(
            url.searchParams,
            userId,
          )

          return redirectTo(`${returnTo}?github=installed`)
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'GitHub install failed'
          return redirectTo(
            `/apps/add?github=install_failed&message=${encodeURIComponent(message)}`,
          )
        }
      },
    },
  },
})
