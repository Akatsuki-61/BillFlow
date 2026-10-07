"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useSyncExternalStore,
} from "react";
import {
  WIDGET_CATALOG,
  DEFAULT_DASHBOARD_WIDGET_IDS,
  DEFAULT_ANALYTICS_WIDGET_IDS,
} from "@/lib/widgets/widgetDefinitions";
import { WidgetDisplaySize } from "@/types/widgets";

// Action descriptor for interactive toast notifications (e.g., clickable "Undo" button)
export interface ToastAction {
  label: string;
  onClick: () => void;
}

interface WidgetContextType {
  dashboardWidgets: string[];
  analyticsWidgets: string[];
  widgetSizes: Record<string, WidgetDisplaySize>;
  isDashboardEditing: boolean;
  isDragging: boolean;
  draggedWidgetId: string | null;
  toastMessage: string | null;
  toastAction: ToastAction | null;
  canUndo: boolean;
  undoDashboard: () => void;
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
  showToast: (msg: string, action?: ToastAction) => void;
}

const WidgetContext = createContext<WidgetContextType | null>(null);

const STORAGE_KEY_DASHBOARD = "billflow_dashboard_widgets_v2";
const STORAGE_KEY_ANALYTICS = "billflow_analytics_widgets_v2";
const STORAGE_KEY_SIZES = "billflow_widget_sizes_v2";

const subscribeToHydration = () => () => {};
const clientHydrationSnapshot = () => true;
const serverHydrationSnapshot = () => false;

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
  const [toastAction, setToastAction] = useState<ToastAction | null>(null);

  // History stack for dashboard layout operations (tracks up to 15 prior states for undo)
  const [dashboardHistory, setDashboardHistory] = useState<string[][]>([]);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  /**
   * Dispatches an interactive toast notification with optional action button (e.g. Undo).
   * Automatically clears itself after 4.5 seconds.
   */
  const showToast = useCallback((msg: string, action?: ToastAction) => {
    setToastMessage(msg);
    setToastAction(action || null);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
      setToastAction((curr) => (curr === action ? null : curr));
    }, 4500);
  }, []);

  /**
   * Reverts the most recent dashboard layout mutation (add, remove, drag-drop, or reorder).
   * Restores previous widget ID array from the history stack.
   */
  const undoDashboard = useCallback(() => {
    setDashboardHistory((history) => {
      if (history.length === 0) return history;
      const previousState = history[history.length - 1];
      const newHistory = history.slice(0, history.length - 1);
      setDashboardWidgets(previousState);
      showToast("Reverted dashboard change");
      return newHistory;
    });
  }, [showToast]);

  const canUndo = dashboardHistory.length > 0;

  // Keep server and hydration output identical, then load browser preferences once.
  const hydrated = useSyncExternalStore(
    subscribeToHydration, clientHydrationSnapshot, serverHydrationSnapshot,
  );
  if (hydrated && !isInitialized) {
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
          const activeIds = new Set(parsed);
          const merged = [...parsed];
          for (const defaultId of DEFAULT_ANALYTICS_WIDGET_IDS) {
            if (!activeIds.has(defaultId)) {
              merged.push(defaultId);
            }
          }
          setAnalyticsWidgets(merged);
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
  }

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

  /**
   * Adds a widget to the dashboard layout.
   * Pushes current layout to history stack enabling one-click or Cmd+Z undo.
   */
  const pinToDashboard = useCallback(
    (id: string) => {
      const meta = WIDGET_CATALOG.find((w) => w.id === id);
      const title = meta ? meta.title : "Widget";

      setDashboardWidgets((prev) => {
        if (prev.includes(id)) {
          showToast(`"${title}" is already on your Dashboard`);
          return prev;
        }
        // Save snapshot before mutating
        setDashboardHistory((hist) => [...hist.slice(-15), prev]);
        showToast(`Added "${title}" to Dashboard`, {
          label: "Undo",
          onClick: undoDashboard,
        });
        return [...prev, id];
      });
    },
    [showToast, undoDashboard],
  );

  /**
   * Removes a widget from the dashboard.
   * Pushes current layout to history stack so the removal can be immediately undone.
   */
  const removeFromDashboard = useCallback(
    (id: string) => {
      const meta = WIDGET_CATALOG.find((w) => w.id === id);
      const title = meta ? meta.title : "Widget";

      setDashboardWidgets((prev) => {
        if (!prev.includes(id)) return prev;
        // Save snapshot before mutating
        setDashboardHistory((hist) => [...hist.slice(-15), prev]);
        showToast(`Removed "${title}" from Dashboard`, {
          label: "Undo",
          onClick: undoDashboard,
        });
        return prev.filter((item) => item !== id);
      });
    },
    [showToast, undoDashboard],
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
    setDashboardWidgets((prev) => {
      setDashboardHistory((hist) => [...hist.slice(-15), prev]);
      return DEFAULT_DASHBOARD_WIDGET_IDS;
    });
    setAnalyticsWidgets(DEFAULT_ANALYTICS_WIDGET_IDS);
    setWidgetSizes({});
    showToast("Widgets reset to default arrangement", {
      label: "Undo",
      onClick: undoDashboard,
    });
  }, [showToast, undoDashboard]);

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

  /**
   * Replaces dashboard widget order (e.g. from drag and drop operations).
   * Pushes current arrangement to history stack before applying new order.
   */
  const reorderDashboardWidgets = useCallback(
    (newOrder: string[]) => {
      setDashboardWidgets((prev) => {
        setDashboardHistory((hist) => [...hist.slice(-15), prev]);
        showToast("Reordered widgets", {
          label: "Undo",
          onClick: undoDashboard,
        });
        return newOrder;
      });
    },
    [showToast, undoDashboard],
  );

  /**
   * Moves a widget from one index to another (e.g. via Move Left / Move Right buttons or drop).
   * Pushes current snapshot to history stack so the drop or move is undoable.
   */
  const moveDashboardWidget = useCallback(
    (fromIndex: number, toIndex: number) => {
      setDashboardWidgets((prev) => {
        if (
          fromIndex < 0 ||
          fromIndex >= prev.length ||
          toIndex < 0 ||
          toIndex >= prev.length ||
          fromIndex === toIndex
        ) {
          return prev;
        }
        const movedId = prev[fromIndex];
        const meta = WIDGET_CATALOG.find((w) => w.id === movedId);
        const title = meta ? meta.title : "Widget";

        // Snapshot current state for undo
        setDashboardHistory((hist) => [...hist.slice(-15), prev]);
        const updated = [...prev];
        const [moved] = updated.splice(fromIndex, 1);
        updated.splice(toIndex, 0, moved);

        showToast(`Moved "${title}"`, {
          label: "Undo",
          onClick: undoDashboard,
        });
        return updated;
      });
    },
    [showToast, undoDashboard],
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
        toastAction,
        canUndo,
        undoDashboard,
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
