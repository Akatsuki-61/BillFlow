"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  SlidersHorizontal,
  Minus,
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
} from "lucide-react";
import {
  Button,
  PageHeader,
  SegmentedControl,
} from "@/components/ui/Workspace";
import { MotionPresence, MotionSurface } from "@/components/ui/MotionSurface";
import { ContextMenu, ContextMenuItem } from "@/components/ui/ContextMenu";
import { WidgetRenderer } from "@/components/widgets/WidgetRenderer";
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
  } = useWidgetContext();

  const [period, setPeriod] = useState<DashboardPeriod>("quarter");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

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
            <Maximize2 className="w-3.5 h-3.5 text-[#7c3aed]" />
          ) : (
            <Minimize2 className="w-3.5 h-3.5 text-[#7c3aed]" />
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
      {/* Toast Notification */}
      <MotionPresence>
        {toastMessage && (
          <MotionSurface
            kind="toast"
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 bg-[#18181b] text-white rounded-xl shadow-lg text-[12px] font-medium"
          >
            <CheckCircle2 className="text-[#34d399] text-[13px]" />
            <span>{toastMessage}</span>
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
          {/* Period Selector kept on the left */}
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
                ? "bg-[#7c3aed] text-white shadow-xs"
                : "text-neutral-400 hover:text-neutral-700 opacity-60 hover:opacity-100"
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
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-purple-50/80 border border-purple-200/90 shadow-xs"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#7c3aed] text-white flex items-center justify-center shrink-0 shadow-xs">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-neutral-900 leading-tight">
                  Dashboard Rearrange & Resize Mode
                </h3>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  Drag tiles to reorder. Click the resize icon on any card to
                  toggle between square/half-size and standard.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
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
        <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-neutral-300">
          <Layers className="w-10 h-10 text-neutral-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-neutral-900">
            No widgets pinned to Dashboard
          </h3>
          <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
            Your dashboard is clear. Head over to the Analytics board to drag
            widgets onto the sidebar or right-click to pin them.
          </p>
          <Button
            variant="primary"
            onClick={() => router.push("/analytics")}
            className="mt-4"
          >
            Browse Widgets in Analytics
          </Button>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-3 text-xs text-neutral-500 font-medium">
            <span>Key Business Metrics ({periodLabelMap[period]})</span>
            <span className="text-[11px] text-neutral-400">
              {pinnedWidgets.length} widgets active · Right-click any tile to
              resize or remove
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
                      ? "ring-2 ring-[#7c3aed] ring-offset-2 rounded-2xl scale-[1.02]"
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
