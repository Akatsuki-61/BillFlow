"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useId,
  useCallback,
} from "react";
import Link from "next/link";
import { AnimatePresence, m, MotionConfig } from "motion/react";
import { MotionPresence, MotionSurface } from "@/components/ui/MotionSurface";
import {
  SPRING_NAV_GLIDE,
  SPRING_LIQUID_BUTTON,
  POPOVER_INITIAL_SCALE,
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
  Compass,
  Keyboard,
  Sparkles,
} from "lucide-react";

import { useAiCapture } from "@/context/AiCaptureContext";

import { isNavActive } from "@/lib/navigation";
import { canPinToDashboard } from "@/lib/widgets/widgetDefinitions";
import { useData } from "@/lib/data/DataProvider";
import { useReportingData } from "@/context/ReportingContext";
import { useTheme } from "@/context/ThemeContext";
import { useWidgetContext } from "@/context/WidgetContext";
import { useProfiles } from "@/context/ProfileContext";
import { formatShortcut, useIsMac } from "@/lib/platform-shortcuts";
import {
  PROFILE_AVATAR_ICONS,
  PROFILE_ACCENT_STYLES,
  ProfileAvatarTile,
} from "@/components/profiles/ProfileAvatarTile";
import { remainingPayout } from "@/lib/cashflow-forecast";
import { localDateKey } from "@/lib/visual-metrics";
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

const creationCommands = [
  { title: "New invoice", href: "/invoices?new=1" },
  { title: "New client", href: "/clients?create=1" },
  { title: "New task", href: "/tasks?create=1" },
  { title: "Log expense", href: "/expenses?create=1" },
  { title: "New catalog item", href: "/catalog?create=1" },
  { title: "New vendor", href: "/outsourcing?create=vendor" },
  { title: "New work order", href: "/outsourcing?create=order" },
].map((command, index) => ({
  ...command,
  kind: "Create",
  shortcut: index + 1,
}));

const settingsCommands = [
  {
    title: "Business profile",
    tab: "profile",
    keywords:
      "name role avatar photo accent color primary currency invoice prefix email bank account contact workspace studio phone website address tax id wise paypal password pin security",
  },
  {
    title: "Invoice defaults",
    tab: "invoices",
    keywords:
      "payment terms template logo tax exchange rate PDF download folder export save due date notes numbering sequence signature delivery destination activity history",
  },
  {
    title: "Backup & data",
    tab: "data",
    keywords:
      "data backup import export storage database restore reset clear full application factory privacy",
  },
  {
    title: "Appearance",
    tab: "appearance",
    keywords:
      "theme dark light display date format typeface fonts density spacing notification placement",
  },
  {
    title: "AI & Capture",
    tab: "ai",
    keywords:
      "ai ocr screenshot smart capture llm local model qwen minilm whatsapp email extract invoice",
  },
];

type SearchResult = {
  title: string;
  kind: string;
  href: string;
  keywords?: string;
  shortcut?: number;
};

