import { headers } from 'next/headers'
import InitialSetupWizardClient from '../InitialSetupWizardClient'
import {
  listUnconnectedApps,
  listGithubReposForCurrentUser,
} from '@/server/apps-service'

export default async function AddAppPage() {
  const requestHeaders = await headers()

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
