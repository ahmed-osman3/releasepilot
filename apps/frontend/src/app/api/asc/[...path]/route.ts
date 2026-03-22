import { eq } from 'drizzle-orm'
import { db } from '@repo/db'
import { ascApiKeys } from '@repo/db/schema'
import { decrypt } from '@/lib/encrypt'
import { createAscJwt } from '@/lib/asc/jwt'
import { requireCurrentUserId } from '@/lib/auth.server'

const ASC_BASE = 'https://api.appstoreconnect.apple.com'

async function handleAscProxy(request: Request, params: { path: string[] }) {
  const userId = await requireCurrentUserId(request.headers)
  const ascPath = `/${(params.path ?? []).join('/')}`

  if (!ascPath || ascPath === '/') {
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
    return new Response(JSON.stringify({ error: 'Failed to decrypt API key' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const jwt = await createAscJwt(keyRow.issuerId, keyRow.keyId, privateKey)

  const url = new URL(request.url)
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
      'Content-Type': ascResponse.headers.get('Content-Type') ?? 'application/json',
    },
  })
}

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return handleAscProxy(request, await context.params)
}

export async function POST(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return handleAscProxy(request, await context.params)
}

export async function PATCH(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return handleAscProxy(request, await context.params)
}

export async function PUT(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return handleAscProxy(request, await context.params)
}

export async function DELETE(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return handleAscProxy(request, await context.params)
}
