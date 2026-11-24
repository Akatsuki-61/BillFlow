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
import {
  buildDotMatrixBuckets,
  buildSteppedRetentionSeries,
  computeDashboardMetrics,
  getPeriodWindowBounds,
} from "../../components/dashboard/DashboardMetricsContext";
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

  it("includes prior-period past-due invoices in overdueInvoices on month period", () => {
    const invoices = [
      {
        id: "inv-prior-overdue",
        code: "INV-2026-010",
        clientId: "c1",
        clientName: "Acme",
        status: "UNPAID",
        currency: "USD",
        issueDate: "2026-01-10",
        dueDate: "2026-01-24",
        amountCents: 150000,
        paidCents: 50000,
        createdAt: "2026-01-10T00:00:00Z",
        updatedAt: "2026-01-10T00:00:00Z",
      },
      {
        id: "inv-draft",
        code: "INV-2026-011",
        clientId: "c1",
        clientName: "Acme",
        status: "DRAFT",
        currency: "USD",
        issueDate: "2026-01-10",
        dueDate: "2026-01-24",
        amountCents: 90000,
        paidCents: 0,
        createdAt: "2026-01-10T00:00:00Z",
        updatedAt: "2026-01-10T00:00:00Z",
      },
      {
        id: "inv-other-currency",
        code: "INV-2026-012",
        clientId: "c2",
        clientName: "Colombo Co",
        status: "OVERDUE",
        currency: "LKR",
        issueDate: "2026-01-10",
        dueDate: "2026-01-24",
        amountCents: 500000,
        paidCents: 0,
        createdAt: "2026-01-10T00:00:00Z",
        updatedAt: "2026-01-10T00:00:00Z",
      },
    ] as InvoiceWithClient[];

    const metrics = computeDashboardMetrics({
      invoices,
      expenses: [],
      workOrders: [],
      clients: [],
      tasks: [],
      period: "month",
      currency: "USD",
    });

    expect(metrics.filteredInvoices).toHaveLength(0);
    expect(metrics.currencyIssuedCount).toBe(1);
    expect(metrics.overdueInvoices.map((i) => i.id)).toEqual([
      "inv-prior-overdue",
    ]);
    expect(metrics.overdueTotalStr).toBe("$1,000.00");
  });

  it("computes Zentra date comparison ranges, 12-col dot matrices, stepped retention bins, and period deltas", () => {
    const bounds = getPeriodWindowBounds("quarter", fixedNow);
    expect(bounds.periodRangeLabel).toBe("Oct 01 – Dec 31");
    expect(bounds.previousRangeLabel).toBe("Jul 01 – Sep 30");

    // Weekly period bounds (2026-11-18 is Wednesday -> Mon Nov 16 to Sun Nov 22)
    const weekBounds = getPeriodWindowBounds("week", fixedNow);
    expect(weekBounds.periodRangeLabel).toBe("Nov 16 – Nov 22");
    expect(weekBounds.previousRangeLabel).toBe("Nov 09 – Nov 15");

    const weeklyMetrics = computeDashboardMetrics({
      invoices: [
        {
          id: "inv-this-week",
          code: "INV-W1",
          clientId: "c1",
          clientName: "Acme",
          status: "PAID",
          currency: "USD",
          issueDate: "2026-11-17",
          dueDate: "2026-11-24",
          amountCents: 200000,
          paidCents: 200000,
          createdAt: "2026-11-17T00:00:00Z",
          updatedAt: "2026-11-17T00:00:00Z",
        },
        {
          id: "inv-last-week",
          code: "INV-W0",
          clientId: "c1",
          clientName: "Acme",
          status: "PAID",
          currency: "USD",
          issueDate: "2026-11-11",
          dueDate: "2026-11-18",
          amountCents: 100000,
          paidCents: 100000,
          createdAt: "2026-11-11T00:00:00Z",
          updatedAt: "2026-11-11T00:00:00Z",
        },
      ] as InvoiceWithClient[],
      expenses: [],
      workOrders: [],
      clients: [],
      tasks: [],
      period: "week",
      currency: "USD",
      now: fixedNow,
    });
    expect(weeklyMetrics.filteredInvoices.map((i) => i.id)).toEqual(["inv-this-week"]);
    expect(weeklyMetrics.grossDeltaPct).toBe(100);

    const { buckets, peakLabel } = buildDotMatrixBuckets(
      ["2026-11-15", "2026-11-16", "2026-11-17", "2026-10-12"],
      fixedNow,
      14,
    );
    expect(buckets).toHaveLength(12);
    expect(buckets.some((b) => b.isPeak)).toBe(true);
    expect(peakLabel).toBe("Nov");

    const stepped = buildSteppedRetentionSeries(
      [
        { key: "2026-06", label: "Jun", revenueCents: 10000, expensesCents: 4000, profitCents: 6000, marginPct: 60 },
        { key: "2026-07", label: "Jul", revenueCents: 10000, expensesCents: 2000, profitCents: 8000, marginPct: 80 },
        { key: "2026-08", label: "Aug", revenueCents: 10000, expensesCents: 5000, profitCents: 5000, marginPct: 50 },
        { key: "2026-09", label: "Sep", revenueCents: 10000, expensesCents: 3000, profitCents: 7000, marginPct: 70 },
        { key: "2026-10", label: "Oct", revenueCents: 10000, expensesCents: 3500, profitCents: 6500, marginPct: 65 },
        { key: "2026-11", label: "Nov", revenueCents: 10000, expensesCents: 1500, profitCents: 8500, marginPct: 85 },
      ],
      75,
    );
    expect(stepped.points).toHaveLength(24);
    expect(stepped.peakPct).toBe(85);
    expect(stepped.peakIndex).toBeGreaterThanOrEqual(20);

    const metrics = computeDashboardMetrics({
      invoices: [
        {
          id: "inv-q3",
          code: "INV-Q3",
          clientId: "c1",
          clientName: "Acme",
          status: "PAID",
          currency: "USD",
          issueDate: "2026-08-12",
          dueDate: "2026-08-26",
          amountCents: 100000,
          paidCents: 100000,
          createdAt: "2026-08-12T00:00:00Z",
          updatedAt: "2026-08-12T00:00:00Z",
        },
        {
          id: "inv-q4",
          code: "INV-Q4",
          clientId: "c1",
          clientName: "Acme",
          status: "PAID",
          currency: "USD",
          issueDate: "2026-11-10",
          dueDate: "2026-11-24",
          amountCents: 150000,
          paidCents: 150000,
          createdAt: "2026-11-10T00:00:00Z",
          updatedAt: "2026-11-10T00:00:00Z",
        },
      ] as InvoiceWithClient[],
      expenses: [],
      workOrders: [],
      clients: [],
      tasks: [],
      period: "quarter",
      currency: "USD",
      now: fixedNow,
    });

    expect(metrics.grossDeltaPct).toBe(50);
    expect(metrics.pipelineStages).toHaveLength(5);
    expect(metrics.pipelineStages[0].conversionPct).toBe(100);
    expect(metrics.invoiceDotBuckets).toHaveLength(12);
    expect(metrics.steppedRetentionSeries).toHaveLength(24);
  });
});
