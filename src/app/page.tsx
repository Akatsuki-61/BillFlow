"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Layers,
  CheckCircle2,
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
import { motion } from "motion/react";
import { SPRING_NAV_GLIDE } from "@/lib/motion";
import { MotionPresence, MotionSurface } from "@/components/ui/MotionSurface";
import { ContextMenu, ContextMenuItem } from "@/components/ui/ContextMenu";
import { WidgetRenderer } from "@/components/dashboard/WidgetRenderer";
import { useWidgetContext } from "@/context/WidgetContext";
import {
  DEFAULT_DASHBOARD_WIDGET_IDS,
  WIDGET_CATALOG,
} from "@/lib/widgets/widgetDefinitions";
import { SelectDropdown, SelectOption } from "@/components/ui/SelectDropdown";
import { DashboardPeriod } from "@/types/dashboard";

const PERIOD_OPTIONS: SelectOption<DashboardPeriod>[] = [
  { value: "month", label: "This Month" },
  { value: "quarter", label: "This Quarter" },
  { value: "year", label: "This Year" },
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
    ? WIDGET_CATALOG.find((w) => w.id === contextMenu.widgetId)
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
    .map((id) => WIDGET_CATALOG.find((w) => w.id === id))
    .filter((w): w is NonNullable<typeof w> => Boolean(w));

  // Asymmetric Zentra 12-column Bento Span Assignment for BillFlow widgets
  const getColSpanClass = (widgetId: string, baseSize: string) => {
    const size = widgetSizes[widgetId] || "normal";
    const isCompact = size === "compact";

    if (widgetId === "workspace-insights") {
      return isCompact ? "col-span-12 lg:col-span-6" : "col-span-12";
    }
    if (widgetId === "profit-trajectory-chart") {
      return isCompact ? "col-span-12" : "col-span-12 lg:col-span-8";
    }
    if (baseSize === "metric") {
      return isCompact
        ? "col-span-12 sm:col-span-6 lg:col-span-3"
        : "col-span-12 md:col-span-6 lg:col-span-4";
    }
    if (baseSize === "full") {
      return isCompact
        ? "col-span-12 lg:col-span-6"
        : "col-span-12 lg:col-span-8";
    }
    if (baseSize === "wide") {
      return isCompact ? "col-span-12" : "col-span-12 lg:col-span-6";
    }
    return isCompact
      ? "col-span-12 md:col-span-6 lg:col-span-4"
      : "col-span-12 lg:col-span-6";
  };

  return (
    <div className="workspace-page dashboard-page motion-page">
      {/* Toast Notification with Undo Action */}
      <MotionPresence>
        {toastMessage && (
          <MotionSurface
            kind="toast"
            className="fixed bottom-6 right-6 z-[9999] flex items-center justify-between gap-3 px-4 py-2.5 bg-toast text-white rounded-2xl shadow-xl text-[12.5px] font-medium min-w-[280px]"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="text-success-bright text-[14px] shrink-0" />
              <span>{toastMessage}</span>
            </div>
            {toastAction && (
              <button
                type="button"
                onClick={toastAction.onClick}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11.5px] font-semibold bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer border border-white/25 shrink-0"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{toastAction.label}</span>
              </button>
            )}
          </MotionSurface>
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
      <header className="flex flex-wrap items-center justify-between gap-4 pt-1 pb-1">
        <div className="flex items-center gap-3">
          <h1 className="text-[40px] font-medium tracking-[-0.035em] text-content-neutral-950 leading-none">
            Overview
          </h1>
        </div>

        {/* Right: Connected Date Comparison Pill Group + Granularity + Add Widget */}
        <div className="flex items-center gap-2 flex-wrap">
          <SelectDropdown<DashboardPeriod>
            value={period}
            onChange={setPeriod}
            options={PERIOD_OPTIONS}
            icon={<Calendar className="w-3.5 h-3.5" />}
            ariaLabel="Overview period"
            buttonClassName="overview-period-picker font-sans text-[12.5px] font-medium text-content-neutral-900 cursor-pointer"
            menuClassName="w-44"
          />

          <button
            type="button"
            onClick={() => setIsDashboardEditing(!isDashboardEditing)}
            className={`zentra-control-pill ${
              isDashboardEditing
                ? "!bg-[#1c1c1f] !text-white dark:!bg-white dark:!text-[#111115]"
                : ""
            }`}
          >
            <span>{isDashboardEditing ? "Done editing" : "Manage Widget"}</span>
            {isDashboardEditing ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <SlidersHorizontal className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </header>

      {/* Interactive Zentra Widget Drawer & Layout Customizer */}
      <MotionPresence>
        {isDashboardEditing && (
          <MotionSurface
            kind="panel"
            className="flex flex-col gap-4 p-5 rounded-[24px] bg-surface border border-line-neutral-200 shadow-sm"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#1c1c1f] text-white dark:bg-white dark:text-black flex items-center justify-center shrink-0">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-[14.5px] font-semibold text-content-neutral-950 leading-tight">
                    Customize BillFlow Overview Bento Grid
                  </h3>
                  <p className="text-[12px] text-content-neutral-500 mt-0.5">
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
                  title="Undo last change (Cmd+Z)"
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

            {/* Quick Pill Selector for all 24 BillFlow Widgets */}
            <div className="flex flex-wrap gap-2 pt-3 border-t border-line-neutral-100">
              {WIDGET_CATALOG.map((w) => {
                const pinned = isPinnedToDashboard(w.id);
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => toggleDashboard(w.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all cursor-pointer border ${
                      pinned
                        ? "bg-[#1c1c1f] text-white border-[#1c1c1f] dark:bg-white dark:text-[#111115] dark:border-white"
                        : "bg-surface-neutral-50 text-content-neutral-600 border-line-neutral-200 hover:border-line-neutral-300"
                    }`}
                  >
                    {pinned ? (
                      <Check className="w-3 h-3 text-emerald-400 dark:text-emerald-600" />
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
        <div
          className={`dashboard-grid grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-4 ${!isDashboardEditing && dashboardWidgets.join(",") === DEFAULT_DASHBOARD_WIDGET_IDS.join(",") && dashboardWidgets.every((id) => widgetSizes[id] !== "compact") ? "reference-layout" : ""}`}
        >
          {pinnedWidgets.map((w, index) => {
            const colSpan = getColSpanClass(w.id, w.size);
            const isCompact = (widgetSizes[w.id] || "normal") === "compact";
            const isOver = dragOverIndex === index;

            return (
              <motion.div
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
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
