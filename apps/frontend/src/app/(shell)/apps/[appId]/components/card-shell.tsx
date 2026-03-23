import { type ReactNode } from 'react'

type CardShellProps = {
  title?: string
  rightSlot?: ReactNode
  children: ReactNode
  className?: string
  headerClassName?: string
  titleClassName?: string
}

const baseCardClass =
  'overflow-hidden rounded-[22px] border border-white/12 bg-[radial-gradient(120%_120%_at_50%_-30%,rgba(88,102,255,0.16),transparent_62%),linear-gradient(180deg,rgba(14,16,30,0.96),rgba(10,12,24,0.98))] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_18px_50px_rgba(0,0,0,0.38)]'

export function CardShell({
  title,
  rightSlot,
  children,
  className,
  headerClassName,
  titleClassName,
}: CardShellProps) {
  return (
    <section className={[baseCardClass, className].filter(Boolean).join(' ')}>
      {title ? (
        <header
          className={[
            'flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3 ',
            headerClassName,
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <h2
            className={['text-lg font-medium tracking-tight text-foreground', titleClassName]
              .filter(Boolean)
              .join(' ')}
          >
            {title}
          </h2>
          {rightSlot ? <div>{rightSlot}</div> : null}
        </header>
      ) : null}
      <div>{children}</div>
    </section>
  )
}
