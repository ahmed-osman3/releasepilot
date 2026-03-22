import { createHmac, createPrivateKey, timingSafeEqual } from 'node:crypto'
import { SignJWT } from 'jose'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@repo/db'
import { account, githubInstallations } from '@repo/db/schema'

type GithubInstallationAccount = {
  id?: number
  login: string
  type: string
}

type GithubInstallation = {
  id: number
  account: GithubInstallationAccount
}

type GithubWebhookActor = {
  id?: number
  login?: string
  type?: string
}

type GithubWebhookInstallationPayload = {
  action?: string
  installation?: {
    id?: number
    account?: GithubWebhookActor
  }
  sender?: GithubWebhookActor
}

export type GithubRepoOption = {
  installationId: string
  fullName: string
  owner: string
  name: string
  defaultBranch: string
  private: boolean
}

export type GithubBranchOption = {
  name: string
}

const GITHUB_API_BASE = 'https://api.github.com'

function getRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

function getAppBaseUrl(): string {
  const appBaseUrl = getRequiredEnv('APP_BASE_URL')
  return appBaseUrl.replace(/\/$/, '')
}

function getGithubAppPrivateKey(): string {
  const privateKey = getRequiredEnv('GITHUB_APP_PRIVATE_KEY')
  return privateKey.trim().replace(/^['"]|['"]$/g, '').replace(/\\n/g, '\n')
}

async function createGithubAppJwt(): Promise<string> {
  const appId = getRequiredEnv('GITHUB_APP_ID')
  const privateKeyPem = getGithubAppPrivateKey()
  let privateKey: ReturnType<typeof createPrivateKey>
  try {
    // Accept both PKCS#8 ("BEGIN PRIVATE KEY") and PKCS#1 ("BEGIN RSA PRIVATE KEY").
    privateKey = createPrivateKey({ key: privateKeyPem, format: 'pem' })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Invalid GITHUB_APP_PRIVATE_KEY: ${message}`)
  }

  const now = Math.floor(Date.now() / 1000)
  return await new SignJWT({})
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt(now - 30)
    .setExpirationTime(now + 9 * 60)
    .setIssuer(appId)
    .sign(privateKey)
}

async function githubAppRequest(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const jwt = await createGithubAppJwt()
  return fetch(`${GITHUB_API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${jwt}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init?.headers ?? {}),
    },
  })
}

async function createInstallationToken(
  installationId: string,
): Promise<string> {
  const response = await githubAppRequest(
    `/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
    },
  )

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Failed to create installation token: ${body}`)
  }

  const json = (await response.json()) as { token?: string }
  if (!json.token) {
    throw new Error('GitHub installation token is missing from response')
  }

  return json.token
}

export async function createInstallationAccessTokenForUser(
  userId: string,
  installationId: string,
): Promise<string> {
  await ensureUserOwnsInstallation(userId, installationId)
  return createInstallationToken(installationId)
}

async function githubInstallationRequest(
  installationId: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const token = await createInstallationToken(installationId)
  return fetch(`${GITHUB_API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init?.headers ?? {}),
    },
  })
}

type GithubInstallStatePayload = {
  userId: string
  returnTo: string
  exp: number
}

function getStateSecret(): string {
  return getRequiredEnv('ENCRYPTION_KEY')
}

function encodeState(payload: GithubInstallStatePayload): string {
  const payloadJson = JSON.stringify(payload)
  const payloadBase64 = Buffer.from(payloadJson, 'utf8').toString('base64url')
  const signature = createHmac('sha256', getStateSecret())
    .update(payloadBase64)
    .digest('base64url')

  return `${payloadBase64}.${signature}`
}

export function decodeState(state: string): GithubInstallStatePayload {
  const [payloadBase64, signature] = state.split('.')
  if (!payloadBase64 || !signature) {
    throw new Error('Invalid state format')
  }

  const expectedSignature = createHmac('sha256', getStateSecret())
    .update(payloadBase64)
    .digest('base64url')

  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSignature)

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    throw new Error('Invalid state signature')
  }

  const payloadJson = Buffer.from(payloadBase64, 'base64url').toString('utf8')
  const payload = JSON.parse(payloadJson) as GithubInstallStatePayload

  if (!payload.userId || !payload.returnTo || !payload.exp) {
    throw new Error('State payload is incomplete')
  }

  if (Date.now() > payload.exp) {
    throw new Error('State has expired')
  }

  return payload
}

function sanitizeReturnTo(returnTo?: string): string {
  if (!returnTo || !returnTo.startsWith('/')) {
    return '/apps/add'
  }

  return returnTo
}

export function beginGithubAppInstall(
  returnTo: string,
  userId: string,
): string {
  const slug = getRequiredEnv('GITHUB_APP_SLUG')
  const safeReturnTo = sanitizeReturnTo(returnTo)

  const state = encodeState({
    userId,
    returnTo: safeReturnTo,
    exp: Date.now() + 10 * 60 * 1000,
  })

  const installUrl = new URL(
    `https://github.com/apps/${slug}/installations/new`,
  )
  installUrl.searchParams.set('state', state)

  return installUrl.toString()
}

