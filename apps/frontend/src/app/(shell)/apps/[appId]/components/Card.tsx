import { cn } from '@/lib/utils'

export function Card({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return <section className={cn('rounded-2xl border border-white/10 p-4', className)}>{children}</section>
}
