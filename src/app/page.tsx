"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Layers,
  Check,
  RotateCcw,
  Maximize2,
  Minimize2,
  ArrowLeft,
  ArrowRight,
  Minus,
  Calendar,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/Workspace";
import { m } from "motion/react";
import { SPRING_NAV_GLIDE } from "@/lib/motion";
import {
  IconCrossfade,
  MotionPresence,
  MotionSurface,
} from "@/components/ui/MotionSurface";
import { ContextMenu, ContextMenuItem } from "@/components/ui/ContextMenu";
import { ToastBanner } from "@/components/ui/ToastBanner";
import { WidgetRenderer } from "@/components/dashboard/WidgetRenderer";
import { DashboardMetricsProvider } from "@/components/dashboard/DashboardMetricsContext";
import { useWidgetContext } from "@/context/WidgetContext";
import {
  DASHBOARD_WIDGET_CATALOG,
  DEFAULT_DASHBOARD_WIDGET_IDS,
} from "@/lib/widgets/widgetDefinitions";
import { SelectDropdown, SelectOption } from "@/components/ui/SelectDropdown";
import { formatShortcut, useIsMac } from "@/lib/platform-shortcuts";
import { DashboardPeriod } from "@/types/dashboard";
import "@/components/dashboard/ledger-widgets.css";

const PERIOD_OPTIONS: SelectOption<DashboardPeriod>[] = [
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
  { value: "quarter", label: "Quarterly" },
  { value: "year", label: "Yearly" },
  { value: "all", label: "All Time" },
];

