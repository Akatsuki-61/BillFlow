"use client";

import React, { useState } from "react";
import {
  LayoutDashboard,
  Receipt,
  Wallet,
  Users,
  BarChart3,
  Briefcase,
  CheckCircle2,
  Package,
  Settings,
} from "lucide-react";

interface NavItem {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

const primaryNavItems: NavItem[] = [
  { id: "dashboard", name: "Dashboard", icon: LayoutDashboard },
  { id: "invoices", name: "Invoices", icon: Receipt },
  { id: "expenses", name: "Expenses", icon: Wallet },
  { id: "clients", name: "Clients", icon: Users },
  { id: "analytics", name: "Analytics", icon: BarChart3 },
];

const secondaryNavItems: NavItem[] = [
  { id: "outsourcing", name: "Outsourcing", icon: Briefcase },
  { id: "todo", name: "To-Do", icon: CheckCircle2 },
  { id: "catalog", name: "Catalog", icon: Package },
];

const settingsItem: NavItem = {
  id: "settings",
  name: "Settings",
  icon: Settings,
};

export default function Sidebar() {
  const [activeItem, setActiveItem] = useState<string>("dashboard");

  const handleSelect = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    setActiveItem(id);
  };

  return (
    <aside className="w-64 min-w-[16rem] h-screen sticky top-0 flex flex-col justify-between bg-white border-r border-neutral-200/80 select-none">
      {/* Top Header: App Branding */}
      <div className="flex flex-col">
        <div className="h-16 px-5 flex items-center gap-3 border-b border-neutral-100">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.1),0px_1px_0px_0px_rgba(25,28,33,0.02),0px_0px_0px_1px_rgba(25,28,33,0.08)]">
            <svg
              className="w-4.5 h-4.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <span className="text-[17px] font-bold tracking-tight text-neutral-900 leading-none">
            BillFlow
          </span>
        </div>

        {/* Navigation Items */}
        <nav aria-label="Main Navigation" className="p-3 space-y-1">
          {/* Primary Nav Links */}
          <div className="space-y-1">
            {primaryNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeItem === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={isActive ? "page" : undefined}
                  onClick={(e) => handleSelect(item.id, e)}
                  className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-left outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
                    isActive
                      ? "bg-neutral-100 text-neutral-950 font-semibold shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.1),0px_1px_0px_0px_rgba(25,28,33,0.02),0px_0px_0px_1px_rgba(25,28,33,0.08)]"
                      : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50"
                  }`}
                >
                  <Icon
                    strokeWidth={isActive ? 2.2 : 1.9}
                    className={`w-[18px] h-[18px] transition-colors duration-150 shrink-0 ${
                      isActive
                        ? "text-emerald-600"
                        : "text-neutral-400 group-hover:text-neutral-600"
                    }`}
                  />
                  <span className="truncate">{item.name}</span>
                </button>
              );
            })}
          </div>

          {/* Section Divider */}
          <div className="py-2.5">
            <div className="h-px bg-neutral-200/70 mx-2" />
          </div>

          {/* Secondary Nav Links */}
          <div className="space-y-1">
            {secondaryNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeItem === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={isActive ? "page" : undefined}
                  onClick={(e) => handleSelect(item.id, e)}
                  className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-left outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
                    isActive
                      ? "bg-neutral-100 text-neutral-950 font-semibold shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.1),0px_1px_0px_0px_rgba(25,28,33,0.02),0px_0px_0px_1px_rgba(25,28,33,0.08)]"
                      : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50"
                  }`}
                >
                  <Icon
                    strokeWidth={isActive ? 2.2 : 1.9}
                    className={`w-[18px] h-[18px] transition-colors duration-150 shrink-0 ${
                      isActive
                        ? "text-emerald-600"
                        : "text-neutral-400 group-hover:text-neutral-600"
                    }`}
                  />
                  <span className="truncate">{item.name}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      {/* Bottom Pinned Area: Settings */}
      <div className="p-3 border-t border-neutral-100">
        {(() => {
          const Icon = settingsItem.icon;
          const isActive = activeItem === settingsItem.id;

          return (
            <button
              type="button"
              aria-current={isActive ? "page" : undefined}
              onClick={(e) => handleSelect(settingsItem.id, e)}
              className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-left outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
                isActive
                  ? "bg-neutral-100 text-neutral-950 font-semibold shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.1),0px_1px_0px_0px_rgba(25,28,33,0.02),0px_0px_0px_1px_rgba(25,28,33,0.08)]"
                  : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50"
              }`}
            >
              <Icon
                strokeWidth={isActive ? 2.2 : 1.9}
                className={`w-[18px] h-[18px] transition-colors duration-150 shrink-0 ${
                  isActive
                    ? "text-emerald-600"
                    : "text-neutral-400 group-hover:text-neutral-600"
                }`}
              />
              <span className="truncate">{settingsItem.name}</span>
            </button>
          );
        })()}
      </div>
    </aside>
  );
}
