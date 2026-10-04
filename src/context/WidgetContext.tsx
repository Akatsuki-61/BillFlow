"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  WIDGET_CATALOG,
  DEFAULT_DASHBOARD_WIDGET_IDS,
  DEFAULT_ANALYTICS_WIDGET_IDS,
} from "@/lib/widgets/widgetDefinitions";
import { WidgetDisplaySize } from "@/types/widgets";

interface WidgetContextType {
  dashboardWidgets: string[];
  analyticsWidgets: string[];
  widgetSizes: Record<string, WidgetDisplaySize>;
  isDashboardEditing: boolean;
  isDragging: boolean;
  draggedWidgetId: string | null;
  toastMessage: string | null;
  setIsDashboardEditing: (editing: boolean) => void;
  setDraggedWidgetId: (id: string | null) => void;
  setIsDragging: (dragging: boolean) => void;
  pinToDashboard: (id: string) => void;
  removeFromDashboard: (id: string) => void;
  toggleDashboard: (id: string) => void;
  isPinnedToDashboard: (id: string) => boolean;
  toggleAnalytics: (id: string) => void;
  isAnalyticsVisible: (id: string) => boolean;
  showAllAnalytics: () => void;
  resetToDefaults: () => void;
  getWidgetSize: (id: string) => WidgetDisplaySize;
  setWidgetSize: (id: string, size: WidgetDisplaySize) => void;
  toggleWidgetSize: (id: string) => void;
  reorderDashboardWidgets: (newOrder: string[]) => void;
  moveDashboardWidget: (fromIndex: number, toIndex: number) => void;
  showToast: (msg: string) => void;
}

const WidgetContext = createContext<WidgetContextType | null>(null);

const STORAGE_KEY_DASHBOARD = "billflow_dashboard_widgets_v2";
const STORAGE_KEY_ANALYTICS = "billflow_analytics_widgets_v2";
const STORAGE_KEY_SIZES = "billflow_widget_sizes_v2";