async function fetchInstallationById(
  installationId: string,
): Promise<GithubInstallation> {
  const response = await githubAppRequest(
    `/app/installations/${installationId}`,
  )

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Failed to fetch installation: ${body}`)
  }

  const installation = (await response.json()) as GithubInstallation
  if (!installation.id || !installation.account.login) {
    throw new Error('Installation response is missing required fields')
  }

  return installation
}

export async function handleGithubAppSetupCallback(
  query: URLSearchParams,
  userId: string,
): Promise<{ returnTo: string; installationId: string }> {
  const state = query.get('state')
  const installationId = query.get('installation_id')

  if (!state) {
    throw new Error('Missing callback state')
  }

  if (!installationId) {
    throw new Error('Missing installation id')
  }

  const decoded = decodeState(state)
  if (decoded.userId !== userId) {
    throw new Error('State user mismatch')
  }

  const installation = await fetchInstallationById(installationId)

  await db
    .insert(githubInstallations)
    .values({
      userId,
      githubInstallationId: String(installation.id),
      accountLogin: installation.account.login,
      accountType: installation.account.type,
    })
    .onConflictDoUpdate({
      target: [
        githubInstallations.userId,
        githubInstallations.githubInstallationId,
      ],
      set: {
        accountLogin: installation.account.login,
        accountType: installation.account.type,
      },
    })

  return {
    returnTo: sanitizeReturnTo(decoded.returnTo),
    installationId: String(installation.id),
  }
}

export async function listUserInstallations(userId: string) {
  return db
    .select()
    .from(githubInstallations)
    .where(eq(githubInstallations.userId, userId))
}

export async function listReposForUserInstallations(
  userId: string,
): Promise<Array<GithubRepoOption>> {
  const installations = await listUserInstallations(userId)

  const reposByKey = new Map<string, GithubRepoOption>()

  await Promise.all(
    installations.map(async (installation) => {
      const response = await githubInstallationRequest(
        installation.githubInstallationId,
        '/installation/repositories?per_page=100',
      )

      if (!response.ok) {
        return
      }

      const json = (await response.json()) as {
        repositories?: Array<{
          full_name: string
          name: string
          private: boolean
          default_branch: string
          owner?: { login?: string }
        }>
      }

      for (const repo of json.repositories ?? []) {
        const owner = repo.owner?.login
        if (!owner) continue

        const value: GithubRepoOption = {
          installationId: installation.githubInstallationId,
          fullName: repo.full_name,
          owner,
          name: repo.name,
          defaultBranch: repo.default_branch,
          private: repo.private,
        }

        reposByKey.set(
          `${installation.githubInstallationId}:${repo.full_name}`,
          value,
        )
      }
    }),
  )

  return Array.from(reposByKey.values()).sort((a, b) =>
    a.fullName.localeCompare(b.fullName),
  )
}

async function ensureUserOwnsInstallation(
  userId: string,
  installationId: string,
): Promise<void> {
  const rows = await db
    .select({ id: githubInstallations.id })
    .from(githubInstallations)
    .where(
      and(
        eq(githubInstallations.userId, userId),
        eq(githubInstallations.githubInstallationId, installationId),
      ),
    )
    .limit(1)

  if (!rows[0]) {
    throw new Error('Installation not found for this user')
  }
}

function splitRepoFullName(repoFullName: string): {
  owner: string
  repo: string
} {
  const [owner, repo] = repoFullName.split('/')
  if (!owner || !repo) {
    throw new Error('Invalid repository full name')
  }

  return { owner, repo }
}

export async function listBranchesForRepo(
  userId: string,
  installationId: string,
  repoFullName: string,
): Promise<{ branches: Array<GithubBranchOption>; defaultBranch: string | null }> {
  await ensureUserOwnsInstallation(userId, installationId)
  const { owner, repo } = splitRepoFullName(repoFullName)

  const [repoResponse, branchesResponse] = await Promise.all([
    githubInstallationRequest(installationId, `/repos/${owner}/${repo}`),
    githubInstallationRequest(
      installationId,
      `/repos/${owner}/${repo}/branches?per_page=100`,
    ),
  ])

  if (!repoResponse.ok || !branchesResponse.ok) {
    throw new Error('Failed to load repository branches')
  }

  const repoJson = (await repoResponse.json()) as { default_branch?: string }
  const branchesJson = (await branchesResponse.json()) as Array<{
    name: string
  }>

  return {
    branches: branchesJson
      .filter((branch) => branch.name)
      .map((branch) => ({ name: branch.name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    defaultBranch: repoJson.default_branch ?? null,
  }
}

export async function createInstallationClient(
  userId: string,
  installationId: string,
): Promise<{
  request: (path: string, init?: RequestInit) => Promise<Response>
}> {
  await ensureUserOwnsInstallation(userId, installationId)

  return {
    request: (path: string, init?: RequestInit) =>
      githubInstallationRequest(installationId, path, init),
  }
}

function asWebhookPayload(payload: string): GithubWebhookInstallationPayload | null {
  try {
    const parsed = JSON.parse(payload) as unknown
    if (!parsed || typeof parsed !== 'object') {
      return null
    }

    return parsed as GithubWebhookInstallationPayload
  } catch {
    return null
  }
}

function getWebhookCandidateGithubAccountIds(
  parsedPayload: GithubWebhookInstallationPayload,
): Array<string> {
  const candidateIds = new Set<string>()
  const senderId = parsedPayload.sender?.id
  const installationAccountId = parsedPayload.installation?.account?.id

  if (typeof senderId === 'number') {
    candidateIds.add(String(senderId))
  }

  if (typeof installationAccountId === 'number') {
    candidateIds.add(String(installationAccountId))
  }

  return Array.from(candidateIds)
}

export async function handleGithubInstallationWebhook(
  event: string,
  payload: string,
): Promise<{
  handled: boolean
  action: string | null
  installationId: string | null
  matchedUsers: number
}> {
  if (event !== 'installation' && event !== 'installation_repositories') {
    return {
      handled: false,
      action: null,
      installationId: null,
      matchedUsers: 0,
    }
  }

  const parsedPayload = asWebhookPayload(payload)
  if (!parsedPayload) {
    return {
      handled: false,
      action: null,
      installationId: null,
      matchedUsers: 0,
    }
  }

  const action = parsedPayload.action ?? null
  const installationIdRaw = parsedPayload.installation?.id
  const installationId =
    typeof installationIdRaw === 'number' ? String(installationIdRaw) : null

  if (!installationId) {
    return {
      handled: false,
      action,
      installationId: null,
      matchedUsers: 0,
    }
  }

  if (action === 'deleted') {
    await db
      .delete(githubInstallations)
      .where(eq(githubInstallations.githubInstallationId, installationId))

    return {
      handled: true,
      action,
      installationId,
      matchedUsers: 0,
    }
  }

  const candidateGithubIds = getWebhookCandidateGithubAccountIds(parsedPayload)
  if (!candidateGithubIds.length) {
    return {
      handled: false,
      action,
      installationId,
      matchedUsers: 0,
    }
  }

  const matchedUsers = await db
    .selectDistinct({ userId: account.userId })
    .from(account)
    .where(
      and(
        eq(account.providerId, 'github'),
        inArray(account.accountId, candidateGithubIds),
      ),
    )

  if (!matchedUsers.length) {
    return {
      handled: false,
      action,
      installationId,
      matchedUsers: 0,
    }
  }

  const accountLogin =
    parsedPayload.installation?.account?.login ??
    parsedPayload.sender?.login ??
    'unknown'
  const accountType =
    parsedPayload.installation?.account?.type ??
    parsedPayload.sender?.type ??
    'Unknown'

  await Promise.all(
    matchedUsers.map(({ userId }) =>
      db
        .insert(githubInstallations)
        .values({
          userId,
          githubInstallationId: installationId,
          accountLogin,
          accountType,
        })
        .onConflictDoUpdate({
          target: [
            githubInstallations.userId,
            githubInstallations.githubInstallationId,
          ],
          set: {
            accountLogin,
            accountType,
          },
        }),
    ),
  )

  return {
    handled: true,
    action,
    installationId,
    matchedUsers: matchedUsers.length,
  }
}

export function verifyGithubWebhookSignature(
  payload: string,
  signatureHeader: string | null,
): boolean {
  if (!signatureHeader?.startsWith('sha256=')) {
    return false
  }

  const secret = process.env.GITHUB_WEBHOOK_SECRET
  if (!secret) {
    console.error('GITHUB_WEBHOOK_SECRET is not set')
    return false
  }

  const digest = createHmac('sha256', secret).update(payload).digest('hex')
  const expected = `sha256=${digest}`

  const expectedBuffer = Buffer.from(expected)
  const providedBuffer = Buffer.from(signatureHeader)

  return (
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer)
  )
}

export function getGithubAuthRedirectUrl(
  returnTo: string,
  _userId: string,
): string {
  const baseUrl = getAppBaseUrl()
  const installPath = `/api/github/install/start?returnTo=${encodeURIComponent(sanitizeReturnTo(returnTo))}`

  return `${baseUrl}${installPath}`
}
