import { describe, expect, it } from "vitest";
import { computeClientMargin, computeInvoiceMargin } from "../project-margin";
import type { ExchangeRates } from "../currency-conversion";
import type { ClientWithStats, InvoiceWithClient } from "@/types/billing";
import type { ExpenseItem } from "@/types/expenses";
import type { WorkOrderItem } from "@/types/outsourcing";
import type { TaskItem } from "@/types/tasks";

const RATES: ExchangeRates = {
  base: "USD",
  rates: {
    USD: 1,
    LKR: 300,
    EUR: 0.8,
    GBP: 0.75,
    CAD: 1.25,
  },
  updatedAt: "2026-11-19T00:00:00Z",
  nextUpdateAt: "2026-11-20T00:00:00Z",
  fetchedAt: "2026-11-19T00:00:00Z",
  provider: "ExchangeRate-API",
};

const baseClient: ClientWithStats = {
  id: "cli-1",
  name: "Acme Global",
  category: "Enterprise",
  contactPerson: "Alex",
  email: "alex@acme.test",
  currency: "USD",
  hasQuickBill: false,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  totalBilledCents: 200000,
  totalPaidCents: 100000,
  outstandingBalanceCents: 100000,
  invoicesCount: 1,
  recentInvoices: [],
};

function makeTask(partial: Partial<TaskItem>): TaskItem {
  return {
    id: partial.id || "t-1",
    title: partial.title || "Build API",
    description: "",
    status: partial.status || "done",
    priority: "medium",
    category: "Development",
    assignee: {
      name: "Me",
      avatarLetter: "M",
      bgColor: "#000",
      textColor: "#fff",
    },
    dueDate: "2026-11-20",
    subtasks: [],
    createdAt: "2026-11-01T00:00:00Z",
    activeMilliseconds: 0,
    ...partial,
  };
}

