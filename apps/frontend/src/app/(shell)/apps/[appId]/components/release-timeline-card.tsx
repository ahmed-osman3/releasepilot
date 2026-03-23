import { AlertTriangle, CheckCircle2, Circle } from 'lucide-react'
import { CardShell } from './card-shell'
import type { DashboardTimelineItem } from './dashboard-types'

type ReleaseTimelineCardProps = {
  items: DashboardTimelineItem[]
}

const toneStyles = {
  ok: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25',
  warn: 'text-amber-300 bg-amber-500/10 border-amber-500/25',
  error: 'text-red-300 bg-red-500/10 border-red-500/25',
} as const

const toneIcon = {
  ok: CheckCircle2,
  warn: Circle,
  error: AlertTriangle,
} as const

export function ReleaseTimelineCard({ items }: ReleaseTimelineCardProps) {
  return (
    <CardShell
      title="Release Timeline"
      className="flex min-h-0 flex-1 flex-col"
      headerClassName="shrink-0"
      titleClassName="text-[1.7rem] lg:text-[1.85rem]"
      rightSlot={
        <button
          type="button"
          className="size-7 rounded-md border border-white/15 bg-white/[0.04]"
          aria-label="Card menu"
        />
      }
    >
      <div className="min-h-0 overflow-y-auto px-4 pb-2 lg:px-5 lg:pb-3" aria-label="Release timeline list">
        {items.map((item) => {
          const Icon = toneIcon[item.status]
          return (
            <div key={item.id} className="grid grid-cols-[auto_1fr] gap-3 border-b border-white/8 py-3 last:border-b-0 lg:grid-cols-[auto_1fr_auto]">
              <div className={`mt-0.5 inline-flex size-7 items-center justify-center rounded-full border ${toneStyles[item.status]}`}>
                <Icon className="size-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[1.1rem] font-medium leading-6 text-foreground">{item.title}</p>
                <p className="mt-0.5 text-sm leading-6 text-muted-foreground">{item.detail}</p>
              </div>
              <p className="pt-0.5 text-xs text-muted-foreground lg:text-right">{item.when}</p>
            </div>
          )
        })}
      </div>
    </CardShell>
  )
}
