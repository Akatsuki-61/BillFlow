// Types for the Analytics dashboard matching Figma Design 2.0

export type Timeframe = "Month" | "Quarter" | "Year";

export interface MonthlyFinancial {
  month: string;
  revenue: number; // in millions, e.g. 1.85
  expenses: number; // in millions, e.g. 1.04
}

export interface BillingAlertItem {
  id: string;
  clientName: string;
  retainerTitle: string;
  daysOverdue: number;
  amount: number;
}

export interface AnalyticsSummary {
  netProfit: number;
  profitGrowthPercentage: number;
  paidRatioPercentage: number;
  collectedAmount: number;
  billedAmount: number;
  collectionRatePercentage: number;
}

export interface AnalyticsMonthlyTrend {
  key: string;
  label: string;
  revenueCents: number;
  expensesCents: number;
  profitCents: number;
  marginPct: number;
}

/**
 * Accounting view mode:
 * - 'accrual': Evaluates financial performance based on total invoiced/billed revenue and committed vendor costs.
 * - 'cash': Evaluates financial performance based strictly on actual cash collections received and paid vendor costs.
 */
export type AccountingViewMode = "accrual" | "cash";

/**
 * Consistent financial aggregation contract payload returned by both
 * Electron IPC (`window.billflow.analytics.summary`) and the browser fallback repository.
 */
export interface AnalyticsSummaryPayload {
  /** Accrual billed total in cents across all non-draft invoices in the period/currency */
  totalRevenueCents: number;
  /** Explicit alias for total billed amount in cents */
  billedAmountCents: number;

  /** Total realized cash collections received in cents (includes advance deposits and full settlements) */
  paidCents: number;
  /** Explicit alias for cash collections received in cents */
  collectedCents: number;

  /** Uncollected balance in cents remaining on open/unpaid/advance-paid invoices */
  pendingReceivablesCents: number;
  /** Explicit alias for outstanding uncollected receivables in cents */
  outstandingCents: number;

  /** Total committed subcontractor and vendor payables in cents */
  totalOutsourcedCents: number;
  /** Explicit alias for total committed contractor costs in cents */
  committedCostCents: number;

  /** Total actual paid contractor costs in cents */
  paidCostCents: number;

  /**
   * Accrual profit in cents: Billed Revenue minus Committed Contractor Costs.
   * Preserves business losses as negative integers (never clamped to zero).
   */
  accrualProfitCents: number;

  /**
   * Cash profit in cents: Actual Cash Collections minus Paid Outflows.
   * Preserves business losses as negative integers (never clamped to zero).
   */
  cashProfitCents: number;

  /**
   * Net profit in cents according to the active accounting view mode:
   * Returns `cashProfitCents` under 'cash' mode or `accrualProfitCents` under 'accrual' mode.
   */
  netProfitCents: number;

  /** Margin percentage. Preserves negative percentages when operating at a loss. */
  marginPct: number;

  /** True when net profit is negative, indicating a business deficit/loss in the period. */
  isLoss: boolean;

  /** Count of non-draft invoices that have not been fully settled */
  unpaidCount: number;

  /** Total balance in cents on overdue invoices */
  overdueCents: number;

  /** Number of overdue invoices */
  overdueCount: number;

  /** Percentage of billed revenue that has been collected (paidCents / totalRevenueCents * 100) */
  paidRatioPct: number;

  /** Average invoice value in cents */
  avgInvoiceCents: number;

  /** Number of active client accounts */
  activeClientsCount: number;

  /** Number of subcontractor vendors */
  vendorsCount: number;

  /** Name of the client representing the highest billed concentration */
  topClientName: string;

  /** Percentage of total billed revenue represented by the top client */
  topClientPct: number;

  /** Realized hourly rate derived strictly from recorded task active milliseconds */
  effectiveHourlyRate: number;

  /** Cashflow runway in months derived from collected cash divided by average monthly burn */
  cashflowRunwayMonths: number;

  /** 6-month historical monthly financial trend points */
  monthlyTrends: AnalyticsMonthlyTrend[];

  /** Optional currency code used to filter this aggregation */
  currency?: string;

  /** Optional period filter applied (e.g. 'month', 'quarter', 'year', 'all') */
  period?: string;

  /** Active accounting view mode applied to net profit ('accrual' | 'cash') */
  accountingMethod?: AccountingViewMode;
}
