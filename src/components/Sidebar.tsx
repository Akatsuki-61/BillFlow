"use client";

import React from "react";
import {
  LayoutDashboard,
  FileText,
  Users,
  Network,
  Banknote,
  Briefcase,
  CheckSquare,
  BarChart3,
  Settings,
  CircleHelp,
} from "lucide-react";
import { useNav } from "@/context/NavContext";

interface NavItem {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

const navItems: NavItem[] = [
  { id: "dashboard", name: "Dashboard", icon: LayoutDashboard },
  { id: "invoices", name: "Invoices", icon: FileText },
  { id: "clients", name: "Clients", icon: Users },
  { id: "catalog", name: "Catalog", icon: Network },
  { id: "expenses", name: "Expenses", icon: Banknote },
  { id: "outsourcing", name: "Outsourcing", icon: Briefcase },
  { id: "tasks", name: "Tasks", icon: CheckSquare },
  { id: "analytics", name: "Analytics", icon: BarChart3 },
];

const bottomNavItems: NavItem[] = [
  { id: "settings", name: "Settings", icon: Settings },
  { id: "support", name: "Support", icon: CircleHelp },
];

export default function Sidebar() {
  const { activeNav: activeItem, setActiveNav: setActiveItem } = useNav();

  const handleSelect = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    setActiveItem(id);
  };

  return (
    <aside className="w-64 min-w-[16rem] h-screen sticky top-0 flex flex-col justify-between bg-[#F8F9FA] border-r border-neutral-200/70 select-none px-4 py-5 font-sans">
      {/* Top Header: App Branding */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-full bg-[#7C3AED] flex items-center justify-center text-white font-bold text-base shadow-sm">
            B
          </div>
          <div className="flex flex-col">
            <span className="text-[17px] font-bold text-neutral-900 leading-tight tracking-tight">
              BillFlow
            </span>
            <span className="text-xs text-neutral-400 font-normal leading-tight">
              Operations Hub
            </span>
          </div>
        </div>

        {/* Main Navigation Items */}
        <nav aria-label="Main Navigation" className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeItem === item.id;

            return (
              <button
                key={item.id}
                type="button"
                aria-current={isActive ? "page" : undefined}
                onClick={(e) => handleSelect(item.id, e)}
                className={`group w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-left outline-none cursor-pointer ${
                  isActive
                    ? "bg-[#EAE6F5] text-neutral-900 font-semibold"
                    : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100/70"
                }`}
              >
                <Icon
                  strokeWidth={isActive ? 2.2 : 1.8}
                  className={`w-[18px] h-[18px] transition-colors duration-150 shrink-0 ${
                    isActive
                      ? "text-neutral-900"
                      : "text-neutral-500 group-hover:text-neutral-800"
                  }`}
                />
                <span className="truncate">{item.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Pinned Area: Settings & Support */}
      <div className="space-y-1 pt-4 border-t border-neutral-200/50">
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeItem === item.id;

          return (
            <button
              key={item.id}
              type="button"
              aria-current={isActive ? "page" : undefined}
              onClick={(e) => handleSelect(item.id, e)}
              className={`group w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-left outline-none cursor-pointer ${
                isActive
                  ? "bg-[#EAE6F5] text-neutral-900 font-semibold"
                  : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100/70"
              }`}
            >
              <Icon
                strokeWidth={isActive ? 2.2 : 1.8}
                className={`w-[18px] h-[18px] transition-colors duration-150 shrink-0 ${
                  isActive
                    ? "text-neutral-900"
                    : "text-neutral-500 group-hover:text-neutral-800"
                }`}
              />
              <span className="truncate">{item.name}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
