import { createFileRoute } from '@tanstack/react-router'
import { beginGithubAppInstall } from '@/lib/github/server'
import { getCurrentUserId } from '@/lib/auth.server'

export const Route = createFileRoute('/api/github/install/start')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = await getCurrentUserId()
        if (!userId) {
          return Response.redirect('/apps/add?github=auth_required', 302)
        }

        const url = new URL(request.url)
        const returnTo = url.searchParams.get('returnTo') ?? '/apps/add'
        const installUrl = beginGithubAppInstall(returnTo, userId)

        return Response.redirect(installUrl, 302)
      },
    },
  },
})