export function WidgetProvider({ children }: { children: React.ReactNode }) {
  const [dashboardWidgets, setDashboardWidgets] = useState<string[]>(
    DEFAULT_DASHBOARD_WIDGET_IDS,
  );
  const [analyticsWidgets, setAnalyticsWidgets] = useState<string[]>(
    DEFAULT_ANALYTICS_WIDGET_IDS,
  );
  const [widgetSizes, setWidgetSizes] = useState<
    Record<string, WidgetDisplaySize>
  >({});
  const [isDashboardEditing, setIsDashboardEditing] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [draggedWidgetId, setDraggedWidgetId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 3200);
  }, []);

  // Hydrate from localStorage on client mount
  useEffect(() => {
    try {
      const storedDash = localStorage.getItem(STORAGE_KEY_DASHBOARD);
      if (storedDash) {
        const parsed = JSON.parse(storedDash);
        if (Array.isArray(parsed)) {
          setDashboardWidgets(parsed);
        }
      }
      const storedAnalytics = localStorage.getItem(STORAGE_KEY_ANALYTICS);
      if (storedAnalytics) {
        const parsed = JSON.parse(storedAnalytics);
        if (Array.isArray(parsed)) {
          setAnalyticsWidgets(parsed);
        }
      }
      const storedSizes = localStorage.getItem(STORAGE_KEY_SIZES);
      if (storedSizes) {
        const parsed = JSON.parse(storedSizes);
        if (parsed && typeof parsed === "object") {
          setWidgetSizes(parsed);
        }
      }
    } catch {
      // Fallback to defaults on error
    } finally {
      setIsInitialized(true);
    }
  }, []);

  // Persist dashboard widgets changes
  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem(
        STORAGE_KEY_DASHBOARD,
        JSON.stringify(dashboardWidgets),
      );
    } catch {
      // Ignore write errors
    }
  }, [dashboardWidgets, isInitialized]);

  // Persist analytics widgets changes
  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem(
        STORAGE_KEY_ANALYTICS,
        JSON.stringify(analyticsWidgets),
      );
    } catch {
      // Ignore write errors
    }
  }, [analyticsWidgets, isInitialized]);

  // Persist widget sizes
  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem(STORAGE_KEY_SIZES, JSON.stringify(widgetSizes));
    } catch {
      // Ignore write errors
    }
  }, [widgetSizes, isInitialized]);

  const pinToDashboard = useCallback(
    (id: string) => {
      const meta = WIDGET_CATALOG.find((w) => w.id === id);
      const title = meta ? meta.title : "Widget";

      setDashboardWidgets((prev) => {
        if (prev.includes(id)) {
          showToast(`"${title}" is already on your Dashboard`);
          return prev;
        }
        showToast(`Added "${title}" to Dashboard`);
        return [...prev, id];
      });
    },
    [showToast],
  );

  const removeFromDashboard = useCallback(
    (id: string) => {
      const meta = WIDGET_CATALOG.find((w) => w.id === id);
      const title = meta ? meta.title : "Widget";

      setDashboardWidgets((prev) => {
        if (!prev.includes(id)) return prev;
        showToast(`Removed "${title}" from Dashboard`);
        return prev.filter((item) => item !== id);
      });
    },
    [showToast],
  );

  const toggleDashboard = useCallback(
    (id: string) => {
      if (dashboardWidgets.includes(id)) {
        removeFromDashboard(id);
      } else {
        pinToDashboard(id);
      }
    },
    [dashboardWidgets, pinToDashboard, removeFromDashboard],
  );

  const isPinnedToDashboard = useCallback(
    (id: string) => dashboardWidgets.includes(id),
    [dashboardWidgets],
  );

  const toggleAnalytics = useCallback(
    (id: string) => {
      const meta = WIDGET_CATALOG.find((w) => w.id === id);
      const title = meta ? meta.title : "Widget";

      setAnalyticsWidgets((prev) => {
        const isVisible = prev.includes(id);
        const updated = isVisible
          ? prev.filter((item) => item !== id)
          : [...prev, id];
        showToast(
          isVisible
            ? `Hidden "${title}" from Analytics`
            : `Showing "${title}" in Analytics`,
        );
        return updated;
      });
    },
    [showToast],
  );

  const isAnalyticsVisible = useCallback(
    (id: string) => analyticsWidgets.includes(id),
    [analyticsWidgets],
  );

  const showAllAnalytics = useCallback(() => {
    setAnalyticsWidgets(DEFAULT_ANALYTICS_WIDGET_IDS);
    showToast("All 18 analytics widgets enabled");
  }, [showToast]);

  const resetToDefaults = useCallback(() => {
    setDashboardWidgets(DEFAULT_DASHBOARD_WIDGET_IDS);
    setAnalyticsWidgets(DEFAULT_ANALYTICS_WIDGET_IDS);
    setWidgetSizes({});
    showToast("Widgets reset to default arrangement");
  }, [showToast]);

  const getWidgetSize = useCallback(
    (id: string): WidgetDisplaySize => {
      return widgetSizes[id] || "normal";
    },
    [widgetSizes],
  );

  const setWidgetSize = useCallback(
    (id: string, size: WidgetDisplaySize) => {
      setWidgetSizes((prev) => ({ ...prev, [id]: size }));
      const meta = WIDGET_CATALOG.find((w) => w.id === id);
      const title = meta ? meta.title : "Widget";
      showToast(
        size === "compact"
          ? `Resized "${title}" to Compact (Half)`
          : `Resized "${title}" to Standard`,
      );
    },
    [showToast],
  );

  const toggleWidgetSize = useCallback(
    (id: string) => {
      const current = getWidgetSize(id);
      const next: WidgetDisplaySize = current === "compact" ? "normal" : "compact";
      setWidgetSize(id, next);
    },
    [getWidgetSize, setWidgetSize],
  );

  const reorderDashboardWidgets = useCallback((newOrder: string[]) => {
    setDashboardWidgets(newOrder);
  }, []);

  const moveDashboardWidget = useCallback(
    (fromIndex: number, toIndex: number) => {
      setDashboardWidgets((prev) => {
        if (
          fromIndex < 0 ||
          fromIndex >= prev.length ||
          toIndex < 0 ||
          toIndex >= prev.length
        ) {
          return prev;
        }
        const updated = [...prev];
        const [moved] = updated.splice(fromIndex, 1);
        updated.splice(toIndex, 0, moved);
        return updated;
      });
    },
    [],
  );

  return (
    <WidgetContext.Provider
      value={{
        dashboardWidgets,
        analyticsWidgets,
        widgetSizes,
        isDashboardEditing,
        isDragging,
        draggedWidgetId,
        toastMessage,
        setIsDashboardEditing,
        setDraggedWidgetId,
        setIsDragging,
        pinToDashboard,
        removeFromDashboard,
        toggleDashboard,
        isPinnedToDashboard,
        toggleAnalytics,
        isAnalyticsVisible,
        showAllAnalytics,
        resetToDefaults,
        getWidgetSize,
        setWidgetSize,
        toggleWidgetSize,
        reorderDashboardWidgets,
        moveDashboardWidget,
        showToast,
      }}
    >
      {children}
    </WidgetContext.Provider>
  );
}

export function useWidgetContext() {
  const ctx = useContext(WidgetContext);
  if (!ctx) {
    throw new Error("useWidgetContext must be used within a WidgetProvider");
  }
  return ctx;
}
