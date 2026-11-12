"use client";

import { Dialog } from "@/components/ui/Dialog";

import React, { useState, useRef } from "react";
import {
  CheckCircle2,
  SlidersHorizontal,
  Plus,
  Minus,
  EyeOff,
  RotateCcw,
} from "lucide-react";
import {
  Button,
  PageHeader,
  SegmentedControl,
  Switch,
} from "@/components/ui/Workspace";
import { MotionPresence, MotionSurface } from "@/components/ui/MotionSurface";
import { motion } from "framer-motion";
import { SPRING_NAV_GLIDE } from "@/lib/motion";
import { ContextMenu, ContextMenuItem } from "@/components/ui/ContextMenu";
import { WidgetRenderer } from "@/components/dashboard/WidgetRenderer";
import { useWidgetContext } from "@/context/WidgetContext";
import { WIDGET_CATALOG } from "@/lib/widgets/widgetDefinitions";
import { Timeframe } from "@/types/analytics";
import "./analytics.css";

export default function AnalyticsView() {
  const {
    analyticsWidgets,
    dashboardWidgets,
    draggedWidgetId,
    pinToDashboard,
    removeFromDashboard,
    isPinnedToDashboard,
    toggleAnalytics,
    moveAnalyticsWidget,
    showAllAnalytics,
    resetToDefaults,
    toastMessage,
    toastAction,
    showToast,
  } = useWidgetContext();

  const lastSwapRef = useRef<{ pair: string; time: number }>({
    pair: "",
    time: 0,
  });

  const handleTileDragOver = (
    e: React.DragEvent<HTMLDivElement>,
    targetId: string,
  ) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!draggedWidgetId || draggedWidgetId === targetId) return;
    const now = e.timeStamp;
    const pairKey = [draggedWidgetId, targetId].sort().join("::");
    if (
      lastSwapRef.current.pair === pairKey &&
      now - lastSwapRef.current.time < 160
    ) {
      return;
    }
    lastSwapRef.current = { pair: pairKey, time: now };
    moveAnalyticsWidget(draggedWidgetId, targetId);
  };

  const handleTileDrop = (
    e: React.DragEvent<HTMLDivElement>,
    targetId: string,
  ) => {
    e.preventDefault();
    const fromId = draggedWidgetId || e.dataTransfer.getData("text/plain");
    if (fromId && fromId !== targetId) {
      moveAnalyticsWidget(fromId, targetId);
    }
  };

  // Selected timeframe filter state: Month, Quarter, or Year
  const [timeframe, setTimeframe] = useState<Timeframe>("Quarter");
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

  // Categorize visible widgets while preserving user-arranged order in analyticsWidgets
  const visibleWidgets = analyticsWidgets
    .map((id) => WIDGET_CATALOG.find((w) => w.id === id))
    .filter((w): w is NonNullable<typeof w> => Boolean(w));
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
        description="Recorded revenue, costs, collections and delivery progress. Historical charts show their own labeled windows."
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
            You can re-enable any of the {WIDGET_CATALOG.length} business
            metrics, charts, and feeds from the widget customizer.
          </p>
          <Button variant="primary" onClick={showAllAnalytics} className="mt-4">
            Show All ({WIDGET_CATALOG.length}) Widgets
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Section 1: KPI Metrics Bento Grid */}
          {metricWidgets.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-[18px] font-medium tracking-[-0.02em] text-content-neutral-950">
                    Key Business Indicators · This {timeframe}
                  </h2>
                  <span className="zentra-pill-badge !px-2.5 !py-0.5 !text-[11px]">
                    {metricWidgets.length} KPIs active
                  </span>
                </div>
                <p className="text-[12px] text-content-neutral-400 hidden sm:block">
                  Right-click or drag any widget to pin it to your Overview
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {metricWidgets.map((w) => (
                  <motion.div
                    key={w.id}
                    layout="position"
                    transition={SPRING_NAV_GLIDE}
                    onDragOver={(e) => handleTileDragOver(e, w.id)}
                    onDrop={(e) => handleTileDrop(e, w.id)}
                  >
                    <WidgetRenderer
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
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Section 2: Charts & Visualizations */}
          {chartWidgets.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-[18px] font-medium tracking-[-0.02em] text-content-neutral-950">
                    Financial Velocity & Profit Trajectory
                  </h2>
                  <span className="zentra-pill-badge !px-2.5 !py-0.5 !text-[11px]">
                    Interactive Visualizations
                  </span>
                </div>
                <p className="text-[12px] text-content-neutral-400 hidden sm:block">
                  Rolling cashflow intake, contractor disbursements, and
                  retained net earnings
                </p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {chartWidgets.map((w) => (
                  <motion.div
                    key={w.id}
                    layout="position"
                    transition={SPRING_NAV_GLIDE}
                    onDragOver={(e) => handleTileDragOver(e, w.id)}
                    onDrop={(e) => handleTileDrop(e, w.id)}
                    className={
                      w.id === "profit-trajectory-chart" ? "lg:col-span-2" : ""
                    }
                  >
                    <WidgetRenderer
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
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Section 3: Operational Feeds, Alerts & Gauges */}
          {otherWidgets.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-[18px] font-medium tracking-[-0.02em] text-content-neutral-950">
                    Operational Feeds & Account Health
                  </h2>
                  <span className="zentra-pill-badge !px-2.5 !py-0.5 !text-[11px]">
                    {otherWidgets.length} Feeds active
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {otherWidgets.map((w) => (
                  <motion.div
                    key={w.id}
                    layout="position"
                    transition={SPRING_NAV_GLIDE}
                    onDragOver={(e) => handleTileDragOver(e, w.id)}
                    onDrop={(e) => handleTileDrop(e, w.id)}
                  >
                    <WidgetRenderer
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
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CUSTOMIZE ANALYTICS WIDGETS MODAL */}
      <MotionPresence>
        {isCustomizeModalOpen && (
          <Dialog onClose={() => setIsCustomizeModalOpen(false)} width={960}>
            <div className="app-dialog-header">
              <div>
                <h2 className="analytics-customize-title text-lg font-medium tracking-[-0.02em]">
                  Customize Analytics Widgets
                </h2>
                <p className="text-xs text-content-neutral-500 mt-0.5">
                  Toggle which metrics appear in your Analytics catalog and see
                  which are pinned to your Overview.
                </p>
              </div>
            </div>
            <div className="app-dialog-body">
              {/* Central Widget Storage Banner shown inside Customize modal */}
              <div className="mb-4 flex items-center justify-between gap-4 px-4 py-3 rounded-2xl bg-accent-faint/80 dark:bg-accent-soft/40 border border-border-accent/70 dark:border-border-accent/50 text-xs text-content-neutral-900">
                <div className="flex items-center gap-2.5 min-w-0">
                  <SlidersHorizontal className="w-4 h-4 text-accent shrink-0" />
                  <span className="leading-snug">
                    <strong>Central Widget Catalog:</strong> Drag any card to{" "}
                    <strong>Home</strong> in the top navigation bar, or
                    right-click to pin instantly.
                  </span>
                </div>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-accent/15 text-accent text-[11px] font-semibold leading-none whitespace-nowrap shrink-0">
                  {visibleWidgets.length} active
                </span>
              </div>

              {/* Widget List */}
              <div className="divide-y divide-line-neutral-100 dark:divide-line-neutral-800/80">
                {WIDGET_CATALOG.map((widget) => {
                  const isVisible = analyticsWidgets.includes(widget.id);
                  const isPinned = dashboardWidgets.includes(widget.id);

                  return (
                    <div
                      key={widget.id}
                      className="py-3.5 first:pt-1 last:pb-1 flex items-center justify-between gap-4 group"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-content-neutral-900 group-hover:text-accent transition-colors">
                            {widget.title}
                          </span>
                          <span className="text-[10px] font-medium uppercase px-2 py-0.5 bg-surface-neutral-100 text-content-neutral-600 rounded-full">
                            {widget.category}
                          </span>
                          {isPinned && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 bg-accent-faint text-accent dark:bg-accent-soft dark:text-accent rounded-full">
                              On Overview
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
                          title={
                            isPinned
                              ? "Remove from Dashboard"
                              : "Add to Dashboard"
                          }
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
            </div>
            <div className="app-dialog-footer">
              <Button
                variant="secondary"
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
                  Show All ({WIDGET_CATALOG.length})
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
          </Dialog>
        )}
      </MotionPresence>
    </div>
  );
}
