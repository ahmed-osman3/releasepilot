import { describe, expect, it, beforeEach } from 'vitest'
import { createHmac } from 'node:crypto'
import {
  beginGithubAppInstall,
  decodeState,
  verifyGithubWebhookSignature,
} from './server'

describe('github server helpers', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = 'test-secret'
    process.env.GITHUB_APP_SLUG = 'releasepilot'
  })

  it('creates signed install URL state for current user', () => {
    const url = beginGithubAppInstall('/apps/add', 'user_123')
    const parsed = new URL(url)

    expect(parsed.hostname).toBe('github.com')
    expect(parsed.pathname).toContain('/apps/releasepilot/installations/new')

    const state = parsed.searchParams.get('state')
    expect(state).toBeTruthy()

    const decoded = decodeState(state!)
    expect(decoded.userId).toBe('user_123')
    expect(decoded.returnTo).toBe('/apps/add')
    expect(decoded.exp).toBeGreaterThan(Date.now())
  })

  it('validates webhook signatures', () => {
    process.env.GITHUB_WEBHOOK_SECRET = 'webhook-secret'
    const payload = '{"test":true}'
    const digest = createHmac('sha256', 'webhook-secret')
      .update(payload)
      .digest('hex')
    const signature = `sha256=${digest}`

    const valid = verifyGithubWebhookSignature(payload, signature)

    const invalid = verifyGithubWebhookSignature(payload, 'sha256=bad')

    expect(valid).toBe(true)
    expect(invalid).toBe(false)
  })
})
