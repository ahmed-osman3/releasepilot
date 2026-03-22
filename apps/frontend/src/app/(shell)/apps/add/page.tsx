import { headers } from 'next/headers'
import { AppConnectPicker } from '@/features/app-onboarding/AppConnectPicker'
import { listUnconnectedApps } from '@/server/apps-service'

export default async function AddAppPage() {
  const requestHeaders = await headers()
  const appsResult = await listUnconnectedApps(requestHeaders)

  return (
    <AppConnectPicker
      initialApps={appsResult.apps}
      initialError={appsResult.error}
    />
  )
}
