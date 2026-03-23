import { cleanup, render, screen } from '@testing-library/react'
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
  versionString: '1.2.0',
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

describe('OverviewClient onboarding + post-onboarding dashboard', () => {
  it('keeps onboarding UI for apps that have not activated automation', () => {
    render(<OverviewClient {...baseProps} automationActivatedAt={null} />)

    expect(screen.getByText('Set up your first automated release')).toBeTruthy()
    expect(screen.getByText('Automation Setup')).toBeTruthy()
    expect(screen.getAllByText('Choose GitHub repository').length).toBeGreaterThan(0)
  })

  it('renders dashboard cards once automation is activated', () => {
    render(
      <OverviewClient
        {...baseProps}
        githubRepoFullName="acme/releasepilot"
        watchedBranch="main"
        githubInstallationId="inst_1"
        automationLocales={['en-US']}
        automationActivatedAt="2026-03-19T10:00:00.000Z"
      />,
    )

    expect(screen.getByRole('heading', { name: 'Deenya' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Action Required' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Release Timeline' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'GitHub' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Build' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Controls' })).toBeTruthy()
    expect(screen.getByText('acme/releasepilot')).toBeTruthy()
  })

  it('shows fallback placeholder text for missing PR and build data on dashboard', () => {
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

    expect(screen.getAllByText('PR #42').length).toBeGreaterThan(0)
    expect(screen.getByText('Build 45')).toBeTruthy()
  })

  it('renders visual-only action buttons with disabled-intent attributes', () => {
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

    expect(screen.getByRole('button', { name: 'Review PR' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Approve & Continue' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'View pull request' }).getAttribute('aria-disabled')).toBe(
      'true',
    )
    expect(screen.getByRole('button', { name: 'View in TestFlight' }).getAttribute('aria-disabled')).toBe(
      'true',
    )
  })
})
