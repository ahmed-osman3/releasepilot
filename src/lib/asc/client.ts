import { AsyncLocalStorage } from 'node:async_hooks'
import { createPrivateKey, sign } from 'node:crypto'
import { networkError, parseAscError, type AscError } from './errors'

const ASC_BASE = 'https://api.appstoreconnect.apple.com'
const ASC_AUDIENCE = 'appstoreconnect-v1'
const TOKEN_LIFETIME_MS = 15 * 60 * 1000
const MAX_RETRIES = 3

type AscCredentialContext = {
  issuerId: string
  keyId: string
  privateKey: string
  scope: string
}

const credentialStorage = new AsyncLocalStorage<AscCredentialContext>()
const tokenCache = new Map<string, { jwt: string; expiresAt: number }>()

export class AscApiError extends Error {
  readonly ascError: AscError

  constructor(ascError: AscError) {
    super(ascError.message)
    this.name = 'AscApiError'
    this.ascError = ascError
  }
}

function base64url(data: Buffer | string): string {
  const buffer = typeof data === 'string' ? Buffer.from(data) : data
  return buffer.toString('base64url')
}

function generateAscJwt(
  issuerId: string,
  keyId: string,
  privateKeyPem: string,
): string {
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(
    JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' }),
  )
  const payload = base64url(
    JSON.stringify({
      iss: issuerId,
      iat: now,
      exp: now + TOKEN_LIFETIME_MS / 1000,
      aud: ASC_AUDIENCE,
    }),
  )

  const signingInput = `${header}.${payload}`
  const key = createPrivateKey({
    key: privateKeyPem,
    format: 'pem',
    type: 'pkcs8',
  })
  const signature = sign('SHA256', Buffer.from(signingInput), {
    key,
    dsaEncoding: 'ieee-p1363',
  })

  return `${signingInput}.${base64url(signature)}`
}

function getCredentials(): AscCredentialContext {
  const credentials = credentialStorage.getStore()
  if (!credentials) {
    throw new Error('No active ASC credentials configured')
  }

  return credentials
}

export function getAscCacheScope(): string {
  return getCredentials().scope
}

function getToken(): string {
  const credentials = getCredentials()
  const cachedToken = tokenCache.get(credentials.scope)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.jwt
  }

  const jwt = generateAscJwt(
    credentials.issuerId,
    credentials.keyId,
    credentials.privateKey,
  )

  tokenCache.set(credentials.scope, {
    jwt,
    expiresAt: Date.now() + TOKEN_LIFETIME_MS,
  })

  return jwt
}

export async function runWithAscCredentials<T>(
  credentials: AscCredentialContext,
  fn: () => Promise<T>,
): Promise<T> {
  return credentialStorage.run(credentials, fn)
}

export function resetToken(scope?: string): void {
  if (scope) {
    tokenCache.delete(scope)
    return
  }

  tokenCache.clear()
}

export async function ascFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const token = getToken()
  let lastError: Error | null = null

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    let response: Response

    try {
      response = await fetch(`${ASC_BASE}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      })
    } catch {
      throw new AscApiError(networkError())
    }

    if (response.ok) {
      if (response.status === 204) return null as T
      return response.json() as Promise<T>
    }

    if (response.status === 429) {
      const delay = 2 ** attempt * 1000
      await new Promise((resolve) => setTimeout(resolve, delay))
      continue
    }

    const text = await response.text().catch(() => '')
    const method = options?.method ?? 'GET'
    const ascError = parseAscError(response.status, text)
    ascError.method = method
    ascError.path = path
    lastError = new AscApiError(ascError)
    break
  }

  throw lastError ?? new AscApiError({ category: 'api', message: 'ASC API request failed' })
}
