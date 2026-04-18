"use client"

import type { ComponentType } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
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
  href: string
}

type NavSection = {
  title?: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    items: [
      { title: "Cockpit", icon: HouseIcon, href: "/" },
      { title: "Reports", icon: ChartBarIcon, href: "/reports" },
      { title: "Agents", icon: RobotIcon, href: "/agents" },
    ],
  },
  {
    title: "Planning",
    items: [
      { title: "Assortment", icon: GridFourIcon, href: "/planning/assortment" },
      { title: "Demand", icon: TrendUpIcon, href: "/planning/demand" },
      { title: "Supply", icon: PackageIcon, href: "/planning/supply" },
    ],
  },
  {
    title: "Records",
    items: [
      { title: "Work Orders", icon: FileTextIcon, href: "/records/work-orders" },
      { title: "Purchase Orders", icon: ShoppingCartIcon, href: "/records/purchase-orders" },
      { title: "Transfer Orders", icon: SwapIcon, href: "/records/transfer-orders" },
      { title: "Shipments", icon: TruckIcon, href: "/records/shipments" },
    ],
  },
  {
    title: "Master Data",
    items: [
      { title: "Products", icon: CubeIcon, href: "/master-data/products" },
      { title: "Groups", icon: CirclesThreePlusIcon, href: "/master-data/groups" },
      { title: "Warehouses", icon: PackageIcon, href: "/master-data/warehouses" },
      { title: "Suppliers", icon: HandCoinsIcon, href: "/master-data/suppliers" },
    ],
  },
]

export function AppSidebar() {
  const pathname = usePathname()

  const isActiveRoute = (href: string) =>
    href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)

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
                    <SidebarMenuButton asChild isActive={isActiveRoute(item.href)}>
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
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
