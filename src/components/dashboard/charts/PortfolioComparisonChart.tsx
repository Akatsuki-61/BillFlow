"use client";

import { useMemo } from "react";
import {
  EChartsAreaChart,
  type ChartConfig,
} from "@/components/evilcharts/charts/echarts-area-chart";
import { useReportingData } from "@/context/ReportingContext";
import { buildPortfolioComparisonData } from "@/lib/widgets/chartData";

const chartConfig = {
  web: {
    label: "Core services",
    colors: { light: ["#2563eb"], dark: ["#3b82f6"] },
  },
  ai: {
    label: "AI & consulting",
    colors: { light: ["#059669"], dark: ["#10b981"] },
  },
} satisfies ChartConfig;

export function PortfolioComparisonChart() {
  const { invoices, catalogItems, currency: activeCurrency } = useReportingData();

  const { series, chartData, hasInvoices } = useMemo(
    () => buildPortfolioComparisonData(invoices, catalogItems, activeCurrency),
    [invoices, catalogItems, activeCurrency],
  );

  return (
    <div className="flex h-full w-full min-h-[260px] flex-col">
      <p className="summary-caption !mt-0 mb-3">
        Gross line-item values over the last 6 months before discounts and tax.
      </p>
      <div className="grid grid-cols-2 gap-x-6 mb-2">
        {series.map(({ key, label, color, pct, formattedTotal }) => (
          <div key={key} className="flex flex-col gap-0.5">
            <div className="text-content-neutral-500 flex items-center gap-2 text-xs">
              <span
                className="size-2.5 shrink-0 rounded-full border-2"
                style={{ borderColor: color }}
              />
              {label}
            </div>
            <div className="text-content-neutral-900 text-xl font-semibold tracking-tight sm:text-2xl tabular-nums">
              {pct}%
            </div>
            <div className="text-xs font-medium text-content-neutral-600 tabular-nums">
              {formattedTotal}
            </div>
          </div>
        ))}
      </div>

      {!hasInvoices && (
        <div className="mt-2 px-3 py-1.5 rounded-lg bg-surface-neutral-50 border border-line-neutral-100 text-[11px] text-content-neutral-500 text-center">
          No service invoices recorded yet. Breakdown updates as invoices are issued.
        </div>
      )}

      <EChartsAreaChart
        data={chartData}
        config={chartConfig}
        xDataKey="date"
        className="mt-2 min-h-[175px] w-full flex-1"
        curveType="step"
        enableHoverReveal
        chartOptions={{
          grid: { left: 8, right: 8, top: 14, bottom: 8 },
          yAxis: { type: "value", show: false, min: 0 },
        }}
      >
        <EChartsAreaChart.Tooltip variant="frosted-glass" />
        <EChartsAreaChart.Area
          dataKey="web"
          variant="dotted"
          strokeVariant="solid"
        >
          <EChartsAreaChart.ActiveDot variant="ping" />
        </EChartsAreaChart.Area>
        <EChartsAreaChart.Area
          dataKey="ai"
          variant="dotted"
          strokeVariant="solid"
        >
          <EChartsAreaChart.ActiveDot variant="ping" />
        </EChartsAreaChart.Area>
      </EChartsAreaChart>
    </div>
  );
}
