"use client";

import React, { useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  SlidersHorizontal,
  Plus,
  Minus,
  EyeOff,
  RotateCcw,
  X,
  Sparkles,
} from "lucide-react";
import {
  Button,
  PageHeader,
  SegmentedControl,
  Switch,
} from "@/components/ui/Workspace";
import { MotionPresence, MotionSurface } from "@/components/ui/MotionSurface";
import { ContextMenu, ContextMenuItem } from "@/components/ui/ContextMenu";
import { WidgetRenderer } from "@/components/dashboard/WidgetRenderer";
import { useWidgetContext } from "@/context/WidgetContext";
import { WIDGET_CATALOG } from "@/lib/widgets/widgetDefinitions";
import { Timeframe } from "@/types/analytics";
import "./analytics.css";

const quarterOptions = Array.from({ length: 4 }, (_, offset) => {
  const date = new Date();
  const quarterIndex =
    date.getFullYear() * 4 + Math.floor(date.getMonth() / 3) - offset;
  return `Q${(quarterIndex % 4) + 1} ${Math.floor(quarterIndex / 4)}`;
});

export default function AnalyticsView() {
  const {
    analyticsWidgets,
    dashboardWidgets,
    pinToDashboard,
    removeFromDashboard,
    isPinnedToDashboard,
    toggleAnalytics,
    showAllAnalytics,
    resetToDefaults,
    toastMessage,
    showToast,
  } = useWidgetContext();

  // Selected timeframe filter state: Month, Quarter, or Year
  const [timeframe, setTimeframe] = useState<Timeframe>("Quarter");
  const [selectedQuarter, setSelectedQuarter] = useState(quarterOptions[0]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);

  // Context menu state
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

  const isTargetPinned = contextMenu.widgetId
    ? isPinnedToDashboard(contextMenu.widgetId)
    : false;

  const contextMenuItems: ContextMenuItem[] = contextMenu.widgetId
    ? [
        isTargetPinned
          ? {
              label: "Remove from Dashboard",
              icon: <Minus className="w-3.5 h-3.5" />,
              onClick: () => {
                if (contextMenu.widgetId) {
                  removeFromDashboard(contextMenu.widgetId);
                }
              },
            }
          : {
              label: "Send to Dashboard",
              icon: <Plus className="w-3.5 h-3.5 text-accent" />,
              onClick: () => {
                if (contextMenu.widgetId) {
                  pinToDashboard(contextMenu.widgetId);
                }
              },
            },
        {
          label: "Hide from Analytics",
          icon: <EyeOff className="w-3.5 h-3.5" />,
          onClick: () => {
            if (contextMenu.widgetId) {
              toggleAnalytics(contextMenu.widgetId);
            }
          },
          tone: "danger",
        },
      ]
    : [];

  // Categorize visible widgets
  const visibleWidgets = WIDGET_CATALOG.filter((w) =>
    analyticsWidgets.includes(w.id),
  );
  const metricWidgets = visibleWidgets.filter((w) => w.size === "metric");
  const chartWidgets = visibleWidgets.filter(
    (w) => w.category === "charts" && w.size !== "medium",
  );
  const otherWidgets = visibleWidgets.filter(
    (w) => !metricWidgets.includes(w) && !chartWidgets.includes(w),
  );

  return (
    <div className="workspace-page motion-page analytics-page-container">
      {/* Toast Feedback Notification */}
      <MotionPresence>
        {toastMessage && (
          <MotionSurface
            kind="toast"
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 bg-toast text-white rounded-xl shadow-lg text-[12px] font-medium"
          >
            <CheckCircle2 className="text-success-bright text-[13px]" />
            <span>{toastMessage}</span>
          </MotionSurface>
        )}
      </MotionPresence>

      {/* Right Click Context Menu */}
      <ContextMenu
        isOpen={contextMenu.isOpen}
        x={contextMenu.x}
        y={contextMenu.y}
        onClose={closeContextMenu}
        items={contextMenuItems}
      />

      {/* Top Header */}
      <PageHeader
        title="Analytics & Financial Performance"
        description="Executive financial intelligence and real-time operational analytics. Monitor cashflow velocity, profit margins, contractor allocations, and collection efficiency across billing cycles."
      >
        <div className="analytics-header-controls">
          <SegmentedControl
            value={timeframe}
            onChange={setTimeframe}
            label="Analytics period"
            options={(["Month", "Quarter", "Year"] as Timeframe[]).map(
              (value) => ({ value, label: value }),
            )}
          />

          {/* Quarter Dropdown */}
          <div className="analytics-dropdown-relative">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              aria-expanded={isDropdownOpen}
            >
              <CalendarDays className="text-[11px] text-text-muted" />
              <span>{selectedQuarter}</span>
              <ChevronDown className="motion-chevron text-[9px] text-text-placeholder ml-0.5" />
            </Button>

            <MotionPresence>
              {isDropdownOpen && (
                <MotionSurface
                  kind="menu"
                  className="absolute right-0 mt-1.5 w-36 bg-canvas border border-border-muted rounded-xl shadow-lg z-20 py-1 overflow-hidden"
                >
                  {quarterOptions.map((q) => (
                    <Button
                      variant="menu"
                      aria-pressed={selectedQuarter === q}
                      key={q}
                      type="button"
                      onClick={() => {
                        setSelectedQuarter(q);
                        setIsDropdownOpen(false);
                        showToast(`Filtered to ${q}`);
                      }}
                    >
                      {q}
                    </Button>
                  ))}
                </MotionSurface>
              )}
            </MotionPresence>
          </div>

          {/* Customize Analytics Button */}
          <Button
            variant="secondary"
            onClick={() => setIsCustomizeModalOpen(true)}
            title="Configure widgets visible in Analytics"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-accent" />
            <span>Customize</span>
          </Button>
        </div>
      </PageHeader>

      {/* Empty State when all widgets are hidden */}
      {visibleWidgets.length === 0 ? (
        <div className="p-12 text-center bg-surface rounded-2xl border border-dashed border-line-neutral-300">
          <EyeOff className="w-10 h-10 text-content-neutral-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-content-neutral-900">
            All analytics widgets are currently hidden
          </h3>
          <p className="text-xs text-content-neutral-500 mt-1 max-w-md mx-auto">
            You can re-enable any of the 18 business metrics, charts, and feeds
            from the widget customizer.
          </p>
          <Button
            variant="primary"
            onClick={showAllAnalytics}
            className="mt-4"
          >
            Show All 18 Widgets
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Section 1: KPI Metrics Grid */}
          {metricWidgets.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3 text-xs">
                <div>
                  <h2 className="font-semibold text-content-neutral-800 tracking-tight uppercase text-[11px]">
                    Key Business Indicators ({selectedQuarter})
                  </h2>
                  <p className="text-[11px] text-content-neutral-500 mt-0.5">
                    Core financial health, active retainers, and operating margins.
                  </p>
                </div>
                <span className="text-[11px] text-content-neutral-500 font-medium bg-surface-neutral-100 px-2 py-0.5 rounded-md">
                  {metricWidgets.length} KPIs active
                </span>
              </div>
              <div className="analytics-metrics-grid">
                {metricWidgets.map((w) => (
                  <WidgetRenderer
                    key={w.id}
                    widgetId={w.id}
                    source="analytics"
                    period={
                      timeframe === "Month"
                        ? "month"
                        : timeframe === "Year"
                          ? "year"
                          : "quarter"
                    }
                    isDraggable={true}
                    onContextMenu={handleContextMenu}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Section 2: Charts & Visualizations (Side-by-Side on Desktop) */}
          {chartWidgets.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div>
                  <h2 className="font-semibold text-content-neutral-800 tracking-tight uppercase text-[11px]">
                    Financial Velocity & Profit Trajectory
                  </h2>
                  <p className="text-[11px] text-content-neutral-500 mt-0.5">
                    6-month rolling cashflow intake, contractor disbursements, and retained net earnings.
                  </p>
                </div>
                <span className="text-[11px] font-medium text-accent bg-surface-purple-50 border border-line-purple-200/60 px-2 py-0.5 rounded-md">
                  Interactive Visualizations
                </span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {chartWidgets.map((w) => (
                  <WidgetRenderer
                    key={w.id}
                    widgetId={w.id}
                    source="analytics"
                    period={
                      timeframe === "Month"
                        ? "month"
                        : timeframe === "Year"
                          ? "year"
                          : "quarter"
                    }
                    isDraggable={true}
                    onContextMenu={handleContextMenu}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Section 3: Operational Feeds, Alerts & Gauges */}
          {otherWidgets.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div>
                  <h2 className="font-semibold text-content-neutral-800 tracking-tight uppercase text-[11px]">
                    Operational Feeds & Account Health
                  </h2>
                  <p className="text-[11px] text-content-neutral-500 mt-0.5">
                    Recent client invoices, deliverables in sprint, and settlement alerts.
                  </p>
                </div>
                <span className="text-[11px] text-content-neutral-500 font-medium bg-surface-neutral-100 px-2 py-0.5 rounded-md">
                  {otherWidgets.length} Feeds active
                </span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {otherWidgets.map((w) => (
                  <WidgetRenderer
                    key={w.id}
                    widgetId={w.id}
                    source="analytics"
                    period={
                      timeframe === "Month"
                        ? "month"
                        : timeframe === "Year"
                          ? "year"
                          : "quarter"
                    }
                    isDraggable={true}
                    onContextMenu={handleContextMenu}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CUSTOMIZE ANALYTICS WIDGETS MODAL */}
      <MotionPresence>
        {isCustomizeModalOpen && (
          <MotionSurface
            kind="dialog"
            className="analytics-customize-overlay"
          >
            <MotionSurface
              onDismiss={() => setIsCustomizeModalOpen(false)}
              kind="panel"
              className="analytics-customize-panel"
            >
              {/* Modal Header */}
              <div className="analytics-customize-header">
                <div>
                  <h2 className="analytics-customize-title text-lg font-serif">
                    Customize Analytics Widgets
                  </h2>
                  <p className="text-xs text-content-neutral-500 mt-0.5">
                    Toggle which metrics appear in your Analytics storage and
                    see which are on your Dashboard.
                  </p>
                </div>
                <Button
                  aria-label="Close"
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsCustomizeModalOpen(false)}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Central Widget Storage Banner shown inside Customize modal */}
              <div className="mx-6 mt-4 flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-surface-purple-50/80 border border-line-purple-200/70 text-xs text-content-purple-950">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-accent shrink-0" />
                  <span>
                    <strong>Central Widget Storage:</strong> Drag any card to the{" "}
                    <strong>Dashboard</strong> in the left sidebar, or right-click to pin instantly.
                  </span>
                </div>
                <span className="text-[11px] text-content-purple-800 font-medium whitespace-nowrap ml-2">
                  {visibleWidgets.length} active
                </span>
              </div>

              {/* Widget List */}
              <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto divide-y divide-line-neutral-100">
                {WIDGET_CATALOG.map((widget) => {
                  const isVisible = analyticsWidgets.includes(widget.id);
                  const isPinned = dashboardWidgets.includes(widget.id);

                  return (
                    <div
                      key={widget.id}
                      className="pt-3 first:pt-0 flex items-center justify-between gap-4 group"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-content-neutral-900 group-hover:text-accent transition-colors">
                            {widget.title}
                          </span>
                          <span className="text-[10px] font-medium uppercase px-1.5 py-0.5 bg-surface-neutral-100 text-content-neutral-600 rounded">
                            {widget.category}
                          </span>
                          {isPinned && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-surface-purple-100 text-content-purple-700 rounded-md">
                              On Dashboard
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-content-neutral-500 mt-0.5">
                          {widget.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <Button
                          size="small"
                          variant={isPinned ? "secondary" : "ghost"}
                          onClick={() => {
                            if (isPinned) {
                              removeFromDashboard(widget.id);
                            } else {
                              pinToDashboard(widget.id);
                            }
                          }}
                          title={isPinned ? "Remove from Dashboard" : "Add to Dashboard"}
                        >
                          {isPinned ? "Unpin" : "+ Pin"}
                        </Button>
                        <Switch
                          checked={isVisible}
                          onChange={() => toggleAnalytics(widget.id)}
                          label={`Show ${widget.title} in Analytics`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Modal Actions */}
              <div className="analytics-customize-footer">
                <Button
                  variant="ghost"
                  type="button"
                  onClick={resetToDefaults}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Defaults</span>
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={showAllAnalytics}
                  >
                    Show All (18)
                  </Button>
                  <Button
                    variant="primary"
                    type="button"
                    onClick={() => {
                      setIsCustomizeModalOpen(false);
                      showToast("Analytics preferences updated");
                    }}
                  >
                    Done
                  </Button>
                </div>
              </div>
            </MotionSurface>
          </MotionSurface>
        )}
      </MotionPresence>
    </div>
  );
}
