"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import {
  WIDGET_CATALOG,
  DEFAULT_DASHBOARD_WIDGET_IDS,
  DEFAULT_ANALYTICS_WIDGET_IDS,
  ALL_ANALYTICS_WIDGET_IDS,
} from "@/lib/widgets/widgetDefinitions";
import { WidgetDisplaySize } from "@/types/widgets";
import {
  loadWidgetPreferences,
  getScopedWidgetStorageKeys,
} from "@/lib/widgets/widgetStorage";
import { rubberbandOffset } from "@/lib/motion";

// Action descriptor for interactive toast notifications (e.g., clickable "Undo" button)
export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface WidgetDragStartPayload {
  widgetId: string;
  source: "dashboard" | "analytics";
  element: HTMLElement;
  clientX: number;
  clientY: number;
}

interface WidgetContextType {
  dashboardWidgets: string[];
  analyticsWidgets: string[];
  widgetSizes: Record<string, WidgetDisplaySize>;
  isDashboardEditing: boolean;
  isDragging: boolean;
  draggedWidgetId: string | null;
  dragSource: "dashboard" | "analytics" | null;
  isHomeDropOver: boolean;
  toastMessage: string | null;
  toastAction: ToastAction | null;
  canUndo: boolean;
  undoDashboard: () => void;
  setIsDashboardEditing: (editing: boolean) => void;
  setDraggedWidgetId: (id: string | null) => void;
  setIsDragging: (dragging: boolean) => void;
  setIsHomeDropOver: (over: boolean) => void;
  startWidgetDrag: (payload: WidgetDragStartPayload) => void;
  endWidgetDrag: () => void;
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
  moveDashboardWidgetById: (fromId: string, toId: string) => void;
  moveAnalyticsWidget: (fromId: string, toId: string) => void;
  showToast: (msg: string, action?: ToastAction) => void;
}

