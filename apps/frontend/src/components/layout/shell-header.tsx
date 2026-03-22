"use client"

import { usePathname, useParams } from "next/navigation"
import { SidebarTrigger } from "@/components/ui/sidebar"

const PAGE_TITLES: Record<string, string> = {
  "": "Overview",
  "detected-issues": "Detected Issues",
  "pull-requests": "Pull Requests",
  "store-listing": "Store Listing",
  screenshots: "Screenshots",
  details: "App details",
  builds: "Builds",
  testflight: "TestFlight",
  reviews: "Reviews",
  analytics: "Analytics",
}

export function ShellHeader() {
  const pathname = usePathname()
  const { appId } = useParams<{ appId?: string }>()

  let title = "Overview"
  if (appId) {
    const subpath = pathname
      .replace(`/apps/${appId}`, "")
      .replace(/^\//, "")
      .split("/")[0] ?? ""
    title = PAGE_TITLES[subpath] ?? "Overview"
  }

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <div className="h-4 w-px bg-border" />
      <span className="text-sm font-medium">{title}</span>
    </header>
  )
}
