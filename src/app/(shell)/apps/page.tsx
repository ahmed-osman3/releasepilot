import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  getConnectedApps,
  hasAscApiKey,
  listGithubReposForCurrentUser,
  listUnconnectedApps,
} from '@/server/apps-service'
import InitialSetupWizardClient from './InitialSetupWizardClient'

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

  const [appsResult, reposResult] = await Promise.all([
    listUnconnectedApps(requestHeaders),
    listGithubReposForCurrentUser(requestHeaders),
  ])

  return (
    <InitialSetupWizardClient
      initialApps={appsResult.apps}
      initialAppsError={appsResult.error}
      initialRepos={reposResult.repos}
      initialReposError={reposResult.error}
    />
  )
}