export default function DashboardPage() {
  const router = useRouter();
  const {
    dashboardWidgets,
    widgetSizes,
    draggedWidgetId,
    isDashboardEditing,
    setIsDashboardEditing,
    toggleDashboard,
    isPinnedToDashboard,
    removeFromDashboard,
    toggleWidgetSize,
    moveDashboardWidget,
    moveDashboardWidgetById,
    resetToDefaults,
    toastMessage,
    toastAction,
    canUndo,
    undoDashboard,
  } = useWidgetContext();

  const [period, setPeriod] = useState<DashboardPeriod>("quarter");
  const isMac = useIsMac();
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const lastSwapRef = useRef<{ pair: string; time: number }>({
    pair: "",
    time: 0,
  });

  // Global keyboard shortcut: Cmd+Z / Ctrl+Z for Dashboard Undo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === "z" &&
        !e.shiftKey
      ) {
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable)
        ) {
          return;
        }
        if (canUndo) {
          e.preventDefault();
          undoDashboard();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canUndo, undoDashboard]);

  // Context menu state for right-click on tiles
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    widgetId: string | null;
  }>({
    isOpen: false,
    x: 0,
    y: 0,
    widgetId: null,
  });

  const handleContextMenu = (e: React.MouseEvent, widgetId: string) => {
    e.preventDefault();
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      widgetId,
    });
  };

  const closeContextMenu = () => {
    setContextMenu({ isOpen: false, x: 0, y: 0, widgetId: null });
  };

  const targetWidgetIndex = contextMenu.widgetId
    ? dashboardWidgets.indexOf(contextMenu.widgetId)
    : -1;

  const targetWidgetMeta = contextMenu.widgetId
    ? DASHBOARD_WIDGET_CATALOG.find((w) => w.id === contextMenu.widgetId)
    : null;

  const isTargetCompact = contextMenu.widgetId
    ? widgetSizes[contextMenu.widgetId] === "compact"
    : false;

  const contextMenuItems: ContextMenuItem[] = contextMenu.widgetId
    ? [
        {
          label: isTargetCompact
            ? targetWidgetMeta?.size === "metric"
              ? "Expand to Standard Bento"
              : "Expand to Wide Bento"
            : targetWidgetMeta?.size === "metric"
              ? "Shrink to Compact Card"
              : "Toggle Bento Width",
          icon: isTargetCompact ? (
            <Maximize2 className="w-3.5 h-3.5 text-accent" />
          ) : (
            <Minimize2 className="w-3.5 h-3.5 text-accent" />
          ),
          onClick: () => {
            if (contextMenu.widgetId) {
              toggleWidgetSize(contextMenu.widgetId);
            }
          },
        },
        ...(targetWidgetIndex > 0
          ? [
              {
                label: "Move Left / Earlier",
                icon: <ArrowLeft className="w-3.5 h-3.5" />,
                onClick: () => {
                  moveDashboardWidget(targetWidgetIndex, targetWidgetIndex - 1);
                },
              },
            ]
          : []),
        ...(targetWidgetIndex >= 0 &&
        targetWidgetIndex < dashboardWidgets.length - 1
          ? [
              {
                label: "Move Right / Later",
                icon: <ArrowRight className="w-3.5 h-3.5" />,
                onClick: () => {
                  moveDashboardWidget(targetWidgetIndex, targetWidgetIndex + 1);
                },
              },
            ]
          : []),
        {
          label: "Remove from Dashboard",
          icon: <Minus className="w-3.5 h-3.5" />,
          onClick: () => {
            if (contextMenu.widgetId) {
              removeFromDashboard(contextMenu.widgetId);
            }
          },
          tone: "danger",
        },
        {
          label: "View in Analytics",
          icon: <ArrowUpRight className="w-3.5 h-3.5" />,
          onClick: () => {
            router.push("/analytics");
          },
        },
      ]
    : [];



  // Pinned dashboard widgets resolved in current order
  const pinnedWidgets = dashboardWidgets
    .map((id) => DASHBOARD_WIDGET_CATALOG.find((w) => w.id === id))
    .filter((w): w is NonNullable<typeof w> => Boolean(w));

  // 5-Card Asymmetric Zentra Bento Layout (Row 1: 8+4; Row 2: 5 tall + [7 stacked 2x])
  const getColSpanClass = (widgetId: string, baseSize: string) => {
    const size = widgetSizes[widgetId] || "normal";
    const isCompact = size === "compact";

    if (!isCompact) {
      if (widgetId === "profit-trajectory-chart") {
        return "col-span-2 md:col-span-6 lg:col-span-8";
      }
      if (widgetId === "total-revenue") {
        return "col-span-2 md:col-span-6 lg:col-span-4";
      }
      if (widgetId === "net-profit") {
        return "col-span-2 md:col-span-3 md:row-span-2 lg:col-span-5 lg:row-span-2";
      }
      if (widgetId === "pending-receivables" || widgetId === "active-clients") {
        return "col-span-2 md:col-span-3 lg:col-span-7";
      }
      if (widgetId === "cash-flow" || widgetId === "recent-invoices") {
        return "col-span-2 md:col-span-4 lg:col-span-8";
      }
      if (widgetId === "collection-rate-gauge") {
        return "col-span-2 md:col-span-2 lg:col-span-4";
      }
    }

    if (baseSize === "metric") {
      const span = DEFAULT_DASHBOARD_WIDGET_IDS.includes(widgetId)
        ? "col-span-2"
        : "col-span-2";
      return isCompact
        ? `${span} md:col-span-2 lg:col-span-3`
        : `${span} md:col-span-3 lg:col-span-3`;
    }
    if (baseSize === "full") {
      return isCompact
        ? "col-span-2 md:col-span-6 lg:col-span-6"
        : "col-span-2 md:col-span-6 lg:col-span-12";
    }
    if (baseSize === "medium") {
      return isCompact
        ? "col-span-2 md:col-span-3 lg:col-span-3"
        : "col-span-2 md:col-span-3 lg:col-span-4";
    }
    if (baseSize === "wide") {
      return isCompact
        ? "col-span-2 md:col-span-3 lg:col-span-4"
        : "col-span-2 md:col-span-6 lg:col-span-6";
    }
    return isCompact
      ? "col-span-2 md:col-span-3 lg:col-span-4"
      : "col-span-2 md:col-span-6 lg:col-span-6";
  };

  return (
    <div className="workspace-page dashboard-page motion-page">
      {/* Unified Accent Toast Notification with Undo Action */}
      <MotionPresence>
        {toastMessage && (
          <ToastBanner
            message={toastMessage}
            action={toastAction}
          />
        )}
      </MotionPresence>

      {/* Right-click Context Menu */}
      <ContextMenu
        isOpen={contextMenu.isOpen}
        x={contextMenu.x}
        y={contextMenu.y}
        onClose={closeContextMenu}
        items={contextMenuItems}
      />

      {/* Zentra Overview Top Sub-Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 pt-1 pb-2">
        <div className="flex items-center gap-3.5">
          <h1 className="text-[40px] sm:text-[44px] font-normal tracking-[-0.035em] text-content-neutral-950 leading-none">
            Overview
          </h1>
        </div>

        {/* Right: Single Period Selector (Weekly/Monthly/Quarterly/Yearly/All Time) + Add widget + */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <SelectDropdown<DashboardPeriod>
            value={period}
            onChange={setPeriod}
            options={PERIOD_OPTIONS}
            icon={<Calendar className="w-4 h-4 text-content-neutral-600" strokeWidth={1.65} />}
            ariaLabel="Reporting period"
            buttonClassName="zentra-control-pill--white"
            menuClassName="w-40"
          />

          <button
            type="button"
            onClick={() => setIsDashboardEditing(!isDashboardEditing)}
            className={
              isDashboardEditing
                ? "ui-button ui-button--primary !min-h-[40px] !h-[40px] !px-4 !rounded-[12px] !text-[13px]"
                : "zentra-control-pill"
            }
          >
            <span>{isDashboardEditing ? "Done" : "Add widget"}</span>
            <IconCrossfade
              iconKey={isDashboardEditing ? "done" : "add"}
              className="w-3.5 h-3.5"
            >
              {isDashboardEditing ? (
                <Check className="w-3.5 h-3.5" strokeWidth={2.2} />
              ) : (
                <Plus className="w-3.5 h-3.5" strokeWidth={2} />
              )}
            </IconCrossfade>
          </button>
        </div>
      </header>

      {/* Interactive Zentra Widget Drawer & Layout Customizer */}
      <MotionPresence>
        {isDashboardEditing && (
          <MotionSurface
            kind="panel"
            className="flex flex-col gap-4 p-5 rounded-[26px] bg-[var(--ui-surface)] border border-[var(--ui-card-rim)] shadow-[var(--ui-card-shadow)]"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-accent-solid text-white flex items-center justify-center shrink-0">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-[15px] font-medium text-content-neutral-950 leading-tight">
                    Customize BillFlow Overview Bento Grid
                  </h3>
                  <p className="text-[12.5px] text-content-neutral-500 mt-0.5">
                    Toggle widgets below to pin or unpin them, drag tiles to
                    reorder, or right-click any card to resize.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <Button
                  variant="ghost"
                  size="small"
                  onClick={undoDashboard}
                  disabled={!canUndo}
                  title={`Undo last change (${formatShortcut("Cmd+Z", isMac)})`}
                  className="gap-1.5"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Undo</span>
                </Button>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => router.push("/analytics")}
                  className="gap-1.5"
                >
                  <ArrowUpRight className="w-3 h-3" />
                  <span>Full Analytics Catalog</span>
                </Button>
                <Button
                  variant="ghost"
                  size="small"
                  onClick={resetToDefaults}
                  title="Reset to default arrangement"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </Button>
                <Button
                  variant="primary"
                  size="small"
                  onClick={() => setIsDashboardEditing(false)}
                >
                  <Check className="w-3 h-3" />
                  <span>Done</span>
                </Button>
              </div>
            </div>

            {/* Quick Pill Selector for all BillFlow Widgets */}
            <div className="flex flex-wrap gap-2 pt-3 border-t border-[var(--ui-border-hairline)]">
              {DASHBOARD_WIDGET_CATALOG.map((w) => {
                const pinned = isPinnedToDashboard(w.id);
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => toggleDashboard(w.id)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12.5px] font-medium transition-all cursor-pointer border ${
                      pinned
                        ? "bg-accent-solid text-white border-accent-solid shadow-xs"
                        : "bg-[var(--ui-surface-pure)] text-content-neutral-600 border-[var(--ui-border)] hover:border-border-accent hover:text-content-neutral-950"
                    }`}
                  >
                    {pinned ? (
                      <Check className="w-3 h-3 text-white" strokeWidth={2.4} />
                    ) : (
                      <Plus className="w-3 h-3 text-content-neutral-400" />
                    )}
                    <span>{w.title}</span>
                  </button>
                );
              })}
            </div>
          </MotionSurface>
        )}
      </MotionPresence>

      {/* =====================================================================
          UNIFIED BILLFLOW ZENTRA BENTO GRID
         ===================================================================== */}
      {pinnedWidgets.length === 0 ? (
        <div className="p-12 text-center ui-card">
          <Layers className="w-10 h-10 text-content-neutral-400 mx-auto mb-3" />
          <h3 className="text-base font-medium text-content-neutral-900">
            No widgets pinned to Overview
          </h3>
          <p className="text-xs text-content-neutral-500 mt-1 max-w-sm mx-auto">
            Add BillFlow widgets using the button above or restore the default
            bento layout.
          </p>
          <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
            <Button
              variant="primary"
              onClick={resetToDefaults}
              className="gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restore Default Bento Grid</span>
            </Button>
            {canUndo && (
              <Button
                variant="secondary"
                onClick={undoDashboard}
                className="gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Undo Removal</span>
              </Button>
            )}
          </div>
        </div>
      ) : (
        <DashboardMetricsProvider period={period}>
          <div className="dashboard-grid grid grid-cols-2 grid-flow-dense gap-3.5 md:grid-cols-6 md:gap-4 lg:grid-cols-12">
            {pinnedWidgets.map((w, index) => {
            const colSpan = getColSpanClass(w.id, w.size);
            const isCompact = (widgetSizes[w.id] || "normal") === "compact";
            const isOver = dragOverIndex === index;

            return (
              <m.div
                key={w.id}
                layout="position"
                transition={SPRING_NAV_GLIDE}
                data-widget={w.id}
                onDragEnd={() => {
                  setDragOverIndex(null);
                }}
                className={`${colSpan} transition-shadow duration-200 ${
                  isOver && draggedWidgetId !== w.id
                    ? "ring-2 ring-accent ring-offset-2 rounded-[24px] scale-[1.01]"
                    : ""
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDragOverIndex(index);
                  if (!draggedWidgetId || draggedWidgetId === w.id) return;
                  const now = performance.now();
                  const pairKey = [draggedWidgetId, w.id].sort().join("::");
                  if (
                    lastSwapRef.current.pair === pairKey &&
                    now - lastSwapRef.current.time < 180
                  ) {
                    return;
                  }
                  lastSwapRef.current = { pair: pairKey, time: now };
                  moveDashboardWidgetById(draggedWidgetId, w.id);
                }}
                onDragLeave={() => {
                  setDragOverIndex((curr) => (curr === index ? null : curr));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const fromId =
                    draggedWidgetId || e.dataTransfer.getData("text/plain");
                  if (fromId && fromId !== w.id) {
                    moveDashboardWidgetById(fromId, w.id);
                  }
                  setDragOverIndex(null);
                }}
              >
                <WidgetRenderer
                  widgetId={w.id}
                  source="dashboard"
                  period={period}
                  displaySize={isCompact ? "compact" : "normal"}
                  isDraggable={true}
                  isEditing={isDashboardEditing}
                  onToggleSize={() => toggleWidgetSize(w.id)}
                  onMoveLeft={
                    index > 0
                      ? () => moveDashboardWidget(index, index - 1)
                      : undefined
                  }
                  onMoveRight={
                    index < pinnedWidgets.length - 1
                      ? () => moveDashboardWidget(index, index + 1)
                      : undefined
                  }
                  onRemove={() => removeFromDashboard(w.id)}
                  onContextMenu={handleContextMenu}
                />
              </m.div>
            );
          })}
          </div>
        </DashboardMetricsProvider>
      )}
    </div>
  );
}
