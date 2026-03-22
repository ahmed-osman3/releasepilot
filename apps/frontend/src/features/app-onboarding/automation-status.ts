export type AutomationChecklistStepId =
  | 'app'
  | 'github_repo'
  | 'github_branch'
  | 'localizations'

export type AutomationChecklistStep = {
  id: AutomationChecklistStepId
  title: string
  description: string
  complete: boolean
  optional: boolean
}

export type AutomationOnboardingStatus = {
  steps: AutomationChecklistStep[]
  nextStepId: AutomationChecklistStepId | null
  completedCount: number
  totalCount: number
  isComplete: boolean
  shouldAutoOpen: boolean
}

export function deriveAutomationOnboardingStatus(input: {
  appStoreAppId: string | null
  githubInstallationId: string | null
  githubRepoFullName: string | null
  watchedBranch: string | null
  automationLocales: string[]
}): AutomationOnboardingStatus {
  const hasApp = Boolean(input.appStoreAppId)
  const hasRepo = Boolean(input.githubInstallationId && input.githubRepoFullName)
  const hasBranch = Boolean(input.watchedBranch)
  const hasLocales = input.automationLocales.length > 0

  const steps: AutomationChecklistStep[] = [
    {
      id: 'app',
      title: 'App Store app connected',
      description: 'The app is linked and ready for dashboard use.',
      complete: hasApp,
      optional: false,
    },
    {
      id: 'github_repo',
      title: 'Choose GitHub repository',
      description: 'Connect the repository automation should watch.',
      complete: hasRepo,
      optional: true,
    },
    {
      id: 'github_branch',
      title: 'Choose watched branch',
      description: 'Pick the branch used for repository-aware automation.',
      complete: hasRepo && hasBranch,
      optional: true,
    },
    {
      id: 'localizations',
      title: 'Choose localization scope',
      description: 'Select the locales automation should target first.',
      complete: hasLocales,
      optional: true,
    },
  ]

  const nextIncompleteStep = steps.find((step) => !step.complete) ?? null
  const completedCount = steps.filter((step) => step.complete).length

  return {
    steps,
    nextStepId: nextIncompleteStep?.id ?? null,
    completedCount,
    totalCount: steps.length,
    isComplete: completedCount === steps.length,
    shouldAutoOpen: completedCount < steps.length,
  }
}
