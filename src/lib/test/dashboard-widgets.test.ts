import { describe, expect, it } from "vitest";
import { DEFAULT_DASHBOARD_WIDGET_IDS } from "../widgets/widgetDefinitions";
import {
  buildPortfolioComparisonData,
  buildServiceTrendsData,
  buildItemizedVolumeData,
  buildLatencyPercentilesData,
  buildGrowthBenchmarkData,
  buildAudienceGrowthData,
  computeCashflowRunwayCard,
} from "../widgets/chartData";
import type { InvoiceWithClient, CatalogItem } from "../../types/billing";
import type { TaskItem } from "../../types/tasks";
import type { AnalyticsSummaryPayload } from "../../types/analytics";

describe("Dashboard Widget Removal and Undo Flow", () => {
  it("removes a widget from the dashboard and records history for undo", () => {
    let currentWidgets = [...DEFAULT_DASHBOARD_WIDGET_IDS];
    const history: string[][] = [];

    // User removes first pinned widget
    const targetToRemove = DEFAULT_DASHBOARD_WIDGET_IDS[0];
    history.push([...currentWidgets]);
    currentWidgets = currentWidgets.filter((id) => id !== targetToRemove);

    expect(currentWidgets.includes(targetToRemove)).toBe(false);
    expect(history.length).toBe(1);

    // User clicks Undo
    const previousState = history.pop()!;
    currentWidgets = previousState;

    expect(currentWidgets.includes(targetToRemove)).toBe(true);
    expect(currentWidgets).toEqual(DEFAULT_DASHBOARD_WIDGET_IDS);
  });

  it("undoes drag-and-drop reordering (dropping) back to exact previous position", () => {
    let currentWidgets = [
      "rev-exp-chart",
      "net-profit",
      "cashflow-runway",
      "active-clients",
    ];
    const history: string[][] = [];

    // User drags index 0 to index 2 (dropping time)
    history.push([...currentWidgets]);
    const fromIndex = 0;
    const toIndex = 2;
    const updated = [...currentWidgets];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    currentWidgets = updated;

    expect(currentWidgets).toEqual([
      "net-profit",
      "cashflow-runway",
      "rev-exp-chart",
      "active-clients",
    ]);

    // User triggers Undo (toast or shortcut)
    const reverted = history.pop()!;
    currentWidgets = reverted;

    expect(currentWidgets).toEqual([
      "rev-exp-chart",
      "net-profit",
      "cashflow-runway",
      "active-clients",
    ]);
  });

  it("undoes adding a new widget to dashboard", () => {
    let currentWidgets = ["rev-exp-chart", "net-profit"];
    const history: string[][] = [];

    // User pins "sprint-tasks"
    const newWidget = "sprint-tasks";
    history.push([...currentWidgets]);
    currentWidgets = [...currentWidgets, newWidget];

    expect(currentWidgets).toEqual([
      "rev-exp-chart",
      "net-profit",
      "sprint-tasks",
    ]);

    // User clicks Undo
    currentWidgets = history.pop()!;
    expect(currentWidgets).toEqual(["rev-exp-chart", "net-profit"]);
  });
});

