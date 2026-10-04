"use client";

import React, { useState } from "react";
import Link from "next/link";
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
  Plus,
  Check,
} from "lucide-react";
import { useWidgetContext } from "@/context/WidgetContext";

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
  { id: "support", name: "Support", href: "/#support", icon: HelpCircle },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { pinToDashboard, isDragging } = useWidgetContext();
  const [isDragOverDashboard, setIsDragOverDashboard] = useState(false);
  const [showSuccessPulse, setShowSuccessPulse] = useState(false);

  return (
    <aside className="workspace-sidebar h-full flex flex-col justify-between bg-white border-r border-neutral-200/70 select-none z-30 app-no-drag">
      {/* Top Header: App Branding */}
      <div className="workspace-sidebar-top flex flex-col">
        <Link
          href="/"
          className="h-20 px-6 flex items-center gap-3.5 group transition-colors"
        >
          {/* Logo badge with animated hover pulse */}
          <div className="w-10 h-10 rounded-full bg-[#7c3aed] flex items-center justify-center text-white shadow-sm transition-transform duration-300 group-hover:scale-105 group-hover:shadow-purple-200 group-hover:shadow-md">
            <span className="font-bold text-lg leading-none tracking-tight">
              B
            </span>
          </div>

          <div className="flex flex-col">
            <span className="font-newspaper text-[20px] font-normal tracking-tight text-neutral-900 leading-tight">
              BillFlow
            </span>
            <span className="text-xs text-neutral-400 font-normal leading-tight">
              Operations Hub
            </span>
          </div>
        </Link>

        {/* Navigation Items */}
        <nav aria-label="Main Navigation" className="px-3.5 py-2 space-y-1">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname?.startsWith(item.href) || false;

            const isDashboard = item.id === "dashboard";

            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                onDragOver={
                  isDashboard
                    ? (e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "copy";
                        setIsDragOverDashboard(true);
                      }
                    : undefined
                }
                onDragLeave={
                  isDashboard
                    ? () => {
                        setIsDragOverDashboard(false);
                      }
                    : undefined
                }
                onDrop={
                  isDashboard
                    ? (e) => {
                        e.preventDefault();
                        setIsDragOverDashboard(false);
                        const widgetId = e.dataTransfer.getData("text/plain");
                        if (widgetId) {
                          pinToDashboard(widgetId);
                          setShowSuccessPulse(true);
                          setTimeout(() => setShowSuccessPulse(false), 1400);
                        }
                      }
                    : undefined
                }
                className={`group w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 text-left outline-none cursor-pointer ${
                  isDashboard && isDragOverDashboard
                    ? "bg-[#ede9fe] text-[#7c3aed] ring-2 ring-[#7c3aed] scale-[1.03] shadow-md font-semibold"
                    : isDashboard && showSuccessPulse
                      ? "bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500 scale-[1.03] shadow-md font-semibold"
                      : isDashboard && isDragging
                        ? "bg-purple-50/70 text-purple-900 border border-dashed border-[#7c3aed]/50 animate-pulse"
                        : isActive
                          ? "bg-[#ede9fe]/60 text-neutral-950 font-semibold"
                          : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/70"
                }`}
              >
                {/* Lucide animated icon on hover */}
                <div className="w-5 h-5 flex items-center justify-center shrink-0">
                  <Icon
                    strokeWidth={isActive ? 2.2 : 1.9}
                    className={`w-[19px] h-[19px] transition-all duration-200 ease-out group-hover:scale-105 group-hover:-translate-y-px ${
                      isDashboard && isDragOverDashboard
                        ? "text-[#7c3aed] scale-110"
                        : isDashboard && showSuccessPulse
                          ? "text-emerald-600 scale-110"
                          : isActive
                            ? "text-[#7c3aed]"
                            : "text-neutral-400 group-hover:text-[#7c3aed]"
                    }`}
                  />
                </div>
                <span className="truncate">{item.name}</span>

                {/* Drop Indicator Badges for Dashboard */}
                {isDashboard && isDragOverDashboard && (
                  <span className="ml-auto inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#7c3aed] text-white shadow-xs">
                    <Plus className="w-2.5 h-2.5" />
                    <span>Drop</span>
                  </span>
                )}
                {isDashboard && showSuccessPulse && (
                  <span className="ml-auto inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white shadow-xs">
                    <Check className="w-2.5 h-2.5" />
                    <span>Pinned</span>
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Pinned Area: Settings & Support */}
      <div className="shrink-0 p-3.5 border-t border-neutral-100/80 space-y-1">
        {footerNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.href.startsWith("/#")
            ? false
            : pathname === item.href ||
              Boolean(pathname?.startsWith(item.href));

          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`group w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 text-left outline-none cursor-pointer ${
                isActive
                  ? "bg-[#ede9fe]/60 text-neutral-950 font-semibold"
                  : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/70"
              }`}
            >
              <div className="w-5 h-5 flex items-center justify-center shrink-0">
                <Icon
                  strokeWidth={1.9}
                  className="w-[19px] h-[19px] text-neutral-400 transition-all duration-200 ease-out group-hover:scale-105 group-hover:rotate-6 group-hover:text-[#7c3aed]"
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
