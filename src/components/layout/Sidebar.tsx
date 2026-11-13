"use client";

import React, { useState, useRef, useEffect, useMemo, useId } from "react";
import Link from "next/link";
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from "motion/react";
import { MotionPresence, MotionSurface } from "@/components/ui/MotionSurface";
import {
  SPRING_NAV_GLIDE,
  SPRING_LIQUID_BUTTON,
  POPOVER_INITIAL_SCALE,
  listRowTransition,
} from "@/lib/motion";
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
  BarChart3,
  LayoutGrid,
  X,
  Lock,
  UsersRound,
} from "lucide-react";

import { isNavActive } from "@/lib/navigation";
import { useData } from "@/lib/data/DataProvider";
import { useTheme } from "@/context/ThemeContext";
import { useWidgetContext } from "@/context/WidgetContext";
import { useProfiles } from "@/context/ProfileContext";
import {
  PROFILE_AVATAR_ICONS,
  PROFILE_ACCENT_STYLES,
  ProfileAvatarTile,
} from "@/components/profiles/ProfileAvatarTile";
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
  { id: "analytics", name: "Analytics", href: "/analytics", icon: BarChart3 },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { invoices, clients, tasks } = useData();
  const { preference, setPreference } = useTheme();
  const {
    profiles,
    activeProfile,
    maxProfiles,
    openProfileGate,
    lockCurrentProfile,
  } = useProfiles();
  const ActiveProfileIcon = PROFILE_AVATAR_ICONS[activeProfile.avatar] ?? UsersRound;
  const activeProfileStyle =
    PROFILE_ACCENT_STYLES[activeProfile.accent] ?? PROFILE_ACCENT_STYLES.blue;
  const {
    pinToDashboard,
    draggedWidgetId,
    isDragging,
    dragSource,
    isHomeDropOver,
    setIsHomeDropOver,
    endWidgetDrag,
  } = useWidgetContext();

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [hoveredNavId, setHoveredNavId] = useState<string | null>(null);

  const searchRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const sheenId = useId();
  const reducedMotion = Boolean(useReducedMotion());

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

  return (
    <MotionConfig reducedMotion="user">
      <header className="workspace-nav w-full shrink-0 bg-canvas select-none z-30 app-drag-region">
        <div className="max-w-[1440px] mx-auto px-8 h-[68px] grid grid-cols-[auto_1fr_auto] lg:grid-cols-[1fr_auto_1fr] items-center gap-4 app-drag-region">
          {/* Left: Brand Identity */}
          <div className="flex items-center justify-self-start app-drag-region">
            <Link
              href="/"
              className="flex items-center gap-2.5 shrink-0 group focus:outline-none app-drag-region cursor-default"
            >
              <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 pointer-events-none">
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
              <span className="text-[21px] font-semibold tracking-[-0.04em] text-content-neutral-950 leading-none pointer-events-none">
                BillFlow
              </span>
            </Link>
          </div>

          {/* Center: Middle-Aligned Horizontal Navigation */}
          <nav
            aria-label="Main Navigation"
            onMouseLeave={() => setHoveredNavId(null)}
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            className="flex items-center justify-center justify-self-center gap-1.5 overflow-x-auto overflow-y-hidden no-scrollbar py-1 max-w-full app-no-drag"
          >
            {mainNavItems.map((item) => {
              const isActive = isNavActive(pathname, item.href);
              const isHome = item.id === "dashboard";
              const isHovered = hoveredNavId === item.id && !isActive;
              const isHomeDropCandidate =
                isHome && isDragging && dragSource === "analytics";

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  onMouseEnter={() => setHoveredNavId(item.id)}
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
                          const wId =
                            draggedWidgetId ||
                            e.dataTransfer.getData("text/plain");
                          if (wId) {
                            pinToDashboard(wId);
                          }
                          endWidgetDrag();
                        }
                      : undefined
                  }
                  className={`workspace-nav-link relative isolate px-4 py-2 rounded-[12px] text-[14px] font-medium whitespace-nowrap cursor-pointer transition-colors duration-150 active:scale-[0.97] ${
                    isHome && isHomeDropOver
                      ? "bg-accent/25 dark:bg-accent/35 text-accent"
                      : isHomeDropCandidate
                        ? "bg-accent/12 dark:bg-accent/20 text-accent"
                        : isActive
                          ? "text-white dark:text-[#111115]"
                          : "text-content-neutral-700 hover:text-content-neutral-950"
                  }`}
                >
                  {isHovered && !(isHome && (isHomeDropOver || isHomeDropCandidate)) && (
                    <motion.span
                      className="absolute inset-0 -z-20 rounded-[15px] bg-black/[0.045] dark:bg-white/[0.065]"
                      layoutId="main-nav-hover"
                      transition={SPRING_NAV_GLIDE}
                    />
                  )}
                  {isActive && !(isHome && (isHomeDropOver || isHomeDropCandidate)) && (
                    <motion.span
                      className="nav-active-pill absolute inset-0 -z-10 rounded-[12px] bg-[#1c1c1f] dark:bg-[#f4f4f6] shadow-[0_4px_12px_-2px_rgba(0,0,0,0.22)]"
                      layoutId="main-nav-active"
                      transition={SPRING_NAV_GLIDE}
                    />
                  )}
                  <span className="relative z-10">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right: Circular Utility Controls (Search, Activity/Support, Profile/Settings) */}
          <div className="flex items-center justify-self-end gap-2.5 shrink-0 app-no-drag">
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
                    style={{ transformOrigin: "top right" }}
                    className="workspace-popover absolute right-0 mt-2.5 w-[360px] rounded-[20px] bg-surface border border-line-neutral-200 shadow-[0_18px_40px_-10px_rgba(0,0,0,0.14)] p-3 z-50"
                  >
                    <div className="relative flex items-center">
                      <Search className="w-4 h-4 text-content-neutral-400 absolute left-3.5 pointer-events-none transition-transform duration-200" />
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Jump to page, invoice, or client..."
                        className="ui-field w-full h-9 !min-h-[36px] pl-9 pr-8 rounded-[11px] bg-surface-neutral-100 border border-transparent focus:border-line-neutral-300 focus:bg-surface text-[13px] text-content-neutral-900 outline-none"
                      />
                      <AnimatePresence initial={false}>
                        {searchQuery && (
                          <motion.button
                            key="clear-search"
                            type="button"
                            initial={{ opacity: 0, scale: POPOVER_INITIAL_SCALE }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: POPOVER_INITIAL_SCALE }}
                            transition={SPRING_LIQUID_BUTTON}
                            onClick={() => setSearchQuery("")}
                            className="absolute right-2.5 text-content-neutral-400 hover:text-content-neutral-700 cursor-pointer"
                            aria-label="Clear search"
                          >
                            <X className="w-3.5 h-3.5" />
                          </motion.button>
                        )}
                      </AnimatePresence>
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
                            {searchResults.pages.map((p, idx) => {
                              const Icon = p.icon;
                              return (
                                <motion.button
                                  key={p.id}
                                  type="button"
                                  initial={reducedMotion ? false : { opacity: 0, y: 4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={listRowTransition(idx, reducedMotion)}
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
                                </motion.button>
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
                            {searchResults.invoices.map((inv, idx) => (
                              <motion.button
                                key={inv.id}
                                type="button"
                                initial={reducedMotion ? false : { opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={listRowTransition(idx, reducedMotion)}
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
                              </motion.button>
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
                            {searchResults.clients.map((client, idx) => (
                              <motion.button
                                key={client.id}
                                type="button"
                                initial={reducedMotion ? false : { opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={listRowTransition(idx, reducedMotion)}
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
                              </motion.button>
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
                    style={{ transformOrigin: "top right" }}
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
                      {activeAlerts.unpaid.slice(0, 3).map((inv, idx) => {
                        const remaining = Math.max(
                          0,
                          inv.amountCents - (inv.paidCents || 0),
                        );
                        return (
                          <motion.button
                            key={inv.id}
                            type="button"
                            initial={reducedMotion ? false : { opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={listRowTransition(idx, reducedMotion)}
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
                          </motion.button>
                        );
                      })}

                      {activeAlerts.activeTasks.slice(0, 2).map((task, idx) => (
                        <motion.button
                          key={task.id}
                          type="button"
                          initial={reducedMotion ? false : { opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={listRowTransition(
                            Math.min(activeAlerts.unpaid.length, 3) + idx,
                            reducedMotion,
                          )}
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
                        </motion.button>
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

            {/* Active Profile Avatar Button (distinct framed profile picture with studio artwork) */}
            <div className="relative ml-0.5" ref={profileRef}>
              <button
                type="button"
                onClick={() => {
                  setProfileOpen((prev) => !prev);
                  setSearchOpen(false);
                  setNotificationsOpen(false);
                }}
                aria-expanded={profileOpen}
                aria-controls="profile-popover"
                aria-label={`Profile (${activeProfile.name}) and workspace settings`}
                title={`${activeProfile.name} · ${activeProfile.subtitle}`}
                style={{
                  borderColor:
                    profileOpen ||
                    isNavActive(pathname, "/settings") ||
                    isNavActive(pathname, "/support")
                      ? activeProfileStyle.swatch
                      : activeProfileStyle.border,
                  boxShadow: profileOpen
                    ? `0 0 0 3px ${activeProfileStyle.ring}, 0 8px 18px -4px ${activeProfileStyle.glow}`
                    : `0 4px 12px -3px ${activeProfileStyle.glow}`,
                }}
                className="relative w-10 h-10 p-[2px] rounded-full border-2 bg-surface flex items-center justify-center cursor-pointer group transition-[transform,border-color,box-shadow] duration-200 hover:scale-105"
              >
                <span
                  className="relative w-full h-full rounded-full overflow-hidden flex items-center justify-center shadow-[0_0_0_1px_rgba(255,255,255,0.22)_inset]"
                  style={{
                    background: activeProfileStyle.bg,
                    color: activeProfileStyle.iconColor,
                  }}
                >
                  {/* Profile studio geometric contour artwork */}
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    viewBox="0 0 100 100"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle
                      cx="82"
                      cy="18"
                      r="34"
                      stroke={activeProfileStyle.patternStroke}
                      strokeWidth="2.2"
                    />
                    <circle
                      cx="82"
                      cy="18"
                      r="54"
                      stroke={activeProfileStyle.patternStroke}
                      strokeWidth="1.6"
                    />
                    <path
                      d="M-10 80 Q 42 58, 110 86"
                      stroke={activeProfileStyle.patternStroke}
                      strokeWidth="2.2"
                    />
                    <rect
                      x="0"
                      y="0"
                      width="100"
                      height="48"
                      fill={`url(#${sheenId})`}
                      opacity="0.22"
                    />
                    <defs>
                      <linearGradient
                        id={sheenId}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="0%" stopColor="#FFFFFF" />
                        <stop
                          offset="100%"
                          stopColor="#FFFFFF"
                          stopOpacity="0"
                        />
                      </linearGradient>
                    </defs>
                  </svg>
                  <ActiveProfileIcon
                    className="w-[16px] h-[16px] relative z-10 transition-transform duration-200 group-hover:scale-110"
                    strokeWidth={2.1}
                  />
                </span>

                {/* Profile status / lock badge */}
                {activeProfile.hasPassword ? (
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-0.5 -right-0.5 z-20 w-3.5 h-3.5 rounded-full bg-zinc-900 text-zinc-100 ring-2 ring-canvas flex items-center justify-center shadow-xs"
                  >
                    <Lock className="w-2 h-2" strokeWidth={2.4} />
                  </span>
                ) : (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 right-0 z-20 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-canvas"
                  />
                )}
              </button>

              <MotionPresence>
                {profileOpen && (
                  <MotionSurface
                    key="profile"
                    kind="menu"
                    id="profile-popover"
                    style={{ transformOrigin: "top right" }}
                    className="workspace-popover absolute right-0 mt-2.5 w-[272px] rounded-[20px] bg-surface border border-line-neutral-200 shadow-[0_18px_40px_-10px_rgba(0,0,0,0.14)] p-3 z-50"
                  >
                    <div className="px-2 py-2 border-b border-line-neutral-100 flex items-center gap-3">
                      <ProfileAvatarTile
                        avatar={activeProfile.avatar}
                        accent={activeProfile.accent}
                        size="sm"
                        hasPassword={activeProfile.hasPassword}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] font-semibold text-content-neutral-950 truncate">
                          {activeProfile.name}
                        </div>
                        <div className="text-[11.5px] text-content-neutral-500 truncate">
                          {activeProfile.subtitle}
                        </div>
                      </div>
                    </div>

                    {/* Quick Theme Switcher */}
                    <div className="py-2.5 px-1 border-b border-line-neutral-100">
                      <div className="px-1.5 mb-1.5 text-[11px] font-medium text-content-neutral-400">
                        Appearance
                      </div>
                      <div className="grid grid-cols-3 gap-1 p-1 rounded-[11px] bg-surface-neutral-100 relative">
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
                              className={`relative isolate flex items-center justify-center gap-1.5 py-1.5 rounded-[8px] text-[11.5px] font-medium cursor-pointer transition-colors ${
                                active
                                  ? "text-content-neutral-950"
                                  : "text-content-neutral-500 hover:text-content-neutral-900"
                              }`}
                            >
                              {active && (
                                <motion.span
                                  layoutId="profile-theme-pill"
                                  transition={SPRING_NAV_GLIDE}
                                  className="absolute inset-0 -z-10 rounded-[8px] bg-surface shadow-xs border border-line-neutral-200/60"
                                />
                              )}
                              <ModeIcon className="w-3.5 h-3.5 relative z-10" />
                              <span className="relative z-10">{mode.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="pt-1.5 space-y-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setProfileOpen(false);
                          openProfileGate("select");
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-2 rounded-[10px] text-[13px] font-medium text-content-neutral-700 hover:bg-surface-neutral-100 text-left cursor-pointer"
                      >
                        <span className="flex items-center gap-2.5">
                          <UsersRound className="w-4 h-4 text-content-neutral-500" />
                          Switch Profile
                        </span>
                        <span className="text-[11px] font-medium text-content-neutral-400">
                          {profiles.length}/{maxProfiles}
                        </span>
                      </button>

                      {activeProfile.hasPassword && (
                        <button
                          type="button"
                          onClick={() => {
                            setProfileOpen(false);
                            lockCurrentProfile();
                          }}
                          className="w-full flex items-center justify-between px-2.5 py-2 rounded-[10px] text-[13px] font-medium text-content-neutral-700 hover:bg-surface-neutral-100 text-left cursor-pointer"
                        >
                          <span className="flex items-center gap-2.5">
                            <Lock className="w-4 h-4 text-content-neutral-500" />
                            Lock Profile
                          </span>
                        </button>
                      )}

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
