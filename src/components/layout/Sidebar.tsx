"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { motion, MotionConfig } from "motion/react";
import { MotionPresence, MotionSurface } from "@/components/ui/MotionSurface";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Search,
  Bell,
  Settings,
  HelpCircle,
  Sun,
  Moon,
  Monitor,
  ArrowUpRight,
  Receipt,
  Users,
  ClipboardList,
  Shapes,
  CreditCard,
  GitFork,
  CalendarDays,
  BarChart3,
  LayoutGrid,
  X,
} from "lucide-react";

import { isNavActive } from "@/lib/navigation";
import { useData } from "@/lib/data/DataProvider";
import { useTheme } from "@/context/ThemeContext";
import { useWidgetContext } from "@/context/WidgetContext";
import { formatCents } from "@/lib/format";

interface NavItem {
  id: string;
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

const mainNavItems: NavItem[] = [
  { id: "dashboard", name: "Home", href: "/", icon: LayoutGrid },
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
  { id: "calendar", name: "Calendar", href: "/calendar", icon: CalendarDays },
  { id: "analytics", name: "Analytics", href: "/analytics", icon: BarChart3 },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { invoices, clients, tasks, settings } = useData();
  const { preference, setPreference } = useTheme();
  const { pinToDashboard } = useWidgetContext();

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isHomeDropOver, setIsHomeDropOver] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (searchRef.current && !searchRef.current.contains(target)) {
        setSearchOpen(false);
      }
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(target)
      ) {
        setNotificationsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (searchOpen) {
      const timer = setTimeout(() => searchInputRef.current?.focus(), 40);
      return () => clearTimeout(timer);
    }
  }, [searchOpen]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((open) => !open);
        setNotificationsOpen(false);
        setProfileOpen(false);
        return;
      }
      if (event.key !== "Escape") return;
      const openRef = searchOpen
        ? searchRef
        : notificationsOpen
          ? notificationsRef
          : profileOpen
            ? profileRef
            : null;
      setSearchOpen(false);
      setNotificationsOpen(false);
      setProfileOpen(false);
      openRef?.current?.querySelector<HTMLButtonElement>("button")?.focus();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [searchOpen, notificationsOpen, profileOpen]);

  const activeAlerts = useMemo(() => {
    const unpaid = invoices.filter(
      (inv) =>
        inv.status === "UNPAID" ||
        inv.status === "OVERDUE" ||
        inv.status === "ADVANCE_PAID",
    );
    const activeTasks = tasks.filter(
      (t) => t.status === "in-progress" || t.status === "review",
    );
    return {
      unpaid,
      activeTasks,
      totalCount: unpaid.length + activeTasks.length,
    };
  }, [invoices, tasks]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return {
        pages: mainNavItems.slice(0, 5),
        invoices: invoices.slice(0, 3),
        clients: clients.slice(0, 3),
      };
    }
    return {
      pages: [
        ...mainNavItems,
        { id: "settings", name: "Settings", href: "/settings", icon: Settings },
        { id: "support", name: "Support", href: "/support", icon: HelpCircle },
      ].filter((item) => item.name.toLowerCase().includes(q)),
      invoices: invoices
        .filter(
          (inv) =>
            inv.code.toLowerCase().includes(q) ||
            inv.clientName.toLowerCase().includes(q),
        )
        .slice(0, 4),
      clients: clients
        .filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.category || "").toLowerCase().includes(q) ||
            c.email.toLowerCase().includes(q),
        )
        .slice(0, 4),
    };
  }, [searchQuery, invoices, clients]);

  const businessInitials = useMemo(() => {
    const name = settings?.businessName?.trim() || "BillFlow";
    const parts = name.split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }, [settings?.businessName]);

  return (
    <MotionConfig reducedMotion="user">
      <header className="workspace-nav w-full shrink-0 bg-canvas select-none z-30 app-no-drag">
        <div className="max-w-[1440px] mx-auto px-8 h-[68px] grid grid-cols-[auto_1fr_auto] lg:grid-cols-[1fr_auto_1fr] items-center gap-4">
          {/* Left: Brand Identity */}
          <div className="flex items-center justify-self-start">
            <Link
              href="/"
              className="flex items-center gap-2.5 shrink-0 group focus:outline-none"
            >
              <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105">
                <Image
                  src="/brand/logo-color.png"
                  alt=""
                  width={30}
                  height={30}
                  preload
                  className="dark:hidden"
                />
                <Image
                  src="/brand/logo-white.png"
                  alt=""
                  width={30}
                  height={30}
                  className="hidden dark:block"
                />
              </div>
              <span className="text-[21px] font-semibold tracking-[-0.04em] text-content-neutral-950 leading-none">
                BillFlow
              </span>
            </Link>
          </div>

          {/* Center: Middle-Aligned Horizontal Navigation */}
          <nav
            aria-label="Main Navigation"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            className="flex items-center justify-center justify-self-center gap-1.5 overflow-x-auto overflow-y-hidden no-scrollbar py-1 max-w-full"
          >
            {mainNavItems.map((item) => {
              const isActive = isNavActive(pathname, item.href);
              const isHome = item.id === "dashboard";

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  onDragOver={
                    isHome
                      ? (e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "copy";
                          if (!isHomeDropOver) {
                            setIsHomeDropOver(true);
                          }
                        }
                      : undefined
                  }
                  onDragLeave={
                    isHome
                      ? (e) => {
                          const currentTarget = e.currentTarget;
                          const relatedTarget = e.relatedTarget as Node | null;
                          if (
                            !relatedTarget ||
                            !currentTarget.contains(relatedTarget)
                          ) {
                            setIsHomeDropOver(false);
                          }
                        }
                      : undefined
                  }
                  onDrop={
                    isHome
                      ? (e) => {
                          e.preventDefault();
                          setIsHomeDropOver(false);
                          const wId = e.dataTransfer.getData("text/plain");
                          if (wId) {
                            pinToDashboard(wId);
                          }
                        }
                      : undefined
                  }
                  className={`workspace-nav-link relative isolate px-4 py-2 rounded-[12px] text-[14px] font-medium whitespace-nowrap cursor-pointer transition-colors ${
                    isHome && isHomeDropOver
                      ? "bg-accent-solid text-white ring-2 ring-accent/50 shadow-sm"
                      : isActive
                        ? "text-white dark:text-[#111115]"
                        : "text-content-neutral-700 hover:text-content-neutral-950 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                  }`}
                >
                  {isActive && !(isHome && isHomeDropOver) && (
                    <motion.span
                      className="nav-active-pill absolute inset-0 -z-10 rounded-[12px] bg-[#1c1c1f] dark:bg-[#f4f4f6]"
                      layoutId="main-nav-active"
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 32,
                      }}
                    />
                  )}
                  <span className="relative">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right: Circular Utility Controls (Search, Activity/Support, Profile/Settings) */}
          <div className="flex items-center justify-self-end gap-2.5 shrink-0">
            {/* Quick Search Popover */}
            <div className="relative" ref={searchRef}>
              <button
                type="button"
                onClick={() => {
                  setSearchOpen((prev) => !prev);
                  setNotificationsOpen(false);
                  setProfileOpen(false);
                }}
                aria-expanded={searchOpen}
                aria-controls="search-popover"
                aria-label="Search workspace"
                title="Search workspace"
                className="w-10 h-10 rounded-full border border-line-neutral-200 bg-surface/85 hover:bg-surface flex items-center justify-center text-content-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.03)] cursor-pointer"
              >
                <Search className="w-[17px] h-[17px]" strokeWidth={1.9} />
              </button>

              <MotionPresence>
                {searchOpen && (
                  <MotionSurface
                    key="search"
                    kind="menu"
                    id="search-popover"
                    className="workspace-popover absolute right-0 mt-2.5 w-[360px] rounded-[20px] bg-surface border border-line-neutral-200 shadow-[0_18px_40px_-10px_rgba(0,0,0,0.14)] p-3 z-50"
                  >
                    <div className="relative flex items-center">
                      <Search className="w-4 h-4 text-content-neutral-400 absolute left-3.5 pointer-events-none" />
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Jump to page, invoice, or client..."
                        className="w-full h-9 pl-9 pr-8 rounded-[11px] bg-surface-neutral-100 border border-transparent focus:border-line-neutral-300 focus:bg-surface text-[13px] text-content-neutral-900 outline-none"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery("")}
                          className="absolute right-2.5 text-content-neutral-400 hover:text-content-neutral-700"
                          aria-label="Clear search"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="mt-2.5 max-h-[300px] overflow-y-auto space-y-2.5 pr-0.5">
                      {searchResults.pages.length +
                        searchResults.invoices.length +
                        searchResults.clients.length ===
                        0 && (
                        <p className="summary-caption px-3 py-5 text-center">
                          No matches. Try an invoice number, client, or page
                          name.
                        </p>
                      )}
                      {searchResults.pages.length > 0 && (
                        <div>
                          <div className="px-2 py-1 text-[11px] font-medium text-content-neutral-400">
                            Pages
                          </div>
                          <div className="space-y-0.5">
                            {searchResults.pages.map((p) => {
                              const Icon = p.icon;
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => {
                                    setSearchOpen(false);
                                    router.push(p.href);
                                  }}
                                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-[10px] text-[13px] font-medium text-content-neutral-800 hover:bg-surface-neutral-100 text-left cursor-pointer"
                                >
                                  <span className="flex items-center gap-2.5">
                                    <Icon className="w-4 h-4 text-content-neutral-500" />
                                    {p.name}
                                  </span>
                                  <ArrowUpRight className="w-3.5 h-3.5 text-content-neutral-400" />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {searchResults.invoices.length > 0 && (
                        <div>
                          <div className="px-2 py-1 text-[11px] font-medium text-content-neutral-400">
                            Invoices
                          </div>
                          <div className="space-y-0.5">
                            {searchResults.invoices.map((inv) => (
                              <button
                                key={inv.id}
                                type="button"
                                onClick={() => {
                                  setSearchOpen(false);
                                  router.push(
                                    `/invoices?invoice=${encodeURIComponent(inv.id)}`,
                                  );
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-2 rounded-[10px] text-[13px] text-content-neutral-800 hover:bg-surface-neutral-100 text-left cursor-pointer"
                              >
                                <div className="min-w-0">
                                  <span className="font-medium text-content-neutral-900">
                                    {inv.code}
                                  </span>
                                  <span className="text-content-neutral-500 ml-2 truncate">
                                    {inv.clientName}
                                  </span>
                                </div>
                                <span className="text-xs font-medium tabular-nums text-content-neutral-700 shrink-0 ml-2">
                                  {formatCents(inv.amountCents, inv.currency)}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {searchResults.clients.length > 0 && (
                        <div>
                          <div className="px-2 py-1 text-[11px] font-medium text-content-neutral-400">
                            Clients
                          </div>
                          <div className="space-y-0.5">
                            {searchResults.clients.map((client) => (
                              <button
                                key={client.id}
                                type="button"
                                onClick={() => {
                                  setSearchOpen(false);
                                  router.push(
                                    `/clients?client=${encodeURIComponent(client.id)}`,
                                  );
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-2 rounded-[10px] text-[13px] text-content-neutral-800 hover:bg-surface-neutral-100 text-left cursor-pointer"
                              >
                                <span className="font-medium truncate">
                                  {client.name}
                                </span>
                                <span className="text-xs text-content-neutral-400 truncate ml-2">
                                  {client.category || client.contactPerson}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </MotionSurface>
                )}
              </MotionPresence>
            </div>

            {/* Activity & Notifications Button */}
            <div className="relative" ref={notificationsRef}>
              <button
                type="button"
                onClick={() => {
                  setNotificationsOpen((prev) => !prev);
                  setSearchOpen(false);
                  setProfileOpen(false);
                }}
                aria-expanded={notificationsOpen}
                aria-controls="notifications-popover"
                aria-label="Workspace notifications"
                title="Notifications & Activity"
                className="relative w-10 h-10 rounded-full border border-line-neutral-200 bg-surface/85 hover:bg-surface flex items-center justify-center text-content-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.03)] cursor-pointer"
              >
                <Bell className="w-[17px] h-[17px]" strokeWidth={1.9} />
                {activeAlerts.totalCount > 0 && (
                  <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-surface" />
                )}
              </button>

              <MotionPresence>
                {notificationsOpen && (
                  <MotionSurface
                    key="notifications"
                    kind="menu"
                    id="notifications-popover"
                    className="workspace-popover absolute right-0 mt-2.5 w-[340px] rounded-[20px] bg-surface border border-line-neutral-200 shadow-[0_18px_40px_-10px_rgba(0,0,0,0.14)] p-3.5 z-50"
                  >
                    <div className="flex items-center justify-between pb-2.5 border-b border-line-neutral-100">
                      <span className="text-[14px] font-medium text-content-neutral-950">
                        Workspace Pulse
                      </span>
                      <span className="zentra-pill-badge !py-0.5 !px-2 !text-[11px]">
                        {activeAlerts.totalCount} active
                      </span>
                    </div>

                    <div className="py-2.5 space-y-2 max-h-[260px] overflow-y-auto">
                      {activeAlerts.unpaid.slice(0, 3).map((inv) => {
                        const remaining = Math.max(
                          0,
                          inv.amountCents - (inv.paidCents || 0),
                        );
                        return (
                          <button
                            key={inv.id}
                            type="button"
                            onClick={() => {
                              setNotificationsOpen(false);
                              router.push(
                                `/invoices?invoice=${encodeURIComponent(inv.id)}`,
                              );
                            }}
                            className="w-full flex items-center justify-between p-2.5 rounded-[12px] bg-surface-neutral-50 hover:bg-surface-neutral-100 text-left cursor-pointer"
                          >
                            <div className="min-w-0">
                              <div className="text-[12.5px] font-medium text-content-neutral-900 truncate">
                                {inv.code} · {inv.clientName}
                              </div>
                              <div className="text-[11.5px] text-content-neutral-500">
                                {inv.status.replace("_", " ")}
                              </div>
                            </div>
                            <span className="text-[12.5px] font-medium tabular-nums text-content-neutral-900 ml-2 shrink-0">
                              {formatCents(remaining, inv.currency)}
                            </span>
                          </button>
                        );
                      })}

                      {activeAlerts.activeTasks.slice(0, 2).map((task) => (
                        <button
                          key={task.id}
                          type="button"
                          onClick={() => {
                            setNotificationsOpen(false);
                            router.push("/tasks");
                          }}
                          className="w-full flex items-center justify-between p-2.5 rounded-[12px] bg-surface-neutral-50 hover:bg-surface-neutral-100 text-left cursor-pointer"
                        >
                          <div className="min-w-0">
                            <div className="text-[12.5px] font-medium text-content-neutral-900 truncate">
                              {task.title}
                            </div>
                            <div className="text-[11.5px] text-content-neutral-500">
                              Task {task.status.replace("-", " ")}
                            </div>
                          </div>
                          <ArrowUpRight className="w-3.5 h-3.5 text-content-neutral-400 shrink-0 ml-2" />
                        </button>
                      ))}

                      {activeAlerts.totalCount === 0 && (
                        <div className="py-6 text-center text-[12.5px] text-content-neutral-500">
                          All invoices settled and tasks up to date.
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-line-neutral-100 flex items-center justify-between gap-2">
                      <Link
                        href="/support"
                        onClick={() => setNotificationsOpen(false)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[10px] text-[12.5px] font-medium text-content-neutral-700 hover:bg-surface-neutral-100"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        Support & Guide
                      </Link>
                      <Link
                        href="/settings"
                        onClick={() => setNotificationsOpen(false)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[10px] text-[12.5px] font-medium text-content-neutral-700 hover:bg-surface-neutral-100"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        Settings
                      </Link>
                    </div>
                  </MotionSurface>
                )}
              </MotionPresence>
            </div>

            {/* Profile / Settings Avatar with Gradient Ring */}
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => {
                  setProfileOpen((prev) => !prev);
                  setSearchOpen(false);
                  setNotificationsOpen(false);
                }}
                aria-expanded={profileOpen}
                aria-controls="profile-popover"
                aria-label="Workspace settings and appearance"
                title="Settings & Appearance"
                className={`w-10 h-10 rounded-full p-[2px] profile-accent-ring shadow-xs cursor-pointer transition-transform hover:scale-105 ${
                  isNavActive(pathname, "/settings") ||
                  isNavActive(pathname, "/support")
                    ? "ring-2 ring-content-neutral-900 ring-offset-2 ring-offset-canvas"
                    : ""
                }`}
              >
                <span className="w-full h-full rounded-full bg-surface flex items-center justify-center text-[12px] font-semibold tracking-tight text-content-neutral-900">
                  {businessInitials}
                </span>
              </button>

              <MotionPresence>
                {profileOpen && (
                  <MotionSurface
                    key="profile"
                    kind="menu"
                    id="profile-popover"
                    className="workspace-popover absolute right-0 mt-2.5 w-[260px] rounded-[20px] bg-surface border border-line-neutral-200 shadow-[0_18px_40px_-10px_rgba(0,0,0,0.14)] p-3 z-50"
                  >
                    <div className="px-2.5 py-2 border-b border-line-neutral-100">
                      <div className="text-[13.5px] font-semibold text-content-neutral-950 truncate">
                        {settings?.businessName || "BillFlow Studio"}
                      </div>
                      <div className="text-[11.5px] text-content-neutral-500 truncate">
                        {settings?.email || "Freelance Operations Hub"}
                      </div>
                    </div>

                    {/* Quick Theme Switcher */}
                    <div className="py-2.5 px-1 border-b border-line-neutral-100">
                      <div className="px-1.5 mb-1.5 text-[11px] font-medium text-content-neutral-400">
                        Appearance
                      </div>
                      <div className="grid grid-cols-3 gap-1 p-1 rounded-[11px] bg-surface-neutral-100">
                        {(
                          [
                            { id: "light", label: "Light", icon: Sun },
                            { id: "dark", label: "Dark", icon: Moon },
                            { id: "system", label: "Auto", icon: Monitor },
                          ] as const
                        ).map((mode) => {
                          const ModeIcon = mode.icon;
                          const active = preference === mode.id;
                          return (
                            <button
                              key={mode.id}
                              type="button"
                              onClick={() => setPreference(mode.id)}
                              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-[8px] text-[11.5px] font-medium cursor-pointer ${
                                active
                                  ? "bg-surface text-content-neutral-950 shadow-xs"
                                  : "text-content-neutral-500 hover:text-content-neutral-900"
                              }`}
                            >
                              <ModeIcon className="w-3.5 h-3.5" />
                              {mode.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="pt-1.5 space-y-0.5">
                      <Link
                        href="/settings"
                        onClick={() => setProfileOpen(false)}
                        className={`flex items-center justify-between px-2.5 py-2 rounded-[10px] text-[13px] font-medium ${
                          isNavActive(pathname, "/settings")
                            ? "bg-surface-neutral-100 text-content-neutral-950"
                            : "text-content-neutral-700 hover:bg-surface-neutral-100"
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <Settings className="w-4 h-4 text-content-neutral-500" />
                          Settings
                        </span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-content-neutral-400" />
                      </Link>
                      <Link
                        href="/support"
                        onClick={() => setProfileOpen(false)}
                        className={`flex items-center justify-between px-2.5 py-2 rounded-[10px] text-[13px] font-medium ${
                          isNavActive(pathname, "/support")
                            ? "bg-surface-neutral-100 text-content-neutral-950"
                            : "text-content-neutral-700 hover:bg-surface-neutral-100"
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <HelpCircle className="w-4 h-4 text-content-neutral-500" />
                          Support & Docs
                        </span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-content-neutral-400" />
                      </Link>
                    </div>
                  </MotionSurface>
                )}
              </MotionPresence>
            </div>
          </div>
        </div>
      </header>
    </MotionConfig>
  );
}
