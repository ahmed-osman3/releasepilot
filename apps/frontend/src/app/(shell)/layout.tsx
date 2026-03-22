import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { ShellHeader } from '@/components/layout/shell-header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { assertAuthenticated } from '@/lib/auth-guard.server'
import { hasConnectedApps } from '@/server/apps-service'

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers()
  const { userId } = await assertAuthenticated(requestHeaders)
  if (!userId) {
    redirect('/auth')
  }

  const showSidebar = await hasConnectedApps(requestHeaders)
  if (!showSidebar) {
    return <main className="min-h-screen">{children}</main>
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-h-screen">
        <ShellHeader />
        <div className="flex-1 overflow-y-auto">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
