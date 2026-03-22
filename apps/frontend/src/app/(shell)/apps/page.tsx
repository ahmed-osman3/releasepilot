import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { AppConnectPicker } from '@/features/app-onboarding/AppConnectPicker'
import { getConnectedApps, hasAscApiKey, listUnconnectedApps } from '@/server/apps-service'

export default async function AppsEntryPage() {
  const requestHeaders = await headers()
  const [apps, hasKey] = await Promise.all([
    getConnectedApps(requestHeaders),
    hasAscApiKey(requestHeaders),
  ])

  if (!hasKey) {
    redirect('/onboarding')
  }

  if (apps.length > 0) {
    redirect(`/apps/${apps[0].id}`)
  }

  const appsResult = await listUnconnectedApps(requestHeaders)

  return (
    <AppConnectPicker
      initialApps={appsResult.apps}
      initialError={appsResult.error}
    />
  )
}
