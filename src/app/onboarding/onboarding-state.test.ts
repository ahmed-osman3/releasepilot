import { describe, expect, it } from 'vitest'
import {
  canAdvanceFromTeamName,
  hasAscFormFields,
  resolveGithubInstallStatus,
} from './onboarding-state'

describe('resolveGithubInstallStatus', () => {
  it('returns installed when github=installed', () => {
    const params = new URLSearchParams('github=installed')
    expect(resolveGithubInstallStatus(params)).toEqual({ kind: 'installed' })
  })

  it('returns failed with message when github=install_failed', () => {
    const params = new URLSearchParams('github=install_failed&message=Install%20failed')
    expect(resolveGithubInstallStatus(params)).toEqual({
      kind: 'failed',
      message: 'Install failed',
    })
  })

  it('returns auth_required when github=auth_required', () => {
    const params = new URLSearchParams('github=auth_required')
    expect(resolveGithubInstallStatus(params)).toEqual({ kind: 'auth_required' })
  })

  it('returns idle when github param is missing', () => {
    const params = new URLSearchParams('foo=bar')
    expect(resolveGithubInstallStatus(params)).toEqual({ kind: 'idle' })
  })
})

describe('validation helpers', () => {
  it('only advances from team step when name is non-empty', () => {
    expect(canAdvanceFromTeamName('My Team')).toBe(true)
    expect(canAdvanceFromTeamName('   ')).toBe(false)
  })

  it('requires all ASC fields', () => {
    expect(
      hasAscFormFields({
        issuerId: 'issuer',
        keyId: 'key',
        privateKey: 'private key',
      }),
    ).toBe(true)

    expect(
      hasAscFormFields({
        issuerId: 'issuer',
        keyId: '',
        privateKey: 'private key',
      }),
    ).toBe(false)
  })
})
