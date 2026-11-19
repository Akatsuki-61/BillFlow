import { app, Notification, type Tray } from "electron";
import { eq } from "drizzle-orm";
import { getDb, getSqlite } from "./db";
import { settings } from "./db/schema";
import { addDaysToDateKey } from "./recurring-schedule";
import { ipcMain } from "./security";
import { isWorkspaceUnlocked } from "./workspace-session";
import { getOrCreateSettings } from "./ipc/settings";
import { formatError } from "./ipc/errors";
import { formatCents } from "../src/lib/format";
import { localDateKey } from "../src/lib/visual-metrics";
import type { FinancialDigestSummary } from "../src/types/settings";

function formatCurrencyBreakdown(byCurrency: Record<string, number>): string {
  const entries = Object.entries(byCurrency).filter(([, cents]) => cents > 0);
  if (!entries.length) return "";
  return entries
    .map(([currency, cents]) => formatCents(cents, currency))
    .join(" + ");
}

export function computeFinancialDigest(
  today = localDateKey(new Date()),
): FinancialDigestSummary {
  const sqlite = getSqlite();

  const overdueInvoiceRows = sqlite
    .prepare(
      `SELECT currency, amount_cents, paid_cents
       FROM invoices
       WHERE trashed_at IS NULL
         AND status <> 'DRAFT'
         AND (amount_cents - paid_cents) > 0
         AND (status = 'OVERDUE' OR (due_date IS NOT NULL AND due_date < ?))`,
    )
    .all(today) as Array<{
    currency: string;
    amount_cents: number;
    paid_cents: number;
  }>;

  const overdueInvoicesByCurrency: Record<string, number> = {};
  for (const row of overdueInvoiceRows) {
    const balance = Math.max(0, row.amount_cents - row.paid_cents);
    overdueInvoicesByCurrency[row.currency] =
      (overdueInvoicesByCurrency[row.currency] || 0) + balance;
  }

  const dueTodayRow = sqlite
    .prepare(
      `SELECT COUNT(*) AS count
       FROM tasks
       WHERE deleted_at IS NULL
         AND status <> 'done'
         AND due_date = ?`,
    )
    .get(today) as { count: number };

  const overdueTaskRow = sqlite
    .prepare(
      `SELECT COUNT(*) AS count
       FROM tasks
       WHERE deleted_at IS NULL
         AND status <> 'done'
         AND due_date <> ''
         AND due_date < ?`,
    )
    .get(today) as { count: number };

  const payoutWindowEnd = addDaysToDateKey(today, 7);
  const payoutRows = sqlite
    .prepare(
      `SELECT w.currency,
              MAX(0, w.fee_cents - COALESCE((
                SELECT SUM(p.amount_cents)
                FROM vendor_payouts p
                WHERE p.work_order_id = w.id AND p.voided_at IS NULL
              ), 0)) AS remaining_cents
       FROM work_orders w
       WHERE w.payout_due_date IS NOT NULL
         AND w.payout_due_date <> ''
         AND w.payout_due_date <= ?`,
    )
    .all(payoutWindowEnd) as Array<{
    currency: string;
    remaining_cents: number;
  }>;

  const upcomingPayoutsByCurrency: Record<string, number> = {};
  let upcomingPayoutsCount = 0;
  for (const row of payoutRows) {
    if (row.remaining_cents <= 0) continue;
    upcomingPayoutsCount++;
    upcomingPayoutsByCurrency[row.currency] =
      (upcomingPayoutsByCurrency[row.currency] || 0) + row.remaining_cents;
  }

  const overdueInvoicesCount = overdueInvoiceRows.length;
  const tasksDueTodayCount = dueTodayRow?.count ?? 0;
  const overdueTasksCount = overdueTaskRow?.count ?? 0;
  const badgeCount = overdueInvoicesCount;
  const hasItems =
    overdueInvoicesCount > 0 ||
    tasksDueTodayCount > 0 ||
    overdueTasksCount > 0 ||
    upcomingPayoutsCount > 0;

  const parts: string[] = [];
  if (overdueInvoicesCount > 0) {
    const totals = formatCurrencyBreakdown(overdueInvoicesByCurrency);
    parts.push(
      `${overdueInvoicesCount} overdue invoice${overdueInvoicesCount === 1 ? "" : "s"}${totals ? ` (${totals})` : ""}`,
    );
  }
  const activeTaskAlerts = tasksDueTodayCount + overdueTasksCount;
  if (activeTaskAlerts > 0) {
    if (tasksDueTodayCount > 0 && overdueTasksCount > 0) {
      parts.push(
        `${tasksDueTodayCount} due today + ${overdueTasksCount} overdue task${overdueTasksCount === 1 ? "" : "s"}`,
      );
    } else if (tasksDueTodayCount > 0) {
      parts.push(
        `${tasksDueTodayCount} task${tasksDueTodayCount === 1 ? "" : "s"} due today`,
      );
    } else {
      parts.push(
        `${overdueTasksCount} overdue task${overdueTasksCount === 1 ? "" : "s"}`,
      );
    }
  }
  if (upcomingPayoutsCount > 0) {
    const totals = formatCurrencyBreakdown(upcomingPayoutsByCurrency);
    parts.push(
      `${upcomingPayoutsCount} vendor payout${upcomingPayoutsCount === 1 ? "" : "s"} due within 7 days${totals ? ` (${totals})` : ""}`,
    );
  }

  const headline = hasItems
    ? "BillFlow Daily Financial Briefing"
    : "BillFlow Daily Briefing: All Clear";
  const body = hasItems
    ? parts.join(" · ")
    : "No overdue invoices, tasks due today, or upcoming vendor payouts.";

  return {
    date: today,
    overdueInvoicesCount,
    overdueInvoicesByCurrency,
    tasksDueTodayCount,
    overdueTasksCount,
    upcomingPayoutsCount,
    upcomingPayoutsByCurrency,
    badgeCount,
    hasItems,
    headline,
    body,
  };
}

