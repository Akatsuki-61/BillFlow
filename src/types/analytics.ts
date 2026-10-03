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
