import { AlertTriangle, EllipsisVertical } from 'lucide-react'
import { CardShell } from './card-shell'
import type { DashboardViewModel } from './dashboard-types'
import { Button } from '@/components/ui/button'

type ActionRequiredCardProps = {
  model: Pick<DashboardViewModel, 'actionTitle' | 'actionDescription'>
}

export function ActionRequiredCard({ model }: ActionRequiredCardProps) {
  return (
    <div className="px-5 py-4 lg:px-6 lg:py-5 rounded-2xl border border-white/10 bg-white/[0.02] shadow-sm">
      <div className="flex flex-row items-center justify-between p-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-3.5 text-warning" />
          <h2 className="text-md font-semibold leading-tight text-foreground">Action Required</h2>
        </div>
        <Button variant="ghost">
          <EllipsisVertical className="size-3.5 text-foreground" />
        </Button>
      </div>

      <div className="rounded-xl flex flex-col border border-white/10 p-5 shadow-md gap-8">
        <div className='flex flex-col gap-2'>
          <p className="text-lg font-semibold leading-tight text-foreground">{model.actionTitle}</p>
          <p className="text-sm font-normal leading-tight text-foreground">{model.actionDescription}</p>
        </div>

        <div className="flex items-center justify-between gap-4">
          <Button
            variant="ghost"
            className="h-14 w-[190px] rounded-2xl border border-white/14 bg-[linear-gradient(180deg,rgba(48,50,68,0.72),rgba(34,36,52,0.72))] px-9 text-[0.95rem] font-medium text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:bg-[linear-gradient(180deg,rgba(54,56,76,0.84),rgba(38,40,58,0.84))]"
          >
            Review PR
          </Button>
          <Button
            variant="default"
            className="h-14 min-w-[190px] rounded-2xl border border-indigo-300/30 bg-[linear-gradient(180deg,rgba(104,112,255,0.98),rgba(87,101,245,0.94))] px-10 text-[0.95rem] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_16px_32px_rgba(74,86,220,0.28)] hover:bg-[linear-gradient(180deg,rgba(110,118,255,1),rgba(92,106,248,0.97))]"
          >
            Approve & Continue
          </Button>
        </div>
      </div>
    </div>
  )
}
