"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Receipt,
  Users,
  Shapes,
  CreditCard,
  GitFork,
  ClipboardList,
  BarChart3,
  Settings,
  HelpCircle,
} from "lucide-react";

import { isNavActive } from "@/lib/navigation";

// Interface for sidebar navigation items
interface NavItem {
  id: string;
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

const mainNavItems: NavItem[] = [
  { id: "dashboard", name: "Dashboard", href: "/", icon: LayoutGrid },
  { id: "invoices", name: "Invoices", href: "/invoices", icon: Receipt },
  { id: "clients", name: "Clients", href: "/clients", icon: Users },
  { id: "catalog", name: "Catalog", href: "/catalog", icon: Shapes },
  { id: "expenses", name: "Expenses", href: "/expenses", icon: CreditCard },
  {
    id: "outsourcing",
    name: "Outsourcing",
    href: "/outsourcing",
    icon: GitFork,
  },
  { id: "tasks", name: "Tasks", href: "/tasks", icon: ClipboardList },
  { id: "analytics", name: "Analytics", href: "/analytics", icon: BarChart3 },
];

const footerNavItems: NavItem[] = [
  { id: "settings", name: "Settings", href: "/settings", icon: Settings },
  { id: "support", name: "Support", href: "/support", icon: HelpCircle },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="workspace-sidebar h-full flex flex-col justify-between bg-surface border-r border-line-neutral-200/70 select-none z-30 app-no-drag">
      {/* Top Header: App Branding */}
      <div className="workspace-sidebar-top flex flex-col">
        <Link
          href="/"
          className="h-20 px-6 flex items-center gap-3.5 group transition-colors"
        >
          <div className="w-10 h-10 shrink-0 transition-transform duration-300 group-hover:scale-105">
            <Image
              src="/brand/logo-color.png"
              alt=""
              width={40}
              height={40}
              preload
              className="dark:hidden"
            />
            <Image
              src="/brand/logo-white.png"
              alt=""
              width={40}
              height={40}
              className="hidden dark:block"
            />
          </div>

          <div className="flex flex-col">
            <span className="font-newspaper text-[20px] font-normal tracking-tight text-content-neutral-900 leading-tight">
              BillFlow
            </span>
            <span className="text-xs text-content-neutral-400 font-normal leading-tight">
              Operations Hub
            </span>
          </div>
        </Link>

        {/* Navigation Items */}
        <nav aria-label="Main Navigation" className="px-3.5 py-2 space-y-1">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = isNavActive(pathname, item.href);

            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`group w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 text-left outline-none cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/40 ${
                  isActive
                    ? "bg-accent-soft/60 text-content-neutral-950 font-semibold"
                    : "text-content-neutral-600 hover:text-content-neutral-900 hover:bg-surface-neutral-100/70"
                }`}
              >
                {/* Lucide animated icon on hover */}
                <div className="w-5 h-5 flex items-center justify-center shrink-0">
                  <Icon
                    strokeWidth={isActive ? 2.2 : 1.9}
                    className={`w-[19px] h-[19px] transition-all duration-200 ease-out group-hover:scale-105 group-hover:-translate-y-px ${
                      isActive
                        ? "text-accent"
                        : "text-content-neutral-400 group-hover:text-accent"
                    }`}
                  />
                </div>
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Pinned Area: Settings & Support */}
      <div className="shrink-0 p-3.5 border-t border-line-neutral-100/80 space-y-1">
        {footerNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = isNavActive(pathname, item.href);

          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`group w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 text-left outline-none cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/40 ${
                isActive
                  ? "bg-accent-soft/60 text-content-neutral-950 font-semibold"
                  : "text-content-neutral-600 hover:text-content-neutral-900 hover:bg-surface-neutral-100/70"
              }`}
            >
              <div className="w-5 h-5 flex items-center justify-center shrink-0">
                <Icon
                  strokeWidth={1.9}
                  className="w-[19px] h-[19px] text-content-neutral-400 transition-all duration-200 ease-out group-hover:scale-105 group-hover:rotate-6 group-hover:text-accent"
                />
              </div>
              <span className="truncate">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
