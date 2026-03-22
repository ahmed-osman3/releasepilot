import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { eq } from 'drizzle-orm'
import { db } from '@repo/db'
import * as schema from '@repo/db/schema'

const githubClientId = process.env.GITHUB_CLIENT_ID ?? process.env.GITHUB_APP_CLIENT_ID
const githubClientSecret =
  process.env.GITHUB_CLIENT_SECRET ?? process.env.GITHUB_APP_CLIENT_SECRET
const baseURL =
  process.env.APP_BASE_URL ?? process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'
const trustedOrigins =
  baseURL.includes('localhost') || baseURL.includes('127.0.0.1')
    ? ['http://localhost:3000', 'http://127.0.0.1:3000']
    : undefined

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET ?? process.env.AUTH_SECRET,
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    github: {
      clientId: githubClientId ?? '',
      clientSecret: githubClientSecret ?? '',
      redirectURI: `${baseURL}/api/auth/callback/github`,
    },
  },
})

export async function getCurrentUserId(requestHeaders: HeadersInit): Promise<string | null> {
  const session = await auth.api.getSession({
    headers: new Headers(requestHeaders),
  })

  const userId = session?.user?.id
  if (!userId) {
    return null
  }

  const existingUser = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1)

  if (!existingUser[0]) {
    return null
  }

  return userId
}

export async function requireCurrentUserId(requestHeaders: HeadersInit): Promise<string> {
  const userId = await getCurrentUserId(requestHeaders)
  if (!userId) {
    throw new Error('Unauthorized')
  }

  return userId
}
