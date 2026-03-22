'use client'

import { ArrowRight, CheckCircle2, Circle, GitBranch, Github, Languages, Rocket } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type {
  AutomationChecklistStepId,
  AutomationOnboardingStatus,
} from '@/features/app-onboarding/automation-status'

const STEP_ICONS: Record<AutomationChecklistStepId, typeof Rocket> = {
  app: Rocket,
  github_repo: Github,
  github_branch: GitBranch,
  localizations: Languages,
}

export function AutomationChecklistCard({
  status,
  isStartingAutomation,
  isAutomationActivated,
  onBeginAutomation,
  onOpenStep,
}: {
  status: AutomationOnboardingStatus
  isStartingAutomation: boolean
  isAutomationActivated: boolean
  onBeginAutomation: () => void
  onOpenStep: (stepId: AutomationChecklistStepId) => void
}) {
  const nextIncompleteStep =
    status.steps.find((step) => step.id === status.nextStepId) ?? null

  return (
    <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(102,126,234,0.22),transparent_38%),linear-gradient(180deg,rgba(16,18,31,0.98),rgba(10,12,22,0.96))] shadow-[0_28px_100px_rgba(0,0,0,0.4)]">
      <div className="border-b border-white/8 px-6 py-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary/85">
              Automation Overview
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-foreground">
              Set up your first automated release
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Add automation only where you want it. The app dashboard works right away, and
              the steps below unlock repository-aware release workflows inside this panel.
            </p>
          </div>

          <div
            className={`w-full max-w-sm rounded-2xl border p-5 ${
              status.isComplete
                ? 'border-emerald-500/20 bg-[linear-gradient(180deg,rgba(11,46,38,0.58),rgba(10,24,22,0.48))]'
                : 'border-white/10 bg-white/[0.04]'
            }`}
          >
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {status.isComplete ? 'Onboarding Status' : 'Next Step'}
            </p>
            <p className="mt-3 text-xl font-semibold text-foreground">
              {status.isComplete
                ? 'Setup complete'
                : nextIncompleteStep?.title ?? 'Automation is configured'}
            </p>
            <p
              className={`mt-2 text-sm ${
                status.isComplete ? 'text-emerald-100/70' : 'text-muted-foreground'
              }`}
            >
              {status.isComplete
                ? 'All onboarding steps are complete and the setup flow is greenlit.'
                : nextIncompleteStep?.description ??
                  'You can keep using the dashboard normally or revisit setup any time.'}
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-lg font-semibold text-foreground">Setup progress</p>
            <p className="text-sm text-muted-foreground">
              {status.completedCount} of {status.totalCount} steps completed
            </p>
          </div>
          <p className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {Math.round((status.completedCount / status.totalCount) * 100)}% ready
          </p>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,rgba(90,119,255,0.82),rgba(91,211,255,0.82))] transition-[width] duration-500 ease-out"
            style={{ width: `${(status.completedCount / status.totalCount) * 100}%` }}
          />
        </div>

        <div className="mt-6 space-y-3">
          {status.isComplete ? (
            <div className="animate-fade-in-up space-y-4">
              <button
                type="button"
                onClick={() => onOpenStep('localizations')}
                className="flex w-full items-center justify-between gap-4 rounded-2xl border border-emerald-500/18 bg-[linear-gradient(180deg,rgba(11,46,38,0.5),rgba(10,24,22,0.45))] px-4 py-4 text-left transition hover:border-emerald-400/30 hover:bg-[linear-gradient(180deg,rgba(13,58,47,0.56),rgba(10,28,25,0.5))]"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-500/16 text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.15)]">
                    <CheckCircle2 className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">Automation setup complete</p>
                    <p className="mt-1 text-sm text-emerald-100/70">
                      Repository, branch, and localization scope are configured and ready to launch.
                    </p>
                  </div>
                </div>

                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                  <CheckCircle2 className="size-3.5" />
                  Greenlit
                </span>
              </button>

              {!isAutomationActivated ? (
                <div className="flex justify-center">
                  <Button
                    type="button"
                    className="min-w-56 rounded-xl px-6"
                    onClick={onBeginAutomation}
                    disabled={isStartingAutomation}
                  >
                    <Rocket className={`size-4 ${isStartingAutomation ? 'launch-rocket' : ''}`} />
                    {isStartingAutomation ? 'Launching automation...' : 'Begin automating'}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            status.steps.map((step, index) => {
              const Icon = STEP_ICONS[step.id]

              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => onOpenStep(step.id)}
                  className="animate-fade-in-up flex w-full items-center justify-between gap-4 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-left transition hover:border-primary/25 hover:bg-white/[0.05]"
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div
                      className={`flex size-11 items-center justify-center rounded-2xl ${
                        step.complete
                          ? 'bg-emerald-500/14 text-emerald-400'
                          : 'bg-white/6 text-muted-foreground'
                      }`}
                    >
                      <Icon className="size-5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{step.title}</p>
                        {step.optional ? (
                          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                            Automation
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {step.complete ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                        <CheckCircle2 className="size-3.5" />
                        Complete
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-muted-foreground">
                        <Circle className="size-3.5" />
                        Pending
                      </span>
                    )}
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>
    </section>
  )
}
