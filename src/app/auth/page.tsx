import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getCurrentUserId } from '@/lib/auth.server'
import AuthClient from './AuthClient'

export default async function AuthPage() {
  const userId = await getCurrentUserId(await headers())
  if (userId) {
    redirect('/apps')
  }

  return <AuthClient />
}
