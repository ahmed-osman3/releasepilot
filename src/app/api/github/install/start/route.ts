import { beginGithubAppInstall } from '@/lib/github/server'
import { getCurrentUserId } from '@/lib/auth.server'

export async function GET(request: Request) {
  const userId = await getCurrentUserId(request.headers)
  if (!userId) {
    return Response.redirect(new URL('/apps/add?github=auth_required', request.url), 302)
  }

  const url = new URL(request.url)
  const returnTo = url.searchParams.get('returnTo') ?? '/apps/add'
  const installUrl = beginGithubAppInstall(returnTo, userId)

  return Response.redirect(installUrl, 302)
}
