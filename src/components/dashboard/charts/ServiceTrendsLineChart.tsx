"use client";

import { useMemo } from "react";
import {
  EChartsLineChart,
  type ChartConfig,
} from "@/components/evilcharts/charts/echarts-line-chart";
import { useData } from "@/lib/data/DataProvider";
import { buildServiceTrendsData } from "@/lib/widgets/chartData";

const chartConfig = {
  web: {
    label: "Core Deliverables",
    colors: {
      light: ["#059669"],
      dark: ["#10b981"],
    },
  },
  ai: {
    label: "AI & Consulting",
    colors: {
      light: ["#7c3aed"],
      dark: ["#8b5cf6"],
    },
  },
} satisfies ChartConfig;

export function ServiceTrendsLineChart() {
  const { tasks } = useData();

  const { chartData, hasData } = useMemo(
    () => buildServiceTrendsData(tasks),
    [tasks],
  );

  return (
    <div className="flex h-full w-full min-h-[260px] flex-col">
      {!hasData && (
        <div className="mb-2 px-3 py-1.5 rounded-lg bg-surface-neutral-50 border border-line-neutral-100 text-[11px] text-content-neutral-500 text-center">
          No completed deliverables recorded yet. Tasks marked Done appear here by month.
        </div>
      )}
      <EChartsLineChart
        data={chartData}
        config={chartConfig}
        className="h-full min-h-[235px] w-full flex-1"
        xDataKey="month"
      >
        <EChartsLineChart.Grid />
        <EChartsLineChart.XAxis
          dataKey="month"
          tickFormatter={(value) => value.substring(0, 3)}
        />
        <EChartsLineChart.YAxis />
        <EChartsLineChart.Brush />
        <EChartsLineChart.Legend isClickable />
        <EChartsLineChart.Tooltip />
        <EChartsLineChart.Line dataKey="web" strokeVariant="solid" isClickable>
          <EChartsLineChart.Dot variant="border" />
          <EChartsLineChart.ActiveDot variant="colored-border" />
        </EChartsLineChart.Line>
        <EChartsLineChart.Line dataKey="ai" strokeVariant="solid" isClickable>
          <EChartsLineChart.Dot variant="border" />
          <EChartsLineChart.ActiveDot variant="colored-border" />
        </EChartsLineChart.Line>
      </EChartsLineChart>
    </div>
  );
}
