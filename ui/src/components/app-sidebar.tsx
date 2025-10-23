import * as React from "react"
import { useLocation, Link } from "react-router-dom"
import {
  Home,
  Map,
  BarChart3,
  AlertTriangle,
  Bot,
  Settings,
  Waves,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/ui/theme-toggle"

const sidebarItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: Home,
    description: "Overview and key metrics",
  },
  {
    title: "Risk Map",
    url: "/risk-map",
    icon: Map,
    description: "Interactive Texas flood map",
  },
  {
    title: "Analytics",
    url: "/analytics",
    icon: BarChart3,
    description: "Data trends and analysis",
  },
  {
    title: "Alerts",
    url: "/alerts",
    icon: AlertTriangle,
    description: "Flood warnings and notifications",
  },
  {
    title: "AI Assistant",
    url: "/ai-assistant",
    icon: Bot,
    description: "Chat with flood intelligence AI",
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    description: "Preferences and configuration",
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"
  const location = useLocation()

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className={`border-b border-sidebar-border ${isCollapsed ? 'px-2 py-4' : 'px-6 py-4'}`}>
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'}`}>
          <div className={`flex items-center justify-center rounded-lg bg-blue-600 text-white ${isCollapsed ? 'h-10 w-10' : 'h-8 w-8'}`}>
            <Waves className={`${isCollapsed ? 'h-5 w-5' : 'h-4 w-4'}`} />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-sidebar-foreground">
                Flood Intelligence
              </span>
              <span className="text-xs text-sidebar-foreground/60">
                AI for Good
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent className="p-4">
        <SidebarMenu>
          {sidebarItems.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                isActive={location.pathname === item.url}
                size="lg"
                className={`
                  ${isCollapsed
                    ? 'h-14 w-full justify-center p-4 mx-0 group-data-[collapsible=icon]:size-auto! group-data-[collapsible=icon]:w-full! group-data-[collapsible=icon]:h-14!'
                    : 'h-16 w-full justify-start gap-3 p-4'}
                  rounded-lg text-left hover:bg-sidebar-accent
                `}
                tooltip={isCollapsed ? item.title : undefined}
              >
                <Link to={item.url} className="flex items-center justify-center w-full">
                  <item.icon className={`shrink-0 ${isCollapsed ? 'h-6 w-6' : 'h-5 w-5'}`} />
                  {!isCollapsed && (
                    <div className="flex flex-col ml-3">
                      <span className="text-sm font-medium">{item.title}</span>
                      <span className="text-xs text-sidebar-foreground/60">
                        {item.description}
                      </span>
                    </div>
                  )}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className={`flex ${isCollapsed ? 'justify-center' : 'justify-between items-center'}`}>
          {!isCollapsed && (
            <span className="text-xs text-sidebar-foreground/60">
              Theme
            </span>
          )}
          <ThemeToggle size="sm" />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
