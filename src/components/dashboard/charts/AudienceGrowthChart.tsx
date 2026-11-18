"use client";

import { useMemo } from "react";
import {
  EChartsAreaChart,
  type ChartConfig,
} from "@/components/evilcharts/charts/echarts-area-chart";
import { useReportingData } from "@/context/ReportingContext";
import { buildAudienceGrowthData } from "@/lib/widgets/chartData";
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
    label: "Net cashflow",
    colors: {
      light: ["#8b5cf6", "#6366f1"],
      dark: ["#a78bfa", "#818cf8"],
    },
  },
} satisfies ChartConfig;

export function AudienceGrowthChart() {
  const { invoices, expenses, workOrders, currency: activeCurrency } =
    useReportingData();

  const { chartData, totalCollectedCents, totalExpenseCents, netProfitCents } =
    useMemo(
      () =>
        buildAudienceGrowthData(invoices, expenses, workOrders, activeCurrency),
      [invoices, expenses, workOrders, activeCurrency],
    );

  const hasData = totalCollectedCents > 0 || totalExpenseCents > 0;
  const hasNegative = chartData.some((point) => point.profit < 0);

  return (
    <div className="flex h-full w-full min-h-[260px] flex-col">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-content-neutral-900 text-sm font-semibold tracking-tight sm:text-base">
            7-Month Collections vs Net Cashflow
          </span>
          <span className="text-content-neutral-500 max-w-[34ch] text-xs leading-snug">
            {hasData
              ? "Dated payments less recorded expenses and contractor payouts"
              : "No collections or expenses recorded in the last 7 months"}
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="text-content-neutral-900 text-xl font-semibold tracking-tight sm:text-2xl tabular-nums">
            {formatCents(totalCollectedCents, activeCurrency)}
          </span>
          <span className="text-content-neutral-500 text-xs tabular-nums">
            {netProfitCents >= 0 ? "Net cashflow: " : "Net outflow: "}
            {formatCents(Math.abs(netProfitCents), activeCurrency)}
          </span>
        </div>
      </div>

      {!hasData && (
        <div className="mt-2 px-3 py-1.5 rounded-lg bg-surface-neutral-50 border border-line-neutral-100 text-[11px] text-content-neutral-500 text-center">
          No transaction activity recorded. Updates as client payments and expenses are logged.
        </div>
      )}

      <div className="relative mt-2 min-h-[195px] w-full flex-1">
        <EChartsAreaChart
          data={chartData}
          config={chartConfig}
          xDataKey="month"
          className="h-full w-full"
          curveType="monotone"
          chartOptions={{
            grid: {
              left: 8,
              right: 8,
              top: 14,
              bottom: 26,
              outerBoundsMode: "none",
            },
            yAxis: {
              type: "value",
              show: false,
              scale: false,
              min: hasNegative ? undefined : 0,
            },
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

        <div className="text-content-neutral-500 pointer-events-none absolute inset-x-0 bottom-0 flex justify-between px-2 pb-1 text-[10px] sm:text-xs">
          {chartData.map(({ month }) => (
            <span key={month}>{month}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
