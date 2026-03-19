import { getCurrentUserId } from '@/lib/auth.server'

export async function assertAuthenticated(requestHeaders: HeadersInit) {
  const userId = await getCurrentUserId(requestHeaders)
  return { userId }
}
