import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/start-server-core'
import { auth } from '@/lib/auth.server'

export const assertAuthenticated = createServerFn({
  method: 'GET',
}).handler(async () => {
  const request = getRequest()
  const session = await auth.api.getSession({
    headers: request.headers,
  })
  return { userId: session?.user?.id ?? null }
})
