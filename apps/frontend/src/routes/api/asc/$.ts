import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'
import { db } from '@repo/db'
import { ascApiKeys } from '@repo/db/schema'
import { decrypt } from '@/lib/encrypt'
import { createAscJwt } from '@/lib/app-store-connect/jwt'
import { requireCurrentUserId } from '@/lib/auth.server'

const ASC_BASE = 'https://api.appstoreconnect.apple.com'

async function handleAscProxy(request: Request): Promise<Response> {
  const userId = await requireCurrentUserId()

  const url = new URL(request.url)
  const ascPath = url.pathname.replace(/^\/api\/asc/, '')
  if (!ascPath) {
    return new Response(JSON.stringify({ error: 'Missing ASC path' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const rows = await db
    .select()
    .from(ascApiKeys)
    .where(eq(ascApiKeys.userId, userId))
    .limit(1)
  const keyRow = rows[0]
  if (!keyRow) {
    return new Response(
      JSON.stringify({ error: 'No App Store Connect key configured' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const privateKey = decrypt(keyRow.encryptedPrivateKey)
  if (!privateKey) {
    return new Response(
      JSON.stringify({ error: 'Failed to decrypt API key' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const jwt = await createAscJwt(keyRow.issuerId, keyRow.keyId, privateKey)

  const targetUrl = `${ASC_BASE}${ascPath}${url.search}`
  const headers: Record<string, string> = {
    Authorization: `Bearer ${jwt}`,
    'Content-Type': 'application/json',
  }

  const fetchInit: RequestInit = {
    method: request.method,
    headers,
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    fetchInit.body = await request.text()
  }

  const ascResponse = await fetch(targetUrl, fetchInit)

  return new Response(ascResponse.body, {
    status: ascResponse.status,
    headers: {
      'Content-Type':
        ascResponse.headers.get('Content-Type') ?? 'application/json',
    },
  })
}

export const Route = createFileRoute('/api/asc/$')({
  server: {
    handlers: {
      GET: ({ request }) => handleAscProxy(request),
      POST: ({ request }) => handleAscProxy(request),
      PATCH: ({ request }) => handleAscProxy(request),
      DELETE: ({ request }) => handleAscProxy(request),
      PUT: ({ request }) => handleAscProxy(request),
    },
  },
})
