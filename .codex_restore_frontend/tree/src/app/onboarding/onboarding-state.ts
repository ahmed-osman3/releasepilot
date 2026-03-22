export type GithubInstallStatus =
  | { kind: 'idle' }
  | { kind: 'installed' }
  | { kind: 'failed'; message: string | null }
  | { kind: 'auth_required' }

function normalizeMessage(value: string | null): string | null {
  const message = value?.trim() ?? ''
  return message.length > 0 ? message : null
}

export function resolveGithubInstallStatus(
  searchParams: URLSearchParams,
): GithubInstallStatus {
  const github = searchParams.get('github')

  if (github === 'installed') {
    return { kind: 'installed' }
  }

  if (github === 'install_failed') {
    return {
      kind: 'failed',
      message: normalizeMessage(searchParams.get('message')),
    }
  }

  if (github === 'auth_required') {
    return { kind: 'auth_required' }
  }

  return { kind: 'idle' }
}

export function canAdvanceFromTeamName(teamName: string): boolean {
  return teamName.trim().length > 0
}

export function hasAscFormFields(data: {
  issuerId: string
  keyId: string
  privateKey: string
}): boolean {
  return (
    data.issuerId.trim().length > 0 &&
    data.keyId.trim().length > 0 &&
    data.privateKey.trim().length > 0
  )
}
