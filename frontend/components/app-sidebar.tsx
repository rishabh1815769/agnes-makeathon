"use client"

import type { ComponentType } from "react"
import {
  ChartBarIcon,
  CirclesThreePlusIcon,
  CubeIcon,
  FileTextIcon,
  GridFourIcon,
  HandCoinsIcon,
  HouseIcon,
  PackageIcon,
  RobotIcon,
  ShoppingCartIcon,
  SwapIcon,
  TrendUpIcon,
  TruckIcon,
} from "@phosphor-icons/react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

type NavItem = {
  title: string
  icon: ComponentType<{ className?: string }>
}

type NavSection = {
  title?: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    items: [
      { title: "Cockpit", icon: HouseIcon },
      { title: "Reports", icon: ChartBarIcon },
      { title: "Agents", icon: RobotIcon },
    ],
  },
  {
    title: "Planning",
    items: [
      { title: "Assortment", icon: GridFourIcon },
      { title: "Demand", icon: TrendUpIcon },
      { title: "Supply", icon: PackageIcon },
    ],
  },
  {
    title: "Records",
    items: [
      { title: "Work Orders", icon: FileTextIcon },
      { title: "Purchase Orders", icon: ShoppingCartIcon },
      { title: "Transfer Orders", icon: SwapIcon },
      { title: "Shipments", icon: TruckIcon },
    ],
  },
  {
    title: "Master Data",
    items: [
      { title: "Products", icon: CubeIcon },
      { title: "Groups", icon: CirclesThreePlusIcon },
      { title: "Warehouses", icon: PackageIcon },
      { title: "Suppliers", icon: HandCoinsIcon },
    ],
  },
]

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="px-2 py-1 text-sm font-semibold text-sidebar-foreground">
          Spherecast
        </div>
      </SidebarHeader>
      <SidebarContent>
        {navSections.map((section) => (
          <SidebarGroup key={section.title ?? "top-level"}>
            {section.title ? <SidebarGroupLabel>{section.title}</SidebarGroupLabel> : null}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={item.title === "Assortment"}>
                      <a href="#">
                        <item.icon />
                        <span>{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  )
}