export function syncAppBadgeCount(options?: {
  tray?: Tray | null;
  today?: string;
}): number {
  const unlocked = isWorkspaceUnlocked();
  const count = unlocked
    ? computeFinancialDigest(options?.today).badgeCount
    : 0;
  try {
    if (typeof app?.setBadgeCount === "function") {
      app.setBadgeCount(count);
    }
  } catch {
    // Ignore badge API errors on unsupported Linux desktop environments
  }
  if (options?.tray) {
    try {
      options.tray.setToolTip(
        count > 0 ? `BillFlow — ${count} overdue` : "BillFlow",
      );
    } catch {
      // Ignore if tray is destroyed
    }
  }
  return count;
}

export function maybeSendDailyDigest(options?: {
  today?: string;
  force?: boolean;
  navigate?: (route: string) => void;
}): {
  sent: boolean;
  reason?: string;
  summary: FinancialDigestSummary;
} {
  const today = options?.today || localDateKey(new Date());
  if (!isWorkspaceUnlocked()) {
    return {
      sent: false,
      reason: "LOCKED",
      summary: {
        date: today,
        overdueInvoicesCount: 0,
        overdueInvoicesByCurrency: {},
        tasksDueTodayCount: 0,
        overdueTasksCount: 0,
        upcomingPayoutsCount: 0,
        upcomingPayoutsByCurrency: {},
        badgeCount: 0,
        hasItems: false,
        headline: "BillFlow Locked",
        body: "Unlock your profile to view daily financial alerts.",
      },
    };
  }

  const summary = computeFinancialDigest(today);
  const currentSettings = getOrCreateSettings();

  if (!options?.force) {
    if (currentSettings.digestEnabled === false) {
      return { sent: false, reason: "DISABLED", summary };
    }
    if (currentSettings.digestLastSentDate === today) {
      return { sent: false, reason: "ALREADY_SENT", summary };
    }
    if (!summary.hasItems) {
      return { sent: false, reason: "NOTHING_DUE", summary };
    }
  }

  const targetRoute =
    summary.overdueInvoicesCount > 0
      ? "/invoices"
      : summary.tasksDueTodayCount + summary.overdueTasksCount > 0
        ? "/tasks"
        : summary.upcomingPayoutsCount > 0
          ? "/outsourcing"
          : "/";

  try {
    if (
      typeof Notification === "function" &&
      (typeof Notification.isSupported !== "function" ||
        Notification.isSupported())
    ) {
      const note = new Notification({
        title: summary.headline,
        body: summary.body,
      });
      if (options?.navigate && typeof note.on === "function") {
        note.on("click", () => options.navigate?.(targetRoute));
      }
      if (typeof note.show === "function") {
        note.show();
      }
    }
  } catch {
    // Non-fatal in headless / test environments
  }

  getDb()
    .update(settings)
    .set({ digestLastSentDate: today })
    .where(eq(settings.id, "default"))
    .run();

  return { sent: true, summary };
}

export function registerDigestHandlers(
  navigate?: (route: string) => void,
  onSyncBadge?: () => void,
) {
  ipcMain.handle("digest:summary", () => {
    try {
      return computeFinancialDigest();
    } catch (err) {
      throw formatError(err);
    }
  });

  ipcMain.handle("digest:sendTest", () => {
    try {
      onSyncBadge?.();
      return maybeSendDailyDigest({ force: true, navigate });
    } catch (err) {
      throw formatError(err);
    }
  });
}
