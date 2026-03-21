import { Navigate, createFileRoute } from '@tanstack/react-router'
import { Route as HeaderRoute } from './route'

export const Route = createFileRoute('/apps/$appId/submissions/_header/')({
  component: SubmissionsIndexRedirect,
  wrapInSuspense: true,
})

function SubmissionsIndexRedirect() {
  const { connectedAppId, submissions } = HeaderRoute.useLoaderData()

  const latest = [...submissions].sort((a, b) => {
    const aDate = Date.parse(a.attributes?.createdDate ?? '') || 0
    const bDate = Date.parse(b.attributes?.createdDate ?? '') || 0
    return bDate - aDate
  })[0]

  return (
    <Navigate
      to="/apps/$appId/submissions/$versionId"
      params={{
        appId: String(connectedAppId),
        versionId: latest.id,
      }}
      replace
    />
  )
}
