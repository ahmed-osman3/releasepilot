import { BadgeCheck } from 'lucide-react'
import type { DashboardViewModel } from './dashboard-types'
import { Card } from './Card'

type OverviewHeroCardProps = {
  model: Pick<
    DashboardViewModel,
    | 'appName'
    | 'appIdentifier'
    | 'appInitial'
    | 'iconUrl'
    | 'statusLabel'
    | 'versionLabel'
    | 'branchLabel'
    | 'lastUpdatedLabel'
  >
}

export function OverviewHeroCard({ model }: OverviewHeroCardProps) {
  return (
    <div className="px-5 py-4 lg:px-6 lg:py-5">
      <div className="flex items-center gap-3.5">
        {model.iconUrl ? (
          <img
            src={model.iconUrl}
            alt={`${model.appName} icon`}
            className="size-14 rounded-[18px] object-cover shadow-sm"
          />
        ) : (
          <div className="flex size-14 items-center justify-center rounded-[18px] bg-[linear-gradient(180deg,rgba(53,59,84,0.92),rgba(34,39,60,0.88))] text-xl font-semibold text-foreground">
            {model.appInitial}
          </div>
        )}

        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="min-w-0 font-display text-2xl font-semibold leading-none tracking-tight text-foreground ">
              {model.appName}
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/15 px-2.5 py-1 text-sm font-medium uppercase tracking-[0.04em] text-amber-200">
              <BadgeCheck className="size-3" />
              {model.statusLabel}
            </span>
          </div>
          <p className="truncate font-mono text-xs text-muted-foreground">
            {model.appIdentifier}
          </p>
          <p className="text-base leading-relaxed text-muted-foreground text-sm">
            {model.versionLabel}
            <span className="mx-2 text-muted-foreground/40">•</span>
            {model.branchLabel}
            <span className="mx-2 text-muted-foreground/40">•</span>
            Last updated: {model.lastUpdatedLabel}
          </p>
        </div>
      </div>
    </div>
  )
}