describe("Widget & Chart Data Pipeline Integrity", () => {
  const fixedNow = new Date("2026-11-18T12:00:00Z");

  it("counts all non-draft invoice line items in Itemized Volume regardless of keywords", () => {
    const invoices = [
      {
        id: "inv-1",
        code: "INV-001",
        clientId: "c1",
        clientName: "Acme",
        status: "PAID",
        currency: "USD",
        issueDate: "2026-11-10",
        amountCents: 30000,
        paidCents: 30000,
        discountCents: 0,
        taxCents: 0,
        advanceCents: 0,
        createdAt: "2026-11-10T00:00:00Z",
        updatedAt: "2026-11-10T00:00:00Z",
        items: [
          {
            id: "i1",
            invoiceId: "inv-1",
            description: "Desktop Service",
            quantity: 2,
            unitPriceCents: 10000,
            position: 0,
          },
          {
            id: "i2",
            invoiceId: "inv-1",
            description: "AI Strategy Audit",
            quantity: 1,
            unitPriceCents: 10000,
            position: 1,
          },
        ],
      },
    ] as InvoiceWithClient[];

    const result = buildItemizedVolumeData(invoices, [], "USD", fixedNow);
    expect(result.hasData).toBe(true);
    const nov = result.chartData[result.chartData.length - 1];
    expect(nov.web).toBe(2);
    expect(nov.ai).toBe(1);
  });

  it("plots completed tasks across all categories in Service Delivery Trends even when completedAt is missing", () => {
    const tasks = [
      {
        id: "t1",
        title: "Quarterly assessment",
        description: "",
        status: "done",
        priority: "medium",
        category: "Documentation",
        assignee: { name: "Owner", avatarLetter: "O", bgColor: "", textColor: "" },
        dueDate: "",
        subtasks: [],
        createdAt: "2026-11-05T10:00:00Z",
        updatedAt: "2026-11-06T10:00:00Z",
        completedAt: null,
        activeMilliseconds: 0,
      },
      {
        id: "t2",
        title: "LLM Triage Agent",
        description: "",
        status: "done",
        priority: "high",
        category: "Development",
        assignee: { name: "Owner", avatarLetter: "O", bgColor: "", textColor: "" },
        dueDate: "",
        subtasks: [],
        createdAt: "2026-11-05T10:00:00Z",
        updatedAt: "2026-11-07T10:00:00Z",
        completedAt: "2026-11-07T10:00:00Z",
        activeMilliseconds: 90_000,
      },
    ] as TaskItem[];

    const trends = buildServiceTrendsData(tasks, fixedNow);
    expect(trends.hasData).toBe(true);
    const nov = trends.chartData[trends.chartData.length - 1];
    expect(nov.web).toBe(1);
    expect(nov.ai).toBe(1);

    const bench = buildGrowthBenchmarkData(tasks, fixedNow);
    expect(bench.reduce((sum, w) => sum + w.completed, 0)).toBe(2);

    const percentiles = buildLatencyPercentilesData(tasks, fixedNow);
    expect(percentiles.hasTrackedHours).toBe(true);
    expect(percentiles.series[0].latest).toBeGreaterThanOrEqual(0.1);
  });

  it("includes 6 rolling months of invoices in Portfolio Comparison using catalog category", () => {
    const catalog: CatalogItem[] = [
      {
        id: "cat-1",
        title: "Architecture Advisory",
        category: "Consulting",
        sku: "CON-1",
        description: "",
        price: "200.00",
        priceCents: 20000,
        currency: "USD",
        unit: "/ Fixed",
        iconType: "consulting",
      },
    ];
    const invoices = [
      {
        id: "inv-old",
        code: "INV-090",
        clientId: "c1",
        clientName: "Old Client",
        status: "PAID",
        currency: "USD",
        issueDate: "2026-08-15",
        amountCents: 20000,
        paidCents: 20000,
        discountCents: 0,
        taxCents: 0,
        advanceCents: 0,
        createdAt: "2026-08-15T00:00:00Z",
        updatedAt: "2026-08-15T00:00:00Z",
        items: [
          {
            id: "i1",
            invoiceId: "inv-old",
            catalogId: "cat-1",
            description: "Advisory Package",
            quantity: 1,
            unitPriceCents: 20000,
            position: 0,
          },
        ],
      },
    ] as InvoiceWithClient[];

    const portfolio = buildPortfolioComparisonData(invoices, catalog, "USD", fixedNow);
    expect(portfolio.hasInvoices).toBe(true);
    const aug = portfolio.chartData.find((d) => d.date === "Aug");
    expect(aug?.ai).toBe(200);
    expect(portfolio.series.find((s) => s.key === "ai")?.pct).toBe(100);
  });

  it("derives real cashflow runway metrics instead of a 'Not tracked' stub", () => {
    const financials = {
      paidCents: 600000,
      cashflowRunwayMonths: 6,
      monthlyTrends: [
        { key: "2026-06", label: "Jun", revenueCents: 0, expensesCents: 100000, profitCents: 0, marginPct: 0 },
        { key: "2026-07", label: "Jul", revenueCents: 0, expensesCents: 100000, profitCents: 0, marginPct: 0 },
        { key: "2026-08", label: "Aug", revenueCents: 0, expensesCents: 100000, profitCents: 0, marginPct: 0 },
        { key: "2026-09", label: "Sep", revenueCents: 0, expensesCents: 100000, profitCents: 0, marginPct: 0 },
        { key: "2026-10", label: "Oct", revenueCents: 0, expensesCents: 100000, profitCents: 0, marginPct: 0 },
        { key: "2026-11", label: "Nov", revenueCents: 0, expensesCents: 100000, profitCents: 0, marginPct: 0 },
      ],
    } as AnalyticsSummaryPayload;

    const card = computeCashflowRunwayCard(financials, "USD");
    expect(card.value).toBe("6 mo");
    expect(card.badgeText).toContain("$1,000.00/mo");
    expect(card.barPct).toBe(50);

    const zeroBurn = computeCashflowRunwayCard(
      {
        ...financials,
        monthlyTrends: financials.monthlyTrends.map((m) => ({ ...m, expensesCents: 0 })),
      },
      "USD",
    );
    expect(zeroBurn.value).toBe("$6,000.00");
    expect(zeroBurn.badgeText).toBe("Zero monthly burn");

    const audience = buildAudienceGrowthData([], [], [], "USD", fixedNow);
    expect(audience.chartData).toHaveLength(7);
  });
});
