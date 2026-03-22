import { getCurrentUserId } from '@/lib/auth.server'
import { handleGithubAppSetupCallback } from '@/lib/github/server'

function redirectTo(url: string, requestUrl: string): Response {
  return Response.redirect(new URL(url, requestUrl), 302)
}

export async function GET(request: Request) {
  const userId = await getCurrentUserId(request.headers)
  if (!userId) {
    return redirectTo('/apps/add?github=auth_required', request.url)
  }

  const url = new URL(request.url)

  try {
    const { returnTo } = await handleGithubAppSetupCallback(url.searchParams, userId)
    return redirectTo(`${returnTo}?github=installed`, request.url)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'GitHub install failed'
    return redirectTo(
      `/apps/add?github=install_failed&message=${encodeURIComponent(message)}`,
      request.url,
    )
  }
}
