export type WidgetCategory =
  | "financial"
  | "clients"
  | "operations"
  | "charts"
  | "activity";

export type WidgetSize = "metric" | "medium" | "wide" | "full";

export interface WidgetMeta {
  id: string;
  title: string;
  description: string;
  category: WidgetCategory;
  size: WidgetSize;
  defaultOnDashboard: boolean;
  defaultOnAnalytics: boolean;
}

export interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  widgetId: string | null;
  source: "dashboard" | "analytics";
}
