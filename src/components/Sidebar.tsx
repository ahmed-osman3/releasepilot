import { Link, useRouterState } from '@tanstack/react-router'
import { AppWindow, Key, Sparkles } from 'lucide-react'
import BetterAuthHeader from '../integrations/better-auth/header-user.tsx'

const navItems = [
  { to: '/apps', label: 'Apps', icon: AppWindow },
  { to: '/apps/connect', label: 'API Key', icon: Key },
] as const

export default function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname }) ?? ''

  return (
    <aside className="fixed top-0 left-0 h-screen w-[220px] bg-sidebar-bg border-r border-sidebar-border flex flex-col z-30">
      {/* Brand */}
      <div className="px-5 pt-6 pb-5">
        <Link to="/apps" className="flex items-center gap-2.5 group">
          <div className="size-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Sparkles className="size-4 text-primary" />
          </div>
          <span className="text-[15px] font-semibold text-foreground tracking-tight">
            ReleasePilot
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5">
        <span className="block text-[11px] font-medium text-muted-foreground/60 uppercase tracking-widest px-2.5 pb-2">
          Manage
        </span>
        {navItems.map((item) => {
          const isActive =
            item.to === '/apps'
              ? pathname === '/apps' || (pathname.startsWith('/apps/') && !pathname.startsWith('/apps/connect'))
              : pathname.startsWith(item.to)

          return (
            <Link
              key={item.to}
              to={item.to}
              className={`nav-glow flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                isActive
                  ? 'text-primary'
                  : 'text-sidebar-foreground hover:text-foreground'
              }`}
              data-active={isActive}
            >
              <item.icon className="size-4" />
              {item.label}
              {isActive && (
                <div className="ml-auto size-1.5 rounded-full bg-primary" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* User section */}
      <div className="px-4 py-4 border-t border-sidebar-border">
        <BetterAuthHeader />
      </div>
    </aside>
  )
}
