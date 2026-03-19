"use client"

import { useRouter } from "next/navigation"
import { Check, ChevronsUpDown, Github, KeyRound, LogOut, Settings } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavFooter() {
  const router = useRouter()
  const { data: session } = authClient.useSession()

  const displayName = session?.user?.name || "My account"

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <span className="truncate font-medium text-sm">{displayName}</span>
              <ChevronsUpDown className="ml-auto" size={16} />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side="right"
            sideOffset={4}
          >
            <DropdownMenuItem disabled>
              <Check size={16} />
              {displayName}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/apps/connect")}>
              <KeyRound size={16} />
              API key settings
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                window.open(
                  "https://github.com/nickustinov/itsyconnect-macos/issues/new",
                  "_blank",
                )
              }
            >
              <Github size={16} />
              Report an issue
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/apps") }>
              <Settings size={16} />
              Portfolio
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                await authClient.signOut()
                router.push("/auth")
                router.refresh()
              }}
            >
              <LogOut size={16} />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
