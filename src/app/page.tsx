"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  SlidersHorizontal,
  ArrowUpRight,
  Layers,
  CheckCircle2,
  Check,
  RotateCcw,
  Sparkles,
  Maximize2,
  Minimize2,
  ArrowLeft,
  ArrowRight,
  Minus,
} from "lucide-react";
import {
  Button,
  PageHeader,
  SegmentedControl,
} from "@/components/ui/Workspace";
import { MotionPresence, MotionSurface } from "@/components/ui/MotionSurface";
import { ContextMenu, ContextMenuItem } from "@/components/ui/ContextMenu";
import { WidgetRenderer } from "@/components/dashboard/WidgetRenderer";
import { useWidgetContext } from "@/context/WidgetContext";
import { WIDGET_CATALOG } from "@/lib/widgets/widgetDefinitions";
import { DashboardPeriod } from "@/types/dashboard";

export default function DashboardPage() {
  const router = useRouter();
  const {
    dashboardWidgets,
    widgetSizes,
    isDashboardEditing,
    setIsDashboardEditing,
    removeFromDashboard,
    toggleWidgetSize,
    moveDashboardWidget,
    resetToDefaults,
    toastMessage,
    toastAction,
    canUndo,
    undoDashboard,
  } = useWidgetContext();

  const [period, setPeriod] = useState<DashboardPeriod>("quarter");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Global keyboard shortcut: Cmd+Z (macOS) / Ctrl+Z (Windows/Linux) for Dashboard Undo.
  // Note: Explicitly bypasses text inputs and textareas to avoid interfering with native text editing.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
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
              ? "Expand to Rectangle"
              : "Expand to Full Width"
            : targetWidgetMeta?.size === "metric"
              ? "Shrink to Square"
              : "Shrink to Half Width",
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

  const periodLabelMap: Record<DashboardPeriod, string> = {
    month: "This Month",
    quarter: "This Quarter",
    year: "Year to Date",
    all: "All Time",
  };

  // Compute responsive column span classes for each widget based on display size
  const getColSpanClass = (widgetId: string, baseSize: string) => {
    const size = widgetSizes[widgetId] || "normal";
    const isCompact = size === "compact";

    if (baseSize === "metric") {
      // Standard Metric: 4 cols out of 12 (1/3 row, rectangle).
      // Compact Metric: 2 cols out of 12 (1/6 row, square-like shape!).
      return isCompact
        ? "col-span-6 sm:col-span-3 md:col-span-3 lg:col-span-2"
        : "col-span-12 sm:col-span-6 md:col-span-3 lg:col-span-4";
    }

    if (baseSize === "full" || baseSize === "wide") {
      // Standard Chart: full 12 cols (100% width).
      // Compact Chart: 6 cols out of 12 (half of full size, side-by-side!).
      return isCompact
        ? "col-span-12 md:col-span-6 lg:col-span-6"
        : "col-span-12";
    }

    // Medium widgets (recent invoices, sprint tasks, gauges, alerts)
    return isCompact
      ? "col-span-12 md:col-span-6 lg:col-span-6"
      : "col-span-12 lg:col-span-6";
  };

  return (
    <div className="workspace-page motion-page">
      {/* Toast Notification with Undo Action */}
      <MotionPresence>
        {toastMessage && (
          <MotionSurface
            kind="toast"
            className="fixed bottom-6 right-6 z-[9999] flex items-center justify-between gap-3 px-4 py-2.5 bg-toast text-white rounded-xl shadow-xl text-[12px] font-medium min-w-[280px]"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="text-success-bright text-[13px] shrink-0" />
              <span>{toastMessage}</span>
            </div>
            {toastAction && (
              <button
                type="button"
                onClick={toastAction.onClick}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer border border-white/25 shrink-0"
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

      {/* Header Section */}
      <PageHeader
        title="Dashboard"
        description="Welcome back. Here is your business health, profit growth, and operations summary."
      >
        <div className="flex items-center gap-2 flex-wrap">
          {/* Period Selector */}
          <SegmentedControl
            value={period}
            onChange={setPeriod}
            label="Dashboard period"
            options={(
              ["month", "quarter", "year", "all"] as DashboardPeriod[]
            ).map((value) => ({
              value,
              label:
                value === "all"
                  ? "All"
                  : value[0].toUpperCase() + value.slice(1),
            }))}
          />

          {/* Discreet icon-only customize button: toggles dashboard rearrangement mode */}
          <Button
            variant={isDashboardEditing ? "primary" : "ghost"}
            size="icon"
            onClick={() => setIsDashboardEditing(!isDashboardEditing)}
            title={
              isDashboardEditing
                ? "Done customizing"
                : "Rearrange and resize widgets"
            }
            className={`w-8 h-8 transition-all ${
              isDashboardEditing
                ? "bg-accent-solid text-white shadow-xs"
                : "text-content-neutral-400 hover:text-content-neutral-700 opacity-60 hover:opacity-100"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </Button>
        </div>
      </PageHeader>

      {/* Customization Toolbar when customize mode is active */}
      <MotionPresence>
        {isDashboardEditing && (
          <MotionSurface
            kind="panel"
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-surface-purple-50/80 border border-line-purple-200/90 shadow-xs"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-accent-solid text-white flex items-center justify-center shrink-0 shadow-xs">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-content-neutral-900 leading-tight">
                  Dashboard Rearrange & Resize Mode
                </h3>
                <p className="text-[11px] text-content-neutral-500 mt-0.5">
                  Drag tiles to reorder. Click the resize icon on any card to
                  toggle between square/half-size and standard.
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
                <span>Manage in Analytics</span>
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
          </MotionSurface>
        )}
      </MotionPresence>

      {/* Main Dashboard Widget Feed */}
      {pinnedWidgets.length === 0 ? (
        <div className="p-12 text-center bg-surface rounded-2xl border border-dashed border-line-neutral-300">
          <Layers className="w-10 h-10 text-content-neutral-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-content-neutral-900">
            No widgets pinned to Dashboard
          </h3>
          <p className="text-xs text-content-neutral-500 mt-1 max-w-sm mx-auto">
            Your dashboard is clear. Choose widgets to display or restore previous layout.
          </p>
          <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
            <Button
              variant="primary"
              onClick={() => router.push("/analytics")}
              className="gap-1.5"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Browse in Analytics</span>
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
            <Button
              variant="ghost"
              onClick={resetToDefaults}
            >
              Restore Defaults
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-3 text-xs text-content-neutral-500 font-medium">
            <span>Key Business Metrics ({periodLabelMap[period]})</span>
            <span className="text-[11px] text-content-neutral-400">
              {pinnedWidgets.length} widgets active · Hover any card to resize or remove
            </span>
          </div>

          {/* Unified 12-Column Responsive Dashboard Grid */}
          <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-4">
            {pinnedWidgets.map((w, index) => {
              const colSpan = getColSpanClass(w.id, w.size);
              const isCompact = (widgetSizes[w.id] || "normal") === "compact";
              const isOver = dragOverIndex === index;

              return (
                <div
                  key={w.id}
                  className={`${colSpan} transition-all duration-200 ${
                    isOver
                      ? "ring-2 ring-accent ring-offset-2 rounded-2xl scale-[1.02]"
                      : ""
                  }`}
                  onDragOver={(e) => {
                    if (isDashboardEditing) {
                      e.preventDefault();
                      setDragOverIndex(index);
                    }
                  }}
                  onDragLeave={() => {
                    if (isDashboardEditing) {
                      setDragOverIndex((curr) =>
                        curr === index ? null : curr,
                      );
                    }
                  }}
                  onDrop={(e) => {
                    if (isDashboardEditing && draggedIndex !== null) {
                      e.preventDefault();
                      moveDashboardWidget(draggedIndex, index);
                      setDraggedIndex(null);
                      setDragOverIndex(null);
                    }
                  }}
                >
                  <WidgetRenderer
                    widgetId={w.id}
                    source="dashboard"
                    period={period}
                    displaySize={isCompact ? "compact" : "normal"}
                    isDraggable={isDashboardEditing}
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
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

