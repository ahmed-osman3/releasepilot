"use client"

import { useParams } from "next/navigation"
import { getLastAppId } from "@/lib/nav-state"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { AppSwitcher } from "@/components/layout/app-switcher"
import { NavMain } from "@/components/layout/nav-main"
import { NavFooter } from "@/components/layout/nav-footer"

export function AppSidebar() {
  const { appId } = useParams<{ appId?: string }>()
  const navAppId = appId ?? getLastAppId()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="pt-8">
        <AppSwitcher />
      </SidebarHeader>
      <SidebarContent>
        {navAppId && <NavMain appId={navAppId} />}
      </SidebarContent>
      <SidebarFooter>
        <NavFooter />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
