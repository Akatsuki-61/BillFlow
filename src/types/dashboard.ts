export type DashboardPeriod = "month" | "quarter" | "year" | "all";

export interface MetricTile {
  id: string;
  label: string;
  description: string;
  visible: boolean;
  values: Record<DashboardPeriod, string>;
  growthRates: Record<DashboardPeriod, { rate: string; isPositive: boolean; label: string }>;
  accentColor: string;
  pillBg: string;
  category: "financial" | "operations" | "clients";
}

export interface MonthlyGrowthPoint {
  month: string;
  revenue: number;
  profit: number;
  expenses: number;
  margin: number;
}

export interface DashboardInvoiceSummary {
  id: string;
  code: string;
  client: string;
  amount: string;
  status: "PAID" | "PENDING" | "OVERDUE";
  dueDate: string;
}

export interface DashboardTaskSummary {
  id: string;
  title: string;
  priority: "urgent" | "high" | "medium" | "low";
  assignee: string;
  dueDate: string;
  isOutsourced?: boolean;
}
