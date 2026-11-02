import type { TaskItem } from "@/types/tasks";
import type { Currency, Invoice } from "@/types/billing";
import type { DashboardPeriod } from "@/types/dashboard";

/** A zero denominator has no share. Keep precision so small real amounts stay proportional. */
export function sharePercent(value: number, total: number): number {
  return total > 0 ? Math.min(100, Math.max(0, (value / total) * 100)) : 0;
}

export function taskProgress(
  task: Pick<TaskItem, "status" | "subtasks">,
): number | null {
  if (!task.subtasks.length) return task.status === "done" ? 100 : null;
  return Math.round(
    sharePercent(
      task.subtasks.filter((item) => item.completed).length,
      task.subtasks.length,
    ),
  );
}

export const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function recentMonths(now = new Date()) {
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: SHORT_MONTHS[date.getMonth()],
    };
  });
}

export function issuedInPeriod<T extends Invoice>(
  invoices: T[],
  currency: Currency,
  period: DashboardPeriod,
  now = new Date(),
) {
  return invoices.filter((invoice) => {
    if (invoice.status === "DRAFT" || invoice.currency !== currency)
      return false;
    if (period === "all") return true;
    const date = new Date(`${invoice.issueDate.slice(0, 10)}T12:00:00`);
    if (
      Number.isNaN(date.getTime()) ||
      date.getFullYear() !== now.getFullYear()
    )
      return false;
    if (period === "year") return true;
    if (period === "month") return date.getMonth() === now.getMonth();
    return Math.floor(date.getMonth() / 3) === Math.floor(now.getMonth() / 3);
  });
}

export function remainingBalance(
  invoice: Pick<Invoice, "amountCents" | "paidCents">,
) {
  return Math.max(0, invoice.amountCents - (invoice.paidCents ?? 0));
}

export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function isPastDue(
  invoice: Pick<Invoice, "status" | "dueDate" | "amountCents" | "paidCents">,
  today = localDateKey(),
) {
  return (
    invoice.status !== "DRAFT" &&
    remainingBalance(invoice) > 0 &&
    (invoice.status === "OVERDUE" ||
      Boolean(invoice.dueDate && invoice.dueDate < today))
  );
}
