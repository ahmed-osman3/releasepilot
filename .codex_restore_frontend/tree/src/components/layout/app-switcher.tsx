"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, usePathname, useRouter } from "next/navigation"
import { ChevronsUpDown, Plus, Search } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { getLastAppId, setLastAppId } from "@/lib/nav-state"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

type ConnectedApp = {
  id: number
  name: string | null
  appStoreAppId: string | null
  iconUrl: string | null
}

export function AppSwitcher() {
  const router = useRouter()
  const pathname = usePathname()
  const { appId } = useParams<{ appId?: string }>()
  const [apps, setApps] = useState<ConnectedApp[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    let active = true

    async function loadApps() {
      try {
        const response = await fetch("/api/apps/connected")
        if (!response.ok) return
        const json = (await response.json()) as { apps?: ConnectedApp[] }
        if (!active) return
        setApps(json.apps ?? [])
      } finally {
        if (active) setLoading(false)
      }
    }

    loadApps()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (appId) {
      setLastAppId(appId)
    }
  }, [appId])

  const activeApp = useMemo(() => {
    const selected = appId
      ? apps.find((app) => String(app.id) === appId)
      : undefined

    if (selected) return selected

    const lastAppId = getLastAppId()
    if (lastAppId) {
      const last = apps.find((app) => String(app.id) === lastAppId)
      if (last) return last
    }

    return apps[0]
  }, [appId, apps])

  const filteredApps = useMemo(() => {
    if (!search) return apps
    const q = search.toLowerCase()
    return apps.filter((app) => {
      const name = app.name?.toLowerCase() ?? ""
      const appStoreAppId = app.appStoreAppId?.toLowerCase() ?? ""
      return name.includes(q) || appStoreAppId.includes(q)
    })
  }, [apps, search])

  function buildAppUrl(targetAppId: string): string {
    if (!appId) return `/apps/${targetAppId}`

    const subpath = pathname
      .replace(`/apps/${appId}`, "")
      .replace(/^\//, "")

    return subpath
      ? `/apps/${targetAppId}/${subpath}`
      : `/apps/${targetAppId}`
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              suppressHydrationWarning
            >
              {loading ? (
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-muted">
                  <Spinner className="text-muted-foreground" />
                </div>
              ) : activeApp?.iconUrl ? (
                <img
                  src={activeApp.iconUrl}
                  alt={activeApp.name ?? "App icon"}
                  className="size-8 rounded-lg object-cover"
                />
              ) : (
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground">
                  {activeApp?.name?.charAt(0).toUpperCase() ?? "A"}
                </div>
              )}
              <span className="truncate font-semibold text-sm">
                {activeApp?.name ?? "Select an app"}
              </span>
              <ChevronsUpDown className="ml-auto" size={16} />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side="right"
            sideOffset={4}
            onCloseAutoFocus={() => setSearch("")}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Apps
            </DropdownMenuLabel>
            {apps.length > 5 && (
              <div className="px-2 pb-1">
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    onKeyDown={(event) => event.stopPropagation()}
                    placeholder="Search apps..."
                    className="h-8 w-full rounded-md border bg-transparent pl-8 pr-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                    autoFocus
                  />
                </div>
              </div>
            )}
            <div className="px-1 pb-1">
              <DropdownMenuItem
                onClick={() => router.push("/apps/add")}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Plus className="size-3.5" />
                </div>
                <div className="grid flex-1 leading-tight">
                  <span className="truncate font-medium">Add app</span>
                  <span className="truncate text-xs text-muted-foreground">
                    Connect another app
                  </span>
                </div>
              </DropdownMenuItem>
            </div>
            <DropdownMenuSeparator />
            <div className="max-h-72 overflow-y-auto">
              {apps.length === 0 && !loading && (
                <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                  No apps found
                </div>
              )}
              {filteredApps.length === 0 && search && (
                <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                  No matching apps
                </div>
              )}
              {filteredApps.map((app) => (
                <DropdownMenuItem
                  key={app.id}
                  onClick={() => {
                    const target = String(app.id)
                    setLastAppId(target)
                    router.push(buildAppUrl(target))
                  }}
                  className="gap-2 p-2"
                >
                  {app.iconUrl ? (
                    <img
                      src={app.iconUrl}
                      alt={app.name ?? "App icon"}
                      className="size-6 rounded-md object-cover"
                    />
                  ) : (
                    <div className="flex size-6 items-center justify-center rounded-md bg-muted text-[10px] font-semibold text-muted-foreground">
                      {app.name?.charAt(0).toUpperCase() ?? "A"}
                    </div>
                  )}
                  <div className="grid flex-1 leading-tight">
                    <span className="truncate font-medium">{app.name ?? "Unnamed app"}</span>
                    <span className="truncate text-xs font-mono text-muted-foreground">
                      {app.appStoreAppId ?? "No App Store ID"}
                    </span>
                  </div>
                </DropdownMenuItem>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
