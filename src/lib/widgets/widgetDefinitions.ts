import { WidgetMeta } from "@/types/widgets";

export const WIDGET_CATALOG: WidgetMeta[] = [
  // 6 Core Financial KPIs
  {
    id: "total-revenue",
    title: "Total Revenue",
    description: "Gross billings recognized across all active client contracts",
    category: "financial",
    size: "metric",
    defaultOnDashboard: true,
    defaultOnAnalytics: true,
  },
  {
    id: "net-profit",
    title: "Net Profit & Margin",
    description: "Net earnings after contractor payouts, software and expenses",
    category: "financial",
    size: "metric",
    defaultOnDashboard: true,
    defaultOnAnalytics: true,
  },
  {
    id: "pending-receivables",
    title: "Pending Receivables",
    description: "Outstanding invoice amounts awaiting client remittance",
    category: "financial",
    size: "metric",
    defaultOnDashboard: true,
    defaultOnAnalytics: true,
  },
  {
    id: "active-clients",
    title: "Total Clients",
    description: "Total client directory with active and inactive breakdown",
    category: "clients",
    size: "metric",
    defaultOnDashboard: true,
    defaultOnAnalytics: true,
  },
  {
    id: "outsourced-costs",
    title: "Outsourced Subcontractor Costs",
    description: "Allocated balances and payouts to outsourced contractors",
    category: "operations",
    size: "metric",
    defaultOnDashboard: false,
    defaultOnAnalytics: true,
  },
  {
    id: "operating-expenses",
    title: "Operating Expenses",
    description: "Software tools, cloud infrastructure, hardware, and travel",
    category: "operations",
    size: "metric",
    defaultOnDashboard: false,
    defaultOnAnalytics: true,
  },

  // 6 Advanced Analytics Metrics
  {
    id: "paid-ratio",
    title: "Paid Ratio",
    description: "Percentage of total invoiced volume successfully collected",
    category: "financial",
    size: "metric",
    defaultOnDashboard: false,
    defaultOnAnalytics: true,
  },
  {
    id: "average-invoice-value",
    title: "Average Invoice Value",
    description: "Mean bill amount generated per client invoice",
    category: "financial",
    size: "metric",
    defaultOnDashboard: false,
    defaultOnAnalytics: true,
  },
  {
    id: "overdue-receivables",
    title: "Overdue Receivables",
    description: "Unpaid invoices that have elapsed their payment due dates",
    category: "financial",
    size: "metric",
    defaultOnDashboard: false,
    defaultOnAnalytics: false,
  },
  {
    id: "cashflow-runway",
    title: "Cashflow Runway",
    description:
      "Operating cushion based on collected payments and contractor costs",
    category: "financial",
    size: "metric",
    defaultOnDashboard: false,
    defaultOnAnalytics: false,
  },
  {
    id: "client-concentration",
    title: "Top Client Concentration",
    description: "Revenue percentage contributed by your highest paying client",
    category: "clients",
    size: "metric",
    defaultOnDashboard: false,
    defaultOnAnalytics: false,
  },
  {
    id: "effective-hourly-rate",
    title: "Profit per Tracked Hour",
    description: "Effective billing yield per delivery sprint hour",
    category: "operations",
    size: "metric",
    defaultOnDashboard: false,
    defaultOnAnalytics: false,
  },

  // Charts & Visualizations
  {
    id: "revenue-expenses-chart",
    title: "Revenue vs Expenses Chart",
    description:
      "Paired monthly bar chart comparing incoming revenue against outgoing expenses",
    category: "charts",
    size: "wide",
    defaultOnDashboard: false,
    defaultOnAnalytics: true,
  },
  {
    id: "profit-trajectory-chart",
    title: "Profit & Growth Trajectory",
    description: "Month-over-month revenue volume and net profit margin plot",
    category: "charts",
    size: "full",
    defaultOnDashboard: true,
    defaultOnAnalytics: true,
  },
  {
    id: "collection-rate-gauge",
    title: "Collection Rate Gauge",
    description:
      "Collected amount as a share of billed revenue; counts of settled and open invoices",
    category: "charts",
    size: "medium",
    defaultOnDashboard: false,
    defaultOnAnalytics: true,
  },
  {
    id: "latency-percentiles-chart",
    title: "Active Time Percentiles",
    description:
      "Recorded active-time distribution for completed tasks (P50–P99)",
    category: "charts",
    size: "wide",
    defaultOnDashboard: false,
    defaultOnAnalytics: false,
  },
  {
    id: "portfolio-comparison-chart",
    title: "Service Line-Item Mix",
    description:
      "Gross service line-item prices, grouped from their descriptions",
    category: "charts",
    size: "wide",
    defaultOnDashboard: false,
    defaultOnAnalytics: false,
  },
  {
    id: "growth-benchmark-chart",
    title: "Weekly Completed Work",
    description: "Completed deliverables by week over the last eight weeks",
    category: "charts",
    size: "wide",
    defaultOnDashboard: false,
    defaultOnAnalytics: false,
  },
  {
    id: "audience-growth-chart",
    title: "Collections & Net Cashflow",
    description:
      "Recorded payments, contractor payouts and expenses across client solutions",
    category: "charts",
    size: "wide",
    defaultOnDashboard: false,
    defaultOnAnalytics: false,
  },
  {
    id: "service-trends-line-chart",
    title: "Service Delivery Trends",
    description: "Completed tasks by month and inferred service group",
    category: "charts",
    size: "wide",
    defaultOnDashboard: false,
    defaultOnAnalytics: false,
  },
  {
    id: "itemized-volume-bar-chart",
    title: "Contract Deliverables Volume",
    description:
      "Issued invoice items by month and inferred service group with interactive timeline brush",
    category: "charts",
    size: "wide",
    defaultOnDashboard: false,
    defaultOnAnalytics: false,
  },

  // 3 Operational Lists & Feeds
  {
    id: "billing-alerts",
    title: "Active Billing Alerts",
    description:
      "Actionable alert list of overdue client accounts requiring reminders",
    category: "activity",
    size: "medium",
    defaultOnDashboard: false,
    defaultOnAnalytics: false,
  },
  {
    id: "recent-invoices",
    title: "Recent Client Invoices",
    description:
      "Live feed of recently generated invoices and remittance statuses",
    category: "activity",
    size: "wide",
    defaultOnDashboard: true,
    defaultOnAnalytics: true,
  },
  {
    id: "sprint-tasks",
    title: "Active Sprint Deliverables",
    description: "Kanban sprint items, task assignees, and outsourcing tags",
    category: "activity",
    size: "wide",
    defaultOnDashboard: true,
    defaultOnAnalytics: false,
  },
];

export const DEFAULT_DASHBOARD_WIDGET_IDS = [
  "profit-trajectory-chart",
  "total-revenue",
  "net-profit",
  "pending-receivables",
  "active-clients",
  "sprint-tasks",
  "recent-invoices",
];

export const DEFAULT_ANALYTICS_WIDGET_IDS = WIDGET_CATALOG.filter(
  (w) => w.defaultOnAnalytics,
).map((w) => w.id);

export const ALL_ANALYTICS_WIDGET_IDS = WIDGET_CATALOG.map((w) => w.id);
