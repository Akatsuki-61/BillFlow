"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  SlidersHorizontal,
  Minus,
  ArrowUpRight,
  X,
  Layers,
  CheckCircle2,
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
  const { dashboardWidgets, removeFromDashboard, toastMessage } =
    useWidgetContext();

  const [period, setPeriod] = useState<DashboardPeriod>("quarter");

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

  const contextMenuItems: ContextMenuItem[] = contextMenu.widgetId
    ? [
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

  // Categorize pinned dashboard widgets
  const pinnedWidgets = dashboardWidgets
    .map((id) => WIDGET_CATALOG.find((w) => w.id === id))
    .filter((w): w is NonNullable<typeof w> => Boolean(w));

  const metricWidgets = pinnedWidgets.filter((w) => w.size === "metric");
  const chartWidgets = pinnedWidgets.filter(
    (w) => w.id === "profit-trajectory-chart" || w.id === "revenue-expenses-chart",
  );
  const otherWidgets = pinnedWidgets.filter(
    (w) => !metricWidgets.includes(w) && !chartWidgets.includes(w),
  );

  const periodLabelMap: Record<DashboardPeriod, string> = {
    month: "This Month",
    quarter: "This Quarter",
    year: "Year to Date",
    all: "All Time",
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

          {/* Discreet icon-only customize button: no text, compact, non-intrusive */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/analytics")}
            title="Manage and configure widgets in Analytics"
            className="w-8 h-8 text-neutral-400 hover:text-neutral-700 opacity-60 hover:opacity-100 transition-opacity"
          >
            <SlidersHorizontal className="w-3 h-3" />
          </Button>
        </div>
      </PageHeader>

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
        <div className="space-y-6">
          {/* Section 1: KPI Metric Cards */}
          {metricWidgets.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3 text-xs text-neutral-500 font-medium">
                <span>Key Business Metrics ({periodLabelMap[period]})</span>
                <span className="text-[11px] text-neutral-400">
                  {metricWidgets.length} metrics pinned · Right-click any tile to
                  remove
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {metricWidgets.map((w) => (
                  <WidgetRenderer
                    key={w.id}
                    widgetId={w.id}
                    source="dashboard"
                    period={period}
                    onContextMenu={handleContextMenu}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Section 2: Charts */}
          {chartWidgets.length > 0 && (
            <div className="space-y-6">
              {chartWidgets.map((w) => (
                <WidgetRenderer
                  key={w.id}
                  widgetId={w.id}
                  source="dashboard"
                  period={period}
                  onContextMenu={handleContextMenu}
                />
              ))}
            </div>
          )}

          {/* Section 3: Operational Feeds & Activity */}
          {otherWidgets.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {otherWidgets.map((w) => (
                <WidgetRenderer
                  key={w.id}
                  widgetId={w.id}
                  source="dashboard"
                  period={period}
                  onContextMenu={handleContextMenu}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
