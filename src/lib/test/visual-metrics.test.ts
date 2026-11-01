import { describe, expect, it } from "vitest";
import {
  issuedInPeriod,
  isPastDue,
  localDateKey,
  recentMonths,
  remainingBalance,
  sharePercent,
  taskProgress,
} from "../visual-metrics";
import type { Invoice } from "@/types/billing";

const invoice = (patch: Partial<Invoice> = {}): Invoice => ({
  id: "website-job",
  code: "INV-001",
  clientId: "client-1",
  amountCents: 9_000_000,
  paidCents: 4_500_000,
  currency: "LKR",
  status: "ADVANCE_PAID",
  issueDate: "2026-10-10",
  dueDate: "2026-10-24",
  createdAt: "2026-10-10",
  updatedAt: "2026-10-10",
  ...patch,
});

describe("data graphic measures", () => {
  it("renders no filled share for zero values, including empty data", () => {
    expect(sharePercent(0, 100)).toBe(0);
    expect(sharePercent(0, 0)).toBe(0);
    expect(sharePercent(20, 0)).toBe(0);
  });
  it("keeps small amounts proportional without a decorative minimum", () => {
    expect(sharePercent(1, 1000)).toBe(0.1);
    expect(sharePercent(45_000, 90_000)).toBe(50);
  });
  it("uses actual payments for advance and fully settled balances", () => {
    expect(remainingBalance(invoice())).toBe(4_500_000);
    expect(
      remainingBalance(invoice({ paidCents: 9_000_000, status: "PAID" })),
    ).toBe(0);
    expect(remainingBalance(invoice({ paidCents: 0, status: "PAID" }))).toBe(
      9_000_000,
    );
  });
  it("does not invent completion percentages from workflow stages", () => {
    expect(taskProgress({ status: "in-progress", subtasks: [] })).toBeNull();
    expect(taskProgress({ status: "review", subtasks: [] })).toBeNull();
    expect(taskProgress({ status: "done", subtasks: [] })).toBe(100);
    expect(
      taskProgress({
        status: "in-progress",
        subtasks: [
          { id: "a", title: "Build", completed: true },
          { id: "b", title: "Review", completed: false },
        ],
      }),
    ).toBe(50);
  });
  it("keeps currencies, drafts and empty selected periods separate", () => {
    const now = new Date(2026, 9, 17);
    const records = [
      invoice(),
      invoice({ id: "usd", currency: "USD" }),
      invoice({ id: "draft", status: "DRAFT" }),
      invoice({ id: "old", issueDate: "2026-01-01" }),
    ];
    expect(
      issuedInPeriod(records, "LKR", "quarter", now).map((record) => record.id),
    ).toEqual(["website-job"]);
    expect(
      issuedInPeriod(records, "LKR", "month", new Date(2026, 10, 17)),
    ).toEqual([]);
    expect(issuedInPeriod(records, "LKR", "all", now)).toHaveLength(2);
  });
  it("keeps overdue filters consistent with unpaid balances, including advances", () => {
    expect(isPastDue(invoice({ dueDate: "2026-10-01" }), "2026-10-17")).toBe(
      true,
    );
    expect(
      isPastDue(
        invoice({
          status: "PAID",
          paidCents: 9_000_000,
          dueDate: "2026-10-01",
        }),
        "2026-10-17",
      ),
    ).toBe(false);
    expect(
      isPastDue(
        invoice({ status: "DRAFT", dueDate: "2026-10-01" }),
        "2026-10-17",
      ),
    ).toBe(false);
    expect(isPastDue(invoice({ dueDate: "2026-10-17" }), "2026-10-17")).toBe(
      false,
    );
  });
  it("labels rolling months across year boundaries", () => {
    expect(
      recentMonths(new Date(2026, 0, 1)).map((month) => month.key),
    ).toEqual([
      "2025-08",
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
    ]);
    expect(localDateKey(new Date(2026, 9, 17))).toBe("2026-10-17");
  });
});