describe("project-margin engine", () => {
  it("computes accrual vs cash invoice margin with multi-currency conversion and effective hourly rate", () => {
    const invoice: InvoiceWithClient = {
      id: "inv-1",
      code: "INV-2026-001",
      clientId: "cli-1",
      clientName: "Acme Global",
      currency: "USD",
      amountCents: 200000, // $2,000.00
      paidCents: 100000, // $1,000.00 collected
      advanceCents: 100000,
      discountCents: 0,
      taxCents: 0,
      issueDate: "2026-11-01",
      status: "ADVANCE_PAID",
      createdAt: "2026-11-01T00:00:00Z",
      updatedAt: "2026-11-01T00:00:00Z",
    };

    const workOrders: WorkOrderItem[] = [
      {
        id: "wo-1",
        vendorId: "v-1",
        taskId: "t-1",
        invoiceId: "inv-1",
        scope: "UI Sub-module",
        feeCents: 9000000, // 90,000 LKR -> $300.00 USD
        payoutAmountCents: 4500000, // 45,000 LKR paid -> $150.00 USD
        currency: "LKR",
        status: "in-progress",
        payoutStatus: "PENDING",
      },
    ];

    const expenses: ExpenseItem[] = [
      {
        id: "exp-1",
        invoiceId: "inv-1",
        merchant: "Cloud GPU",
        description: "Training run",
        category: "HOSTING",
        amountCents: 10000, // $100.00 USD
        currency: "USD",
        incurredAt: "2026-11-05",
        deductible: true,
        createdAt: "2026-11-05T00:00:00Z",
      },
    ];

    const tasks: TaskItem[] = [
      makeTask({
        id: "t-1",
        invoiceId: "inv-1",
        activeMilliseconds: 10 * 3_600_000, // 10 hours
      }),
    ];

    const result = computeInvoiceMargin({
      invoice,
      workOrders,
      expenses,
      tasks,
      rates: RATES,
      targetCurrency: "USD",
    });

    expect(result.missingCurrencies).toEqual([]);
    expect(result.billedRevenueCents).toBe(200000);
    expect(result.committedWorkOrderCents).toBe(30000);
    expect(result.directExpenseCents).toBe(10000);
    expect(result.accrualNetMarginCents).toBe(160000); // $1,600.00
    expect(result.accrualMarginPercent).toBe(80);
    expect(result.effectiveHourlyRateAccrualCents).toBe(16000); // $160/hr

    // Cash lens: $1,000 collected - $150 paid payout - $100 expense = $750
    expect(result.cashNetMarginCents).toBe(75000);
    expect(result.cashMarginPercent).toBe(75);
    expect(result.effectiveHourlyRateCashCents).toBe(7500);
  });

  it("handles missing FX rates and zero tracked hours cleanly", () => {
    const invoice: InvoiceWithClient = {
      id: "inv-eur",
      code: "INV-2026-002",
      clientId: "cli-1",
      clientName: "Acme Global",
      currency: "EUR",
      amountCents: 100000,
      paidCents: 0,
      advanceCents: 0,
      discountCents: 0,
      taxCents: 0,
      issueDate: "2026-11-10",
      status: "UNPAID",
      createdAt: "2026-11-10T00:00:00Z",
      updatedAt: "2026-11-10T00:00:00Z",
    };

    const result = computeInvoiceMargin({
      invoice,
      workOrders: [],
      expenses: [],
      tasks: [],
      rates: null,
      targetCurrency: "USD",
    });

    expect(result.missingCurrencies).toEqual(["EUR"]);
    expect(result.totalHours).toBe(0);
    expect(result.effectiveHourlyRateAccrualCents).toBeNull();
  });

  it("aggregates client margin excluding DRAFT invoices and provides per-invoice breakdown", () => {
    const invoices: InvoiceWithClient[] = [
      {
        id: "inv-issued",
        code: "INV-2026-010",
        clientId: "cli-1",
        clientName: "Acme Global",
        currency: "USD",
        amountCents: 300000,
        paidCents: 300000,
        advanceCents: 0,
        discountCents: 0,
        taxCents: 0,
        issueDate: "2026-11-05",
        status: "PAID",
        createdAt: "2026-11-05T00:00:00Z",
        updatedAt: "2026-11-05T00:00:00Z",
      },
      {
        id: "inv-draft",
        code: "INV-2026-011",
        clientId: "cli-1",
        clientName: "Acme Global",
        currency: "USD",
        amountCents: 999900,
        paidCents: 0,
        advanceCents: 0,
        discountCents: 0,
        taxCents: 0,
        issueDate: "2026-11-12",
        status: "DRAFT",
        createdAt: "2026-11-12T00:00:00Z",
        updatedAt: "2026-11-12T00:00:00Z",
      },
    ];

    const summary = computeClientMargin({
      client: baseClient,
      invoices,
      workOrders: [
        {
          id: "wo-cli",
          vendorId: "v-1",
          taskId: null,
          invoiceId: "inv-issued",
          clientId: "cli-1",
          scope: "QA audit",
          feeCents: 50000,
          payoutAmountCents: 50000,
          currency: "USD",
          status: "done",
          payoutStatus: "PAID",
        },
      ],
      expenses: [],
      tasks: [
        makeTask({
          id: "t-cli",
          clientId: "cli-1",
          invoiceId: "inv-issued",
          activeMilliseconds: 5 * 3_600_000,
        }),
      ],
      rates: RATES,
      targetCurrency: "USD",
    });

    expect(summary.invoiceCount).toBe(1);
    expect(summary.billedRevenueCents).toBe(300000);
    expect(summary.accrualNetMarginCents).toBe(250000);
    expect(summary.totalHours).toBe(5);
    expect(summary.effectiveHourlyRateAccrualCents).toBe(50000);
    expect(summary.invoiceBreakdown).toHaveLength(1);
    expect(summary.invoiceBreakdown[0].invoice.code).toBe("INV-2026-010");
  });
});
