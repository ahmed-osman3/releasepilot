import { Link } from '@tanstack/react-router'

import BetterAuthHeader from '../integrations/better-auth/header-user.tsx'

import { useState } from 'react'
import { AppWindow, Home, Menu, X } from 'lucide-react'

const navLinkClass =
  'flex items-center gap-3 p-3 rounded-lg transition-colors mb-2'
const navLinkActiveClass =
  'flex items-center gap-3 p-3 rounded-lg bg-primary text-primary-foreground mb-2'

export default function Header() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-border bg-card px-4 shadow-sm">
        <button
          onClick={() => setIsOpen(true)}
          className="p-2 rounded-lg text-foreground hover:bg-muted transition-colors md:hidden"
          aria-label="Open menu"
        >
          <Menu size={24} />
        </button>
        <Link
          to="/"
          className="text-xl font-semibold text-foreground hover:opacity-90 transition-opacity"
        >
          ReleasePilot
        </Link>
        <nav className="ml-8 hidden md:flex items-center gap-1">
          <Link
            to="/"
            className="px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors font-medium"
            activeProps={{
              className: 'px-3 py-2 rounded-lg bg-primary text-primary-foreground font-medium',
            }}
          >
            Home
          </Link>
          <Link
            to="/apps"
            className="px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors font-medium"
            activeProps={{
              className: 'px-3 py-2 rounded-lg bg-primary text-primary-foreground font-medium',
            }}
          >
            Apps
          </Link>
        </nav>
        <div className="ml-auto">
          <BetterAuthHeader />
        </div>
      </header>

      <aside
        className={`fixed top-0 left-0 h-full w-72 bg-sidebar text-sidebar-foreground shadow-xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col md:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
          <span className="text-lg font-semibold">Menu</span>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 rounded-lg hover:bg-sidebar-accent transition-colors"
            aria-label="Close menu"
          >
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <Link
            to="/"
            onClick={() => setIsOpen(false)}
            className={navLinkClass + ' hover:bg-sidebar-accent'}
            activeProps={{ className: navLinkActiveClass }}
          >
            <Home size={20} />
            <span className="font-medium">Home</span>
          </Link>

          <Link
            to="/apps"
            onClick={() => setIsOpen(false)}
            className={navLinkClass + ' hover:bg-sidebar-accent'}
            activeProps={{ className: navLinkActiveClass }}
          >
            <AppWindow size={20} />
            <span className="font-medium">Apps</span>
          </Link>
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <BetterAuthHeader />
        </div>
      </aside>

      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          aria-hidden
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  )
}
