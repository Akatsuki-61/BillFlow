"use client";

import React, { useMemo } from "react";
import { EChartsAreaChart, type ChartConfig } from "@/components/evilcharts/charts/echarts-area-chart";
import { useData, useActiveCurrency } from "@/lib/data/DataProvider";
import { formatCents } from "@/lib/format";

const chartConfig = {
  collections: {
    label: "Collections",
    colors: {
      light: ["#10b981", "#059669"],
      dark: ["#34d399", "#10b981"],
    },
  },
  profit: {
    label: "Net Profit",
    colors: {
      light: ["#8b5cf6", "#6366f1"],
      dark: ["#a78bfa", "#818cf8"],
    },
  },
} satisfies ChartConfig;

export function AudienceGrowthChart() {
  const { invoices, expenses } = useData();
  const { activeCurrency } = useActiveCurrency();

  const { chartData, totalCollectedCents, totalExpenseCents, netProfitCents } = useMemo(() => {
    const months: Array<{
      month: string;
      key: string;
      collections: number;
      expenses: number;
      profit: number;
    }> = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const month = d.toLocaleString("default", { month: "short" });
      months.push({ month, key, collections: 0, expenses: 0, profit: 0 });
    }

    let totalCollected = 0;
    (invoices || []).forEach((inv) => {
      if (inv.status === "DRAFT") return;
      const collected = (inv.paidCents && inv.paidCents > 0)
        ? inv.paidCents
        : (inv.status === "PAID" ? inv.amountCents : 0);
      totalCollected += collected;

      if (!inv.issueDate) return;
      const invKey = inv.issueDate.slice(0, 7);
      const target = months.find((m) => m.key === invKey);
      if (target) {
        target.collections += Math.round(collected / 100);
      }
    });

    let totalExpense = 0;
    (expenses || []).forEach((exp) => {
      const amt = exp.amountCents || 0;
      totalExpense += amt;
      const dateStr = exp.incurredAt || exp.createdAt;
      if (!dateStr) return;
      const expKey = dateStr.slice(0, 7);
      const target = months.find((m) => m.key === expKey);
      if (target) {
        target.expenses += Math.round(amt / 100);
      }
    });

    months.forEach((m) => {
      m.profit = Math.max(0, m.collections - m.expenses);
    });

    return {
      chartData: months.map(({ month, collections, profit }) => ({
        month,
        collections,
        profit,
      })),
      totalCollectedCents: totalCollected,
      totalExpenseCents: totalExpense,
      netProfitCents: totalCollected - totalExpense,
    };
  }, [invoices, expenses]);

  const hasData = totalCollectedCents > 0 || totalExpenseCents > 0;

  return (
    <div className="flex h-full w-full min-h-[300px] flex-col">
      <div className="flex items-start justify-between gap-4 px-4 pt-4">
        <div className="flex flex-col gap-1">
          <span className="text-content-neutral-900 text-base font-semibold tracking-tight sm:text-lg">
            Delivered Solutions Financial Growth
          </span>
          <span className="text-content-neutral-500 max-w-[34ch] text-xs leading-snug">
            {hasData
              ? "Monthly realized cash collections and net profit from client contracts"
              : "No collections or expenses recorded in this period"}
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-content-neutral-900 text-2xl font-semibold tracking-tight sm:text-3xl">
            {formatCents(totalCollectedCents, activeCurrency)}
          </span>
          <span className="text-content-neutral-500 text-xs">
            {netProfitCents >= 0 ? "Net Profit: " : "Net Deficit: "}
            {formatCents(Math.abs(netProfitCents), activeCurrency)}
          </span>
        </div>
      </div>

      {!hasData && (
        <div className="mt-2 mx-4 px-3 py-1.5 rounded-lg bg-surface-neutral-50 border border-line-neutral-100 text-[11px] text-content-neutral-500 text-center">
          No transaction activity recorded. Collections and profits update as client payments and expenses are logged.
        </div>
      )}

      <div className="relative mt-2 min-h-[220px] w-full flex-1">
        <EChartsAreaChart
          data={chartData}
          config={chartConfig}
          xDataKey="month"
          className="h-full w-full"
          curveType="monotone"
          chartOptions={{
            grid: { left: 8, right: 8, top: 16, bottom: 28, outerBoundsMode: "none" },
            yAxis: { type: "value", show: false, scale: false, min: 0 },
          }}
        >
          <EChartsAreaChart.Tooltip variant="frosted-glass" />
          <EChartsAreaChart.Area
            dataKey="collections"
            variant="gradient"
            strokeVariant="solid"
            strokeWidth={2.5}
          >
            <EChartsAreaChart.ActiveDot variant="ping" />
          </EChartsAreaChart.Area>
          <EChartsAreaChart.Area
            dataKey="profit"
            variant="gradient"
            strokeVariant="solid"
            strokeWidth={2}
          >
            <EChartsAreaChart.ActiveDot variant="ping" />
          </EChartsAreaChart.Area>
        </EChartsAreaChart>

        <div className="text-content-neutral-500 pointer-events-none absolute inset-x-0 bottom-0 flex justify-between px-4 pb-2 text-[10px] sm:text-xs">
          {chartData.map(({ month }) => (
            <span key={month}>{month}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
