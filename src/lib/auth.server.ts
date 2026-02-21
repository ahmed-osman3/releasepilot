import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { getRequest } from '@tanstack/start-server-core'
import { db } from '@/db'
import * as schema from '@/db/schema'

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

  plugins: [tanstackStartCookies()],
})

export async function getCurrentUserId(): Promise<string | null> {
  const request = getRequest()
  const session = await auth.api.getSession({
    headers: request.headers,
  })

  return session?.user?.id ?? null
}

export async function requireCurrentUserId(): Promise<string> {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('Unauthorized')
  }

  return userId
}
