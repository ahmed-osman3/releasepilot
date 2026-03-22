import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { deriveAutomationOnboardingStatus } from '@/features/app-onboarding/automation-status'
import OverviewClient from './OverviewClient'

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}))

const baseProps = {
  connectedAppId: 42,
  appName: 'Deenya',
  bundleId: 'com.example.deenya',
  iconUrl: null,
  reviewState: null,
  rejectionReason: null,
  versionString: '1.0',
  timelineEvents: [],
  githubRepoFullName: null,
  watchedBranch: null,
  githubInstallationId: null,
  automationLocales: [],
  automationActivatedAt: null,
  onboardingStatus: deriveAutomationOnboardingStatus({
    appStoreAppId: '123',
    githubInstallationId: null,
    githubRepoFullName: null,
    watchedBranch: null,
    automationLocales: [],
  }),
  error: null,
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('OverviewClient automation onboarding', () => {
  it('auto-opens the automation panel when onboarding is incomplete', () => {
    render(<OverviewClient {...baseProps} />)

    expect(screen.getByText('Set up your first automated release')).toBeTruthy()
    expect(screen.getByText('Automation Setup')).toBeTruthy()
    expect(screen.getAllByText('Choose GitHub repository').length).toBeGreaterThan(0)
  })

  it('hides the onboarding flow once automation has started', () => {
    render(
      <OverviewClient
        {...baseProps}
        onboardingStatus={deriveAutomationOnboardingStatus({
          appStoreAppId: '123',
          githubInstallationId: 'inst_1',
          githubRepoFullName: 'acme/releasepilot',
          watchedBranch: 'main',
          automationLocales: ['en-US'],
        })}
        githubInstallationId="inst_1"
        githubRepoFullName="acme/releasepilot"
        watchedBranch="main"
        automationLocales={['en-US']}
        automationActivatedAt="2026-03-19T10:00:00.000Z"
      />,
    )

    expect(screen.queryByText('Set up your first automated release')).toBeNull()
    expect(screen.queryByText('Automation Setup')).toBeNull()
    expect(screen.getByText('Automation Timeline')).toBeTruthy()
  })

  it('shows begin automating CTA when setup is complete but automation has not started', () => {
    render(
      <OverviewClient
        {...baseProps}
        onboardingStatus={deriveAutomationOnboardingStatus({
          appStoreAppId: '123',
          githubInstallationId: 'inst_1',
          githubRepoFullName: 'acme/releasepilot',
          watchedBranch: 'main',
          automationLocales: ['en-US'],
        })}
        githubInstallationId="inst_1"
        githubRepoFullName="acme/releasepilot"
        watchedBranch="main"
        automationLocales={['en-US']}
        automationActivatedAt={null}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /automation setup complete/i }))

    expect(screen.getAllByRole('button', { name: /begin automating/i }).length).toBeGreaterThan(0)
    expect(screen.queryByText('Automation Timeline')).toBeNull()
  })
})
