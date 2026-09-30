"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTableCellsLarge,
  faFileInvoice,
  faUserGroup,
  faShapes,
  faMoneyBillWave,
  faUserGear,
  faClipboardCheck,
  faSquarePollVertical,
  faGear,
  faCircleQuestion,
  IconDefinition,
} from "@fortawesome/free-solid-svg-icons";

// Interface for sidebar navigation items
interface NavItem {
  id: string;
  name: string;
  icon: IconDefinition;
}

// Primary navigation menu items matching Figma Design 2.0 wireframe
const navItems: NavItem[] = [
  { id: "dashboard", name: "Dashboard", icon: faTableCellsLarge },
  { id: "invoices", name: "Invoices", icon: faFileInvoice },
  { id: "clients", name: "Clients", icon: faUserGroup },
  { id: "catalog", name: "Catalog", icon: faShapes },
  { id: "expenses", name: "Expenses", icon: faMoneyBillWave },
  { id: "outsourcing", name: "Outsourcing", icon: faUserGear },
  { id: "tasks", name: "Tasks", icon: faClipboardCheck },
  { id: "analytics", name: "Analytics", icon: faSquarePollVertical },
];

// Bottom pinned utility navigation items
const bottomNavItems: NavItem[] = [
  { id: "settings", name: "Settings", icon: faGear },
  { id: "support", name: "Support", icon: faCircleQuestion },
];

export default function Sidebar() {
  // Active navigation tab state (defaults to Outsourcing)
  const [activeItem, setActiveItem] = useState<string>("outsourcing");
  const router = useRouter();

  // Navigation click handler: Only Outsourcing is active; other sections are disabled
  const handleSelect = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (id === "outsourcing") {
      setActiveItem("outsourcing");
      router.push("/outsourcing");
    } else {
      // Intentionally disabled on click for this module
      return;
    }
  };

  return (
    <aside className="w-56 min-w-[14rem] h-screen sticky top-0 flex flex-col justify-between bg-[#f4f4f0] border-r border-[#e5e5e0] select-none py-6 px-4">
      {/* Top: Brand Header & Main Navigation Links */}
      <div className="flex flex-col">
        {/* Brand Logo & Title with serif typography */}
        <div className="px-2 flex items-center gap-3 mb-8">
          <div className="w-7 h-7 rounded-full bg-[#7133f5] text-white flex items-center justify-center font-bold text-[12px] shrink-0 shadow-xs">
            B
          </div>
          <div>
            <div className="font-newspaper text-[17px] text-[#111827] leading-tight font-normal">
              BillFlow
            </div>
            <div className="text-[10px] text-[#8e8e93] font-normal leading-tight mt-0.5">
              Operations Hub
            </div>
          </div>
        </div>

        {/* Primary Navigation Menu */}
        <nav aria-label="Main Navigation" className="space-y-1">
          {navItems.map((item) => {
            const isOutsourcing = item.id === "outsourcing";
            const isActive = activeItem === item.id;

            return (
              <button
                key={item.id}
                type="button"
                aria-current={isActive ? "page" : undefined}
                disabled={!isOutsourcing}
                onClick={(e) => handleSelect(item.id, e)}
                className={`group w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[12px] font-medium transition-all duration-150 text-left outline-none ${
                  isActive
                    ? "bg-[#eae8ed] text-[#111827] font-semibold cursor-pointer shadow-2xs"
                    : "text-[#8e8e93] opacity-60 cursor-not-allowed hover:bg-transparent"
                }`}
                title={isOutsourcing ? "Outsourcing Workspace" : `${item.name} (Module disabled)`}
              >
                <div className="w-4 h-4 flex items-center justify-center shrink-0">
                  <FontAwesomeIcon
                    icon={item.icon}
                    className={`text-[12.5px] ${
                      isActive ? "text-[#111827]" : "text-[#8e8e93]"
                    }`}
                  />
                </div>
                <span className="truncate">{item.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Pinned Area: Settings & Support (disabled on click) */}
      <div className="space-y-1 pt-4 border-t border-[#e5e5e0]">
        {bottomNavItems.map((item) => {
          return (
            <button
              key={item.id}
              type="button"
              disabled
              onClick={(e) => handleSelect(item.id, e)}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[12px] font-medium text-[#8e8e93] opacity-60 cursor-not-allowed hover:bg-transparent text-left outline-none"
              title={`${item.name} (Module disabled)`}
            >
              <div className="w-4 h-4 flex items-center justify-center shrink-0">
                <FontAwesomeIcon icon={item.icon} className="text-[12.5px] text-[#8e8e93]" />
              </div>
              <span className="truncate">{item.name}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
