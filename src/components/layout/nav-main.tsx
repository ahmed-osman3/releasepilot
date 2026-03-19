"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  AlertTriangle,
  BarChart3,
  Bot,
  Camera,
  FileText,
  GitPullRequest,
  Hammer,
  MessageSquare,
  Send,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

interface NavItem {
  title: string
  href: string
  icon: LucideIcon
}

interface NavGroup {
  label: string
  items: NavItem[]
}

function getNavGroups(appId: string): NavGroup[] {
  const base = `/apps/${appId}`

  return [
    {
      label: "Release",
      items: [
        { title: "Automation", href: base, icon: Bot },
        { title: "Detected Issues", href: `${base}/detected-issues`, icon: AlertTriangle },
        { title: "Pull Requests", href: `${base}/pull-requests`, icon: GitPullRequest },
      ],
    },
    {
      label: "App Management",
      items: [
        { title: "Store Listing", href: `${base}/store-listing`, icon: FileText },
        { title: "Screenshots", href: `${base}/screenshots`, icon: Camera },
        { title: "App details", href: `${base}/details`, icon: FileText },
      ],
    },
    {
      label: "Distribution",
      items: [
        { title: "Builds", href: `${base}/builds`, icon: Hammer },
        { title: "TestFlight", href: `${base}/testflight`, icon: Send },
      ],
    },
    {
      label: "Insights",
      items: [
        { title: "Reviews", href: `${base}/reviews`, icon: MessageSquare },
        { title: "Analytics", href: `${base}/analytics`, icon: BarChart3 },
      ],
    },
  ]
}

export function NavMain({ appId }: { appId: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const groups = getNavGroups(appId)

  function isActive(href: string): boolean {
    const base = `/apps/${appId}`
    if (href === base) return pathname === base

    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <>
      {groups.map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarMenu>
            {group.items.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  tooltip={item.title}
                  isActive={isActive(item.href)}
                >
                  <Link
                    href={item.href}
                    onNavigate={(event) => {
                      event.preventDefault()
                      router.push(item.href)
                    }}
                  >
                    <item.icon size={16} />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </>
  )
}
