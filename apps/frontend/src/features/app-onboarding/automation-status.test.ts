import { describe, expect, it } from 'vitest'
import { deriveAutomationOnboardingStatus } from '@/features/app-onboarding/automation-status'

describe('deriveAutomationOnboardingStatus', () => {
  it('marks all steps complete when repo, branch, and locales exist', () => {
    const status = deriveAutomationOnboardingStatus({
      appStoreAppId: '123',
      githubInstallationId: 'inst_1',
      githubRepoFullName: 'acme/releasepilot',
      watchedBranch: 'main',
      automationLocales: ['en-US'],
    })

    expect(status.isComplete).toBe(true)
    expect(status.completedCount).toBe(4)
    expect(status.nextStepId).toBeNull()
  })

  it('points to the next missing automation step', () => {
    const status = deriveAutomationOnboardingStatus({
      appStoreAppId: '123',
      githubInstallationId: null,
      githubRepoFullName: null,
      watchedBranch: null,
      automationLocales: [],
    })

    expect(status.isComplete).toBe(false)
    expect(status.nextStepId).toBe('github_repo')
    expect(status.shouldAutoOpen).toBe(true)
  })
})
