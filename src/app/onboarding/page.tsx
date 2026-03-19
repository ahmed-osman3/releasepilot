import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { assertAuthenticated } from '@/lib/auth-guard.server'
import { hasAscApiKey } from '@/server/apps-service'
import OnboardingClient from './OnboardingClient'

export default async function OnboardingPage() {
  const requestHeaders = await headers()
  const { userId } = await assertAuthenticated(requestHeaders)
  if (!userId) {
    redirect('/auth')
  }

  const hasKey = await hasAscApiKey(requestHeaders)
  if (hasKey) {
    redirect('/apps')
  }

  return <OnboardingClient />
}
