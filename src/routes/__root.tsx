import '@/lib/asc-client'

import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouterState,
} from '@tanstack/react-router'

import Sidebar from '../components/Sidebar'

import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'ReleasePilot',
      },
      {
        name: 'description',
        content: 'AI-powered App Store submission management',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  component: RootLayout,
  shellComponent: RootDocument,
})

function RootLayout() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const hideShell = pathname === '/auth'

  if (hideShell) {
    return (
      <main className="min-h-screen">
        <Outlet />
      </main>
    )
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-[220px] min-h-screen">
        <Outlet />
        <TanStackRouterDevtools />
      </main>
    </div>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