const recordLink = (route: string, key: string, id: string) =>
  `${route}?${key}=${encodeURIComponent(id)}`;

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    invoices,
    clients,
    tasks,
    catalogItems,
    expenses,
    vendors,
    workOrders,
  } = useData();
  const { preference, setPreference } = useTheme();
  const { isOpen: aiCaptureOpen, toggleDrawer: toggleAiCapture } =
    useAiCapture();
  const { convert, currency: reportingCurrency } = useReportingData();
  const {
    profiles,
    activeProfile,
    maxProfiles,
    isGateOpen,
    openProfileGate,
    lockCurrentProfile,
  } = useProfiles();
  const ActiveProfileIcon =
    PROFILE_AVATAR_ICONS[activeProfile.avatar] ?? UsersRound;
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
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeResult, setActiveResult] = useState(0);
  const [activityDay, setActivityDay] = useState(localDateKey);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const sheenId = useId();
  const isMac = useIsMac();

  const openSearch = useCallback(() => {
    setSearchFocused(true);
    setSearchQuery("");
    setActiveResult(0);
    setSearchOpen(true);
    setNotificationsOpen(false);
    setProfileOpen(false);
  }, []);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchFocused(false);
  }, []);

  const toggleSearch = useCallback(() => {
    if (searchOpen) {
      closeSearch();
    } else {
      openSearch();
    }
  }, [searchOpen, closeSearch, openSearch]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (searchRef.current && !searchRef.current.contains(target)) {
        closeSearch();
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
  }, [closeSearch]);

  useEffect(() => {
    if (searchOpen) {
      const timer = setTimeout(() => searchInputRef.current?.focus(), 40);
      return () => clearTimeout(timer);
    }
  }, [searchOpen]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (isGateOpen) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        toggleSearch();
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
      closeSearch();
      setNotificationsOpen(false);
      setProfileOpen(false);
      openRef?.current?.querySelector<HTMLButtonElement>("button")?.focus();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [
    searchOpen,
    notificationsOpen,
    profileOpen,
    toggleSearch,
    closeSearch,
    isGateOpen,
  ]);

  useEffect(() => {
    const timer = setInterval(() => setActivityDay(localDateKey()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const activeAlerts = useMemo(() => {
    const money = (cents: number, source: string) => {
      if (source === reportingCurrency)
        return `${reportingCurrency} ${formatCents(cents, source)}`;
      const converted = convert(cents, source);
      return converted === null
        ? `${source} ${formatCents(cents, source)} · Conversion unavailable`
        : `${formatCents(converted, reportingCurrency)} (${formatCents(cents, source)} ${source})`;
    };
    const dueTasks = tasks.filter(
      (task) =>
        task.status !== "done" && task.dueDate?.slice(0, 10) === activityDay,
    );
    const unpaid = invoices.filter(
      (invoice) =>
        invoice.status !== "DRAFT" && invoice.paidCents < invoice.amountCents,
    );
    const payouts = workOrders
      .filter((order) => remainingPayout(order) > 0)
      .sort((a, b) =>
        (a.payoutDueDate || "9999").localeCompare(b.payoutDueDate || "9999"),
      );
    const inProgress = tasks.filter(
      (task) =>
        (task.status === "in-progress" || task.status === "review") &&
        !dueTasks.includes(task),
    );
    return [
      ...dueTasks.map((task) => ({
        title: task.title,
        detail: "Task due today",
        href: recordLink("/tasks", "task", task.id),
        amount: "",
      })),
      ...payouts.map((order) => ({
        title: `${order.vendorName || "Vendor"} · ${order.taskTitle || order.scope}`,
        detail: order.payoutDueDate
          ? `${order.payoutDueDate < activityDay ? "Overdue payout" : "Payout due"} · ${order.payoutDueDate}`
          : "Unscheduled payout",
        href: recordLink("/outsourcing", "order", order.id),
        amount: money(remainingPayout(order), order.currency),
      })),
      ...unpaid.map((invoice) => ({
        title: `${invoice.code} · ${invoice.clientName}`,
        detail: invoice.status.replaceAll("_", " "),
        href: recordLink("/invoices", "record", invoice.id),
        amount: money(
          invoice.amountCents - invoice.paidCents,
          invoice.currency,
        ),
      })),
      ...inProgress.map((task) => ({
        title: task.title,
        detail:
          task.status === "review" ? "Task under review" : "Task in progress",
        href: recordLink("/tasks", "task", task.id),
        amount: "",
      })),
    ];
  }, [activityDay, invoices, tasks, workOrders, convert, reportingCurrency]);

  const searchIndex = useMemo<SearchResult[]>(() => {
    if (!searchOpen) return [];
    return [
      ...creationCommands,
      ...mainNavItems.map((page) => ({
        title: page.name,
        kind: "Page",
        href: page.href,
      })),
      { title: "Settings", kind: "Page", href: "/settings" },
      { title: "Support", kind: "Page", href: "/support" },
      ...settingsCommands.map(({ title, tab, keywords }) => ({
        title,
        keywords,
        kind: "Settings",
        href: `/settings?section=${tab}`,
      })),
      ...invoices.map((i) => ({
        title: `${i.code} · ${i.clientName}`,
        kind: "Invoice",
        href: recordLink("/invoices", "record", i.id),
        keywords: [
          i.title,
          i.clientEmail,
          i.status,
          i.currency,
          ...(i.items ?? []).map((item) => item.description),
        ].join(" "),
      })),
      ...clients.map((c) => ({
        title: c.name,
        kind: "Client",
        href: recordLink("/clients", "record", c.id),
        keywords: [
          c.category,
          c.email,
          c.contactPerson,
          c.phone,
          c.whatsappPhone,
          c.relationshipNotes,
          c.billingAddress,
        ].join(" "),
      })),
      ...tasks.map((task) => ({
        title: task.title,
        kind: "Task",
        href: recordLink("/tasks", "task", task.id),
        keywords: [
          task.description,
          task.clientName,
          task.status,
          task.category,
        ].join(" "),
      })),
      ...expenses.map((expense) => ({
        title: expense.merchant || expense.description || "Expense",
        kind: "Expense",
        href: recordLink("/expenses", "expense", expense.id),
        keywords: [
          expense.description,
          expense.category,
          expense.currency,
        ].join(" "),
      })),
      ...catalogItems.map((item) => ({
        title: item.title,
        kind: "Catalog item",
        href: recordLink("/catalog", "item", item.id),
        keywords: [item.sku, item.category, item.description].join(" "),
      })),
      ...vendors.map((vendor) => ({
        title: vendor.name,
        kind: "Vendor",
        href: recordLink("/outsourcing", "vendor", vendor.id),
        keywords: [vendor.service, vendor.email, vendor.phone].join(" "),
      })),
      ...workOrders.map((order) => ({
        title: `VND-INV-${order.id.slice(-8).toUpperCase()} · ${order.taskTitle || order.scope}`,
        kind: "Work order",
        href: recordLink("/outsourcing", "order", order.id),
        keywords: [
          order.vendorName,
          order.scope,
          order.invoiceCode,
          order.clientName,
        ].join(" "),
      })),
    ];
  }, [
    searchOpen,
    invoices,
    clients,
    tasks,
    expenses,
    catalogItems,
    vendors,
    workOrders,
  ]);
  const searchResults = useMemo(() => {
    if (!searchOpen) return [];
    const query = searchQuery.trim().toLowerCase();
    if (!query)
      return searchIndex.filter(
        (entry) => entry.kind === "Create" || entry.kind === "Page",
      );
    const tokens = query.split(/\s+/);
    return searchIndex
      .filter((entry) => {
        const text =
          `${entry.title} ${entry.kind} ${entry.keywords || ""}`.toLowerCase();
        return tokens.every((token) => text.includes(token));
      })
      .sort(
        (a, b) =>
          Number(b.title.toLowerCase().includes(query)) -
          Number(a.title.toLowerCase().includes(query)),
      )
      .slice(0, 60);
  }, [searchOpen, searchIndex, searchQuery]);
  const selectedResult = Math.min(activeResult, searchResults.length - 1);
  const activateResult = (entry: SearchResult) => {
    closeSearch();
    router.push(entry.href);
  };
  const onSearchKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.altKey && /^Digit[1-7]$/.test(event.code)) {
      event.preventDefault();
      activateResult(creationCommands[Number(event.code.slice(-1)) - 1]);
      return;
    }
    if (event.key === "Enter" && selectedResult >= 0) {
      event.preventDefault();
      activateResult(searchResults[selectedResult]);
    } else if (
      (event.key === "ArrowDown" || event.key === "ArrowUp") &&
      searchResults.length
    ) {
      event.preventDefault();
      const next =
        (selectedResult +
          (event.key === "ArrowDown" ? 1 : -1) +
          searchResults.length) %
        searchResults.length;
      setActiveResult(next);
      document
        .getElementById(`${sheenId}-search-${next}`)
        ?.scrollIntoView({ block: "nearest" });
    }
  };

  const dragClass = isGateOpen ? "app-no-drag" : "app-drag-region";

  return (
    <MotionConfig reducedMotion="user">
      <header
        className={`workspace-nav w-full shrink-0 bg-canvas select-none z-30 ${dragClass}`}
      >
        <div className={`workspace-nav-inner ${dragClass}`}>
          {/* Left: Brand Identity */}
          <div className={`flex items-center justify-self-start ${dragClass}`}>
            <Link
              href="/"
              className="flex items-center gap-2.5 shrink-0 group focus:outline-none app-no-drag cursor-pointer"
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
              <span className="text-[20px] font-medium tracking-[-0.035em] text-content-neutral-950 leading-none pointer-events-none">
                BillFlow
              </span>
            </Link>
          </div>

          {/* Center: Middle-Aligned Horizontal Navigation */}
          <nav
            aria-label="Main Navigation"
            className="workspace-nav-track app-no-drag"
          >
            {mainNavItems.map((item) => {
              const isActive = isNavActive(pathname, item.href);
              const isHome = item.id === "dashboard";
              const canDropOnHome =
                isHome && canPinToDashboard(draggedWidgetId);
              const isHomeDropCandidate =
                canDropOnHome && isDragging && dragSource === "analytics";
              const dropState =
                isHome && isHomeDropOver
                  ? "over"
                  : isHomeDropCandidate
                    ? "ready"
                    : undefined;

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  data-tour={`nav-${item.id}`}
                  aria-current={isActive ? "page" : undefined}
                  data-drop-state={dropState}
                  onDragOver={
                    canDropOnHome
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
                    canDropOnHome
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
                    canDropOnHome
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
                  className="workspace-nav-link"
                >
                  {isActive && !dropState && (
                    <m.span
                      aria-hidden="true"
                      className="nav-active-pill"
                      layoutId="main-nav-active"
                      transition={SPRING_NAV_GLIDE}
                    />
                  )}
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Right: Delicate 42px Hairline Utility Circles (Smart Capture, Search, Bell, Profile) */}
          <div className="flex items-center justify-self-end gap-2.5 shrink-0 app-no-drag">
            {/* Smart Invoice Capture Drawer Trigger */}
            <button
              type="button"
              onClick={() => {
                closeSearch();
                setNotificationsOpen(false);
                setProfileOpen(false);
                toggleAiCapture();
              }}
              aria-expanded={aiCaptureOpen}
              aria-label="Smart Capture from screenshot or message"
              title={`Smart Capture (${formatShortcut("Cmd+Shift+I", isMac)})`}
              className={`w-[42px] h-[42px] rounded-full border flex items-center justify-center cursor-pointer transition-colors ${
                aiCaptureOpen
                  ? "border-accent bg-accent-faint text-accent shadow-[0_2px_10px_-2px_color-mix(in_srgb,var(--theme-accent-solid)_30%,transparent)]"
                  : "border-line-neutral-300/80 dark:border-line-neutral-200 bg-transparent hover:bg-surface-bright text-content-neutral-900"
              }`}
            >
              <Sparkles className="w-[17px] h-[17px]" strokeWidth={1.6} />
            </button>

            {/* Quick Search Popover */}
            <div className="relative" ref={searchRef}>
              <button
                type="button"
                data-tour="cmd-search"
                onClick={toggleSearch}
                aria-expanded={searchOpen}
                aria-controls="search-popover"
                aria-label="Search workspace"
                title={`Search workspace (${formatShortcut("Cmd+K", isMac)})`}
                className="w-[42px] h-[42px] rounded-full border border-line-neutral-300/80 dark:border-line-neutral-200 bg-transparent hover:bg-surface-bright flex items-center justify-center text-content-neutral-900 cursor-pointer"
              >
                <Search className="w-[17px] h-[17px]" strokeWidth={1.6} />
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
                      {!searchFocused && searchQuery.length === 0 && (
                        <Search
                          aria-hidden="true"
                          className="w-4 h-4 text-content-neutral-400 absolute left-3.5 pointer-events-none"
                        />
                      )}
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setActiveResult(0);
                        }}
                        onKeyDown={onSearchKey}
                        role="combobox"
                        aria-label="Search workspace records and actions"
                        aria-expanded={searchOpen}
                        aria-autocomplete="list"
                        aria-controls={`${sheenId}-search-results`}
                        aria-activedescendant={
                          selectedResult >= 0
                            ? `${sheenId}-search-${selectedResult}`
                            : undefined
                        }
                        onFocus={() => setSearchFocused(true)}
                        onBlur={() => setSearchFocused(false)}
                        placeholder="Search records, settings and actions…"
                        style={{
                          paddingLeft:
                            !searchFocused && searchQuery.length === 0
                              ? "40px"
                              : "14px",
                          paddingRight:
                            searchQuery.length > 0 ? "34px" : "14px",
                        }}
                        className="ui-field w-full h-9 !min-h-[36px] rounded-[11px] bg-surface-neutral-100 border border-transparent focus:border-line-neutral-300 focus:bg-surface text-[13px] text-content-neutral-900 outline-none"
                      />
                      <AnimatePresence initial={false}>
                        {searchQuery && (
                          <m.button
                            key="clear-search"
                            type="button"
                            initial={{
                              opacity: 0,
                              scale: POPOVER_INITIAL_SCALE,
                            }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: POPOVER_INITIAL_SCALE }}
                            transition={SPRING_LIQUID_BUTTON}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setSearchQuery("");
                              setActiveResult(0);
                              setSearchFocused(true);
                              searchInputRef.current?.focus();
                            }}
                            className="absolute right-2.5 text-content-neutral-400 hover:text-content-neutral-700 cursor-pointer"
                            aria-label="Clear search"
                          >
                            <X className="w-3.5 h-3.5" />
                          </m.button>
                        )}
                      </AnimatePresence>
                    </div>

                    <div
                      id={`${sheenId}-search-results`}
                      role="listbox"
                      aria-label="Workspace search results"
                      className="mt-2.5 max-h-[325px] overflow-y-auto space-y-1 pr-0.5"
                    >
                      {searchResults.map((entry, index) => (
                        <div
                          id={`${sheenId}-search-${index}`}
                          key={entry.href}
                          role="option"
                          aria-selected={selectedResult === index}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => activateResult(entry)}
                          className={`cursor-pointer rounded-lg px-3 py-2 flex items-center gap-2 ${selectedResult === index ? "bg-accent-faint" : "hover:bg-surface-neutral-100"}`}
                        >
                          <span className="text-sm text-content-neutral-950 truncate flex-1">
                            {entry.title}
                          </span>
                          <span className="text-xs text-content-neutral-600 shrink-0">
                            {entry.kind}
                          </span>
                          {entry.shortcut && (
                            <kbd className="text-xs text-content-neutral-600 shrink-0">
                              {formatShortcut(`Alt+${entry.shortcut}`, isMac)}
                            </kbd>
                          )}
                        </div>
                      ))}
                    </div>
                    {!searchResults.length && (
                      <p
                        role="status"
                        className="px-3 py-4 text-sm text-content-neutral-600"
                      >
                        No matches found.
                      </p>
                    )}
                    <p className="mt-2 border-t border-line-neutral-100 pt-2 text-xs text-content-neutral-600">
                      ↑ ↓ Navigate · Enter Open · Esc Close
                    </p>
                  </MotionSurface>
                )}
              </MotionPresence>
            </div>

            {/* Activity & Notifications Button */}
            <div className="relative" ref={notificationsRef}>
              <button
                type="button"
                onClick={() => {
                  setActivityDay(localDateKey());
                  setNotificationsOpen((prev) => !prev);
                  closeSearch();
                  setProfileOpen(false);
                }}
                aria-expanded={notificationsOpen}
                aria-controls="notifications-popover"
                aria-label="Workspace notifications"
                title="Notifications & Activity"
                className="relative w-[42px] h-[42px] rounded-full border border-line-neutral-300/80 dark:border-line-neutral-200 bg-transparent hover:bg-surface-bright flex items-center justify-center text-content-neutral-900 cursor-pointer"
              >
                <Bell className="w-[17px] h-[17px]" strokeWidth={1.6} />
                {activeAlerts.length > 0 && (
                  <span className="absolute top-[10px] right-[11px] w-[7px] h-[7px] rounded-full bg-[#ff4d2a] ring-[1.5px] ring-canvas" />
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
                        Activity
                      </span>
                      <span className="zentra-pill-badge !py-0.5 !px-2 !text-[11px]">
                        {activeAlerts.length} active
                      </span>
                    </div>

                    <div className="py-2.5 space-y-2 max-h-[260px] overflow-y-auto">
                      {activeAlerts.map((alert) => (
                        <Link
                          key={alert.href}
                          href={alert.href}
                          onClick={() => setNotificationsOpen(false)}
                          className="w-full flex items-center justify-between gap-2 p-2.5 rounded-[12px] bg-surface-neutral-50 hover:bg-surface-neutral-100 text-left"
                        >
                          <div className="min-w-0">
                            <p className="text-[12.5px] font-medium text-content-neutral-900 truncate">
                              {alert.title}
                            </p>
                            <p className="text-[11.5px] text-content-neutral-600">
                              {alert.detail}
                            </p>
                          </div>
                          {alert.amount && (
                            <span className="text-xs tabular-nums text-content-neutral-900 shrink-0">
                              {alert.amount}
                            </span>
                          )}
                        </Link>
                      ))}

                      {activeAlerts.length === 0 && (
                        <div className="py-6 text-center text-[12.5px] text-content-neutral-500">
                          No workspace alerts.
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

            {/* Active Profile Avatar Button (crisp 2px iridescent conic ring + white inner spacer) */}
            <div className="relative ml-0.5" ref={profileRef}>
              <button
                type="button"
                onClick={() => {
                  setProfileOpen((prev) => !prev);
                  closeSearch();
                  setNotificationsOpen(false);
                }}
                aria-expanded={profileOpen}
                aria-controls="profile-popover"
                aria-label={`Profile (${activeProfile.name}) and workspace settings`}
                title={`${activeProfile.name} · ${activeProfile.subtitle}`}
                style={{
                  boxShadow: profileOpen
                    ? `0 0 0 3px ${activeProfileStyle.ring}`
                    : "0 2px 8px -2px rgba(0,0,0,0.12)",
                }}
                className="relative w-[42px] h-[42px] p-[2px] rounded-full profile-iridescent-ring flex items-center justify-center cursor-pointer group transition-[transform,box-shadow] duration-200 hover:scale-105"
              >
                <span className="relative w-full h-full rounded-full p-[1.5px] bg-canvas flex items-center justify-center">
                <span
                  className="relative w-full h-full rounded-full overflow-hidden flex items-center justify-center"
                  style={{
                    background: activeProfileStyle.bg,
                    color: activeProfileStyle.iconColor,
                  }}
                >
                  {/* Profile studio geometric contour artwork */}
                  {!activeProfile.photoData && (
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
                  )}
                  {activeProfile.photoData ? (
                    <Image
                      unoptimized
                      src={activeProfile.photoData}
                      alt=""
                      fill
                      sizes="42px"
                      className="z-10 object-cover"
                    />
                  ) : (
                    <ActiveProfileIcon
                      className="w-4 h-4 relative z-10"
                      strokeWidth={2}
                    />
                  )}
                </span>
                </span>

                {activeProfile.hasPassword && (
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-0.5 -right-0.5 z-20 w-3.5 h-3.5 rounded-full bg-zinc-900 text-zinc-100 ring-2 ring-canvas flex items-center justify-center shadow-xs"
                  >
                    <Lock className="w-2 h-2" strokeWidth={2.4} />
                  </span>
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
                        photoData={activeProfile.photoData}
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
                      <div
                        className="ui-segmented ui-segmented--compact !grid grid-cols-3 w-full"
                        role="group"
                        aria-label="Appearance theme"
                      >
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
                              aria-pressed={active}
                              data-has-pill="true"
                              onClick={(e) =>
                                setPreference(mode.id, {
                                  trigger: e.currentTarget,
                                })
                              }
                              className="!px-2 !py-1.5 !min-h-[28px] !text-[11.5px] w-full"
                            >
                              {active && (
                                <m.span
                                  layoutId="profile-theme-pill"
                                  transition={SPRING_NAV_GLIDE}
                                  className="ui-segmented-pill"
                                />
                              )}
                              <ModeIcon className="w-3.5 h-3.5 relative z-10" />
                              <span className="relative z-10">
                                {mode.label}
                              </span>
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
                      <button
                        type="button"
                        onClick={() => {
                          setProfileOpen(false);
                          window.dispatchEvent(new CustomEvent("billflow:start-tour"));
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-2 rounded-[10px] text-[13px] font-medium text-content-neutral-700 hover:bg-surface-neutral-100 text-left cursor-pointer"
                      >
                        <span className="flex items-center gap-2.5">
                          <Compass className="w-4 h-4 text-content-neutral-500" />
                          Interactive Tour
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setProfileOpen(false);
                          window.dispatchEvent(new CustomEvent("billflow:open-shortcuts"));
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-2 rounded-[10px] text-[13px] font-medium text-content-neutral-700 hover:bg-surface-neutral-100 text-left cursor-pointer"
                      >
                        <span className="flex items-center gap-2.5">
                          <Keyboard className="w-4 h-4 text-content-neutral-500" />
                          Keyboard Shortcuts
                        </span>
                        <kbd className="text-[11px] font-mono text-content-neutral-400">
                          {formatShortcut("Cmd+/", isMac)}
                        </kbd>
                      </button>
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