const WidgetContext = createContext<WidgetContextType | null>(null);

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
  const [dragSource, setDragSource] = useState<"dashboard" | "analytics" | null>(
    null,
  );
  const [isHomeDropOver, setIsHomeDropOver] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastAction, setToastAction] = useState<ToastAction | null>(null);

  // Floating drag preview refs for 60/120fps cursor tracking + navbar shrink
  const dragOverlayRef = useRef<HTMLDivElement | null>(null);
  const dragCloneHostRef = useRef<HTMLDivElement | null>(null);
  const dragBadgeRef = useRef<HTMLDivElement | null>(null);
  const dragMetricsRef = useRef<{
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
    lastX: number;
    lastY: number;
  } | null>(null);
  const isHomeDropOverRef = useRef<boolean>(false);
  useEffect(() => {
    isHomeDropOverRef.current = isHomeDropOver;
  }, [isHomeDropOver]);

  // History stack for dashboard layout operations (tracks up to 15 prior states for undo)
  const [dashboardHistory, setDashboardHistory] = useState<string[][]>([]);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [activeProfileScope, setActiveProfileScope] = useState<string>("default");

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
      const saved = loadWidgetPreferences(localStorage, activeProfileScope);
      setDashboardWidgets(saved.dashboardWidgets);
      setAnalyticsWidgets(saved.analyticsWidgets);
      setWidgetSizes(saved.widgetSizes);
    } catch {
      // Fallback to defaults on error
    } finally {
      setIsInitialized(true);
    }
  }

  // Reload scoped widget preferences whenever the active profile switches
  useEffect(() => {
    const handleProfileSwitch = (event: Event) => {
      const detail = (event as CustomEvent<{ profileId?: string }>).detail;
      const nextScope = detail?.profileId || "default";
      setActiveProfileScope(nextScope);
      try {
        const saved = loadWidgetPreferences(localStorage, nextScope);
        setDashboardWidgets(saved.dashboardWidgets);
        setAnalyticsWidgets(saved.analyticsWidgets);
        setWidgetSizes(saved.widgetSizes);
        setDashboardHistory([]);
      } catch {
        // Ignore read error
      }
    };
    window.addEventListener("billflow:profile-switched", handleProfileSwitch);
    return () => {
      window.removeEventListener("billflow:profile-switched", handleProfileSwitch);
    };
  }, []);

  // Persist dashboard widgets changes
  useEffect(() => {
    if (!isInitialized) return;
    try {
      const keys = getScopedWidgetStorageKeys(activeProfileScope);
      localStorage.setItem(
        keys.dashboard,
        JSON.stringify(dashboardWidgets),
      );
    } catch {
      // Ignore write errors
    }
  }, [dashboardWidgets, isInitialized, activeProfileScope]);

  // Persist analytics widgets changes
  useEffect(() => {
    if (!isInitialized) return;
    try {
      const keys = getScopedWidgetStorageKeys(activeProfileScope);
      localStorage.setItem(
        keys.analytics,
        JSON.stringify(analyticsWidgets),
      );
    } catch {
      // Ignore write errors
    }
  }, [analyticsWidgets, isInitialized, activeProfileScope]);

  // Persist widget sizes
  useEffect(() => {
    if (!isInitialized) return;
    try {
      const keys = getScopedWidgetStorageKeys(activeProfileScope);
      localStorage.setItem(keys.sizes, JSON.stringify(widgetSizes));
    } catch {
      // Ignore write errors
    }
  }, [widgetSizes, isInitialized, activeProfileScope]);

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
    setAnalyticsWidgets(ALL_ANALYTICS_WIDGET_IDS);
    showToast(`All ${ALL_ANALYTICS_WIDGET_IDS.length} analytics widgets enabled`);
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

  /**
   * Live-reorders dashboard widgets by widget ID during drag-over.
   */
  const moveDashboardWidgetById = useCallback(
    (fromId: string, toId: string) => {
      if (!fromId || !toId || fromId === toId) return;
      setDashboardWidgets((prev) => {
        const fromIndex = prev.indexOf(fromId);
        const toIndex = prev.indexOf(toId);
        if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
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

  /**
   * Live-reorders analytics widgets by widget ID during drag-over.
   */
  const moveAnalyticsWidget = useCallback((fromId: string, toId: string) => {
    if (!fromId || !toId || fromId === toId) return;
    setAnalyticsWidgets((prev) => {
      const fromIndex = prev.indexOf(fromId);
      const toIndex = prev.indexOf(toId);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
        return prev;
      }
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
  }, []);

  const updateDragPreviewPosition = useCallback(
    (clientX: number, clientY: number) => {
      const overlay = dragOverlayRef.current;
      const metrics = dragMetricsRef.current;
      if (!overlay || !metrics) return;
      if (clientX === 0 && clientY === 0) return;

      metrics.lastX = clientX;
      metrics.lastY = clientY;

      // Shrink smoothly as the cursor moves upward toward the top navbar (y < 260px -> y = 64px)
      const rawProgress = Math.max(0, Math.min(1, (260 - clientY) / 190));
      const eased = rawProgress * rawProgress * (3 - 2 * rawProgress);
      const overHome = isHomeDropOverRef.current;

      const baseScale = 0.92;
      const minScale = overHome ? 0.24 : 0.28;
      const scale = baseScale - eased * (baseScale - minScale);

      // Anchor transitions smoothly from the original grab offset to centered below the cursor near the navbar
      const grabX = metrics.offsetX * scale;
      const grabY = metrics.offsetY * scale;
      const navX = (metrics.width * scale) * 0.5;
      const navY = -14;

      const anchorX = grabX * (1 - eased) + navX * eased;
      const anchorY = grabY * (1 - eased) + navY * eased;

      const rawX = clientX - anchorX;
      const rawY = clientY - anchorY;
      const pad = 12;
      const maxX =
        typeof window !== "undefined"
          ? Math.max(pad, window.innerWidth - metrics.width * scale - pad)
          : rawX;
      const maxY =
        typeof window !== "undefined"
          ? Math.max(pad, window.innerHeight - metrics.height * scale - pad)
          : rawY;
      const x =
        rawX < pad
          ? Math.round(pad + rubberbandOffset(rawX - pad, 140))
          : rawX > maxX
            ? Math.round(maxX + rubberbandOffset(rawX - maxX, 140))
            : Math.round(rawX);
      const y =
        rawY < pad
          ? Math.round(pad + rubberbandOffset(rawY - pad, 140))
          : rawY > maxY
            ? Math.round(maxY + rubberbandOffset(rawY - maxY, 140))
            : Math.round(rawY);

      overlay.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale.toFixed(4)})`;
      overlay.style.opacity = overHome ? "0.98" : eased > 0.2 ? "0.95" : "0.92";

      if (dragBadgeRef.current) {
        const showBadge = eased > 0.25 || overHome;
        dragBadgeRef.current.style.opacity = showBadge ? "1" : "0";
        dragBadgeRef.current.style.transform = ` translateX(-50%) scale(${(1 / scale).toFixed(3)})`;
      }
    },
    [],
  );

  const startWidgetDrag = useCallback(
    ({
      widgetId,
      source,
      element,
      clientX,
      clientY,
    }: WidgetDragStartPayload) => {
      const rect = element.getBoundingClientRect();
      const width = Math.max(220, Math.round(rect.width));
      const height = Math.max(120, Math.round(rect.height));
      const offsetX = Math.max(24, Math.min(width - 24, clientX - rect.left));
      const offsetY = Math.max(20, Math.min(height - 20, clientY - rect.top));

      dragMetricsRef.current = {
        width,
        height,
        offsetX,
        offsetY,
        lastX: clientX,
        lastY: clientY,
      };

      setDraggedWidgetId(widgetId);
      setDragSource(source);
      setIsDragging(true);

      // Clone the dragged tile DOM into the floating preview container after mount
      requestAnimationFrame(() => {
        const host = dragCloneHostRef.current;
        const overlay = dragOverlayRef.current;
        if (!host || !overlay) return;
        host.innerHTML = "";
        const clone = element.cloneNode(true) as HTMLElement;
        clone.removeAttribute("draggable");
        clone.style.width = `${width}px`;
        clone.style.height = `${height}px`;
        clone.style.margin = "0";
        clone.style.pointerEvents = "none";

        // Copy canvas bitmaps (e.g. ECharts) into the cloned canvases
        const srcCanvases = element.querySelectorAll("canvas");
        const destCanvases = clone.querySelectorAll("canvas");
        srcCanvases.forEach((srcCanvas, idx) => {
          const destCanvas = destCanvases[idx];
          if (destCanvas && srcCanvas.width > 0 && srcCanvas.height > 0) {
            destCanvas.width = srcCanvas.width;
            destCanvas.height = srcCanvas.height;
            const ctx = destCanvas.getContext("2d");
            try {
              ctx?.drawImage(srcCanvas, 0, 0);
            } catch {
              // Ignore cross-origin canvas errors
            }
          }
        });

        host.appendChild(clone);
        overlay.style.width = `${width}px`;
        overlay.style.height = `${height}px`;
        updateDragPreviewPosition(clientX, clientY);
      });
    },
    [updateDragPreviewPosition],
  );

  const endWidgetDrag = useCallback(() => {
    setIsDragging(false);
    setDraggedWidgetId(null);
    setDragSource(null);
    setIsHomeDropOver(false);
    dragMetricsRef.current = null;
    if (dragCloneHostRef.current) {
      dragCloneHostRef.current.innerHTML = "";
    }
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const handleWindowDragOver = (e: DragEvent) => {
      e.preventDefault();
      updateDragPreviewPosition(e.clientX, e.clientY);
    };
    const handleWindowDragEnd = () => {
      endWidgetDrag();
    };
    window.addEventListener("dragover", handleWindowDragOver, { passive: false });
    window.addEventListener("dragend", handleWindowDragEnd);
    window.addEventListener("drop", handleWindowDragEnd);
    return () => {
      window.removeEventListener("dragover", handleWindowDragOver);
      window.removeEventListener("dragend", handleWindowDragEnd);
      window.removeEventListener("drop", handleWindowDragEnd);
    };
  }, [isDragging, updateDragPreviewPosition, endWidgetDrag]);

  const draggedMeta = draggedWidgetId
    ? WIDGET_CATALOG.find((w) => w.id === draggedWidgetId)
    : null;

  return (
    <WidgetContext.Provider
      value={{
        dashboardWidgets,
        analyticsWidgets,
        widgetSizes,
        isDashboardEditing,
        isDragging,
        draggedWidgetId,
        dragSource,
        isHomeDropOver,
        toastMessage,
        toastAction,
        canUndo,
        undoDashboard,
        setIsDashboardEditing,
        setDraggedWidgetId,
        setIsDragging,
        setIsHomeDropOver,
        startWidgetDrag,
        endWidgetDrag,
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
        moveDashboardWidgetById,
        moveAnalyticsWidget,
        showToast,
      }}
    >
      {children}
      {hydrated &&
        isDragging &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={dragOverlayRef}
            aria-hidden="true"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              zIndex: 9998,
              pointerEvents: "none",
              transformOrigin: "0 0",
              willChange: "transform, opacity",
              transition: "opacity 120ms ease",
            }}
          >
            <div
              ref={dragBadgeRef}
              style={{
                position: "absolute",
                top: -14,
                left: "50%",
                transform: "translateX(-50%)",
                transformOrigin: "bottom center",
                opacity: 0,
                transition: "opacity 140ms ease",
                zIndex: 30,
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap shadow-lg border ${
                isHomeDropOver
                  ? "bg-accent-solid text-white border-white/40 ring-4 ring-accent/30"
                  : "bg-[#1c1c1f] text-white dark:bg-white dark:text-[#111115] border-white/15"
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>
                {isHomeDropOver
                  ? `Release to Pin "${draggedMeta?.title || "Widget"}" to Home`
                  : `Drag to Home in Navbar to Pin`}
              </span>
            </div>
            <div
              ref={dragCloneHostRef}
              className={`rounded-[24px] overflow-hidden shadow-[0_28px_60px_-12px_rgba(0,0,0,0.45)] ring-2 transition-shadow ${
                isHomeDropOver ? "ring-accent-solid" : "ring-accent/60"
              }`}
            />
          </div>,
          document.body,
        )}
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
