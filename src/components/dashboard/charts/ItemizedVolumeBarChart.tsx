"use client";

import { useMemo } from "react";
import {
  EChartsBarChart,
  type ChartConfig,
} from "@/components/evilcharts/charts/echarts-bar-chart";
import { useReportingData } from "@/context/ReportingContext";
import { buildItemizedVolumeData } from "@/lib/widgets/chartData";

const chartConfig = {
  web: {
    label: "Core Deliverables",
    colors: {
      light: ["#0284c7"],
      dark: ["#38bdf8"],
    },
  },
  ai: {
    label: "AI & Consulting",
    colors: {
      light: ["#e11d48"],
      dark: ["#fb7185"],
    },
  },
} satisfies ChartConfig;

export function ItemizedVolumeBarChart() {
  const { invoices, catalogItems, currency: activeCurrency } = useReportingData();

  const { chartData, hasData } = useMemo(
    () => buildItemizedVolumeData(invoices, catalogItems, activeCurrency),
    [invoices, catalogItems, activeCurrency],
  );

  return (
    <div className="flex h-full w-full min-h-[260px] flex-col">
      {!hasData && (
        <div className="mb-2 px-3 py-1.5 rounded-lg bg-surface-neutral-50 border border-line-neutral-100 text-[11px] text-content-neutral-500 text-center">
          No issued contract items recorded yet. Line items appear by invoice month.
        </div>
      )}
      <EChartsBarChart
        data={chartData}
        config={chartConfig}
        className="h-full min-h-[235px] w-full flex-1"
        xDataKey="month"
      >
        <EChartsBarChart.Grid />
        <EChartsBarChart.XAxis
          dataKey="month"
          tickFormatter={(value) => value.substring(0, 3)}
        />
        <EChartsBarChart.YAxis />
        <EChartsBarChart.Brush
          formatLabel={(value) => String(value).substring(0, 3)}
        />
        <EChartsBarChart.Legend isClickable />
        <EChartsBarChart.Tooltip />
        <EChartsBarChart.Bar dataKey="web" variant="default" isClickable />
        <EChartsBarChart.Bar dataKey="ai" variant="default" isClickable />
      </EChartsBarChart>
    </div>
  );
}
