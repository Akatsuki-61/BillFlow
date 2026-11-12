import { ipcMain } from "../security";
import { getDb } from "../db";
import { clients, vendors } from "../db/schema";
import { z } from "zod";
import { currencySchema } from "../workflow-validation";
import { listInvoicesWithClient } from "./invoices";
import { listWorkOrders } from "./workOrders";
import { listExpenses } from "./expenses";
import { listTasks } from "./tasks";
import { getOrCreateSettings } from "./settings";
import { calculateFinancials } from "../../src/lib/financials";
export type { AnalyticsSummaryPayload } from "../../src/types/analytics";
export function getAnalyticsSummary(
  period = "all",
  currency?: string,
  accountingMethod: "accrual" | "cash" = "accrual",
) {
  const db = getDb();
  const selected =
    currency && !["all", "ALL"].includes(currency)
      ? currencySchema.parse(currency.toUpperCase())
      : getOrCreateSettings().defaultCurrency;
  z.enum(["all", "all-time", "year", "quarter", "month"]).parse(period);
  z.enum(["accrual", "cash"]).parse(accountingMethod);
  return calculateFinancials({
    invoices: listInvoicesWithClient(),
    workOrders: listWorkOrders(),
    expenses: listExpenses(),
    tasks: listTasks(),
    clientCount: db.select({ id: clients.id }).from(clients).all().length,
    vendorCount: db.select({ id: vendors.id }).from(vendors).all().length,
    period,
    currency: selected,
    accountingMethod,
  });
}
export function registerAnalyticsHandlers() {
  ipcMain.handle(
    "analytics:summary",
    (
      _event,
      period?: string,
      currency?: string,
      accountingMethod?: "accrual" | "cash",
    ) => getAnalyticsSummary(period, currency, accountingMethod),
  );
}
