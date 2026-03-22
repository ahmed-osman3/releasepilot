import type { SuggestedLocaleEdits } from '@/lib/ai/suggest-rejection-fix'
import type { VersionLocalizationUpdate } from '@/lib/asc/localization-mutations'

async function parseJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T
}

export async function submitReviewSubmissionServer(data: {
  connectedAppId: number
  reviewSubmissionId?: string
  versionId?: string
  platform?: string
  isResubmission?: boolean
}) {
  const response = await fetch('/api/apps/submissions/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  return parseJson<{ success?: boolean; error?: string; reviewSubmissionId?: string }>(response)
}

export async function refreshReviewSubmissionStateServer(data: {
  connectedAppId: number
  reviewSubmissionId: string
  versionId: string
  previousState: string | null
}) {
  const response = await fetch('/api/apps/submissions/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  return parseJson<{ submission: unknown; stateChanged: boolean; error?: string }>(response)
}

export async function getVersionMetadataServer(data: {
  connectedAppId: number
  versionId: string
}) {
  const response = await fetch(
    `/api/apps/submissions/metadata?connectedAppId=${data.connectedAppId}&versionId=${encodeURIComponent(data.versionId)}`,
    { method: 'GET' },
  )

  return parseJson<{
    localizations: Array<{
      id: string
      locale: string
      description?: string
      keywords?: string
      promotionalText?: string
      whatsNew?: string
    }>
    error?: string
  }>(response)
}

export async function applyVersionMetadataServer(data: {
  connectedAppId: number
  versionId: string
  localeId: string
  updates: VersionLocalizationUpdate
}) {
  const response = await fetch('/api/apps/submissions/metadata', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  return parseJson<{ success?: boolean; error?: string }>(response)
}

export async function suggestRejectionFixServer(data: {
  rejectionReason: string
  currentMetadata: Array<{
    localeId: string
    locale: string
    description?: string
    keywords?: string
    promotionalText?: string
    whatsNew?: string
  }>
}) {
  const response = await fetch('/api/apps/submissions/fix/suggest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  return parseJson<{ explanation: string; suggestedEdits: Record<string, SuggestedLocaleEdits> }>(response)
}

export async function listGithubReposServer() {
  const response = await fetch('/api/apps/github/repos', { method: 'GET' })

  return parseJson<{
    repos?: Array<{
      installationId: string
      fullName: string
      owner: string
      name: string
      defaultBranch: string
      private: boolean
    }>
    error?: string
  }>(response)
}

export async function listGithubBranchesServer(data: {
  installationId: string
  repoFullName: string
}) {
  const response = await fetch('/api/apps/github/branches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  return parseJson<{ branches?: string[]; defaultBranch?: string | null; error?: string }>(response)
}

export async function updateGithubBranchServer(data: {
  connectedAppId: number
  githubInstallationId: string
  githubRepoFullName: string
  githubRepoOwner: string
  githubRepoName: string
  watchedBranch: string
}) {
  const response = await fetch('/api/apps/github/configure', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  return parseJson<{
    success?: boolean
    error?: string
    githubInstallationId?: string
    githubRepoFullName?: string
    watchedBranch?: string
  }>(response)
}

export async function updateAutomationLocalesServer(data: {
  connectedAppId: number
  automationLocales: string[]
}) {
  const response = await fetch('/api/apps/automation/locales', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  return parseJson<{
    success?: boolean
    error?: string
    automationLocales?: string[]
  }>(response)
}
