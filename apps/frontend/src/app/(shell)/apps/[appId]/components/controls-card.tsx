import { Pause, RefreshCw } from 'lucide-react'
import { CardShell } from './card-shell'
import type { DashboardViewModel } from './dashboard-types'

type ControlsCardProps = {
  model: Pick<DashboardViewModel, 'modeLabel' | 'lastRunLabel'>
}

export function ControlsCard({ model }: ControlsCardProps) {
  return (
    <CardShell title="Controls" titleClassName="text-[1.5rem]">
      <div className="space-y-2.5 p-3.5 lg:p-4">
        <button
          type="button"
          className="inline-flex h-10 w-full items-center justify-center gap-2.5 rounded-xl border border-white/15 bg-white/[0.05] px-3.5 text-sm font-medium text-foreground"
          aria-disabled="true"
        >
          <span className="flex items-center gap-2">
            <RefreshCw className="size-3.5" />
            Run again
          </span>
          <span className="text-muted-foreground">|</span>
          <span className="flex items-center gap-2">
            <Pause className="size-3.5" />
            Pause automation
          </span>
        </button>

        <button
          type="button"
          className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.05] px-4 text-sm font-medium text-foreground"
          aria-disabled="true"
        >
          Retry failed step
        </button>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3 text-xs leading-6 text-muted-foreground">
          <p>
            Automation mode: <span className="text-cyan-300">{model.modeLabel}</span>
          </p>
          <p className="mt-1">
            Last run: <span className="text-foreground">{model.lastRunLabel}</span>
          </p>
        </div>
      </div>
    </CardShell>
  )
}
