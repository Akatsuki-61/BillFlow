"use client";

import { useMemo } from "react";
import {
  EChartsAreaChart,
  type ChartConfig,
} from "@/components/evilcharts/charts/echarts-area-chart";
import { useData } from "@/lib/data/DataProvider";
import { buildGrowthBenchmarkData } from "@/lib/widgets/chartData";

const config = {
  completed: {
    label: "Completed tasks",
    colors: { light: ["#2563eb"], dark: ["#60a5fa"] },
  },
} satisfies ChartConfig;

export function GrowthBenchmarkChart() {
  const { tasks } = useData();
  const data = useMemo(() => buildGrowthBenchmarkData(tasks), [tasks]);
  const hasAny = data.some((d) => d.completed > 0);

  return (
    <div className="flex h-full w-full min-h-[260px] flex-col">
      <p className="summary-caption !mt-0 mb-2">
        Completed deliverables per week across the last 8 weeks.
      </p>
      {!hasAny && (
        <div className="mb-2 px-3 py-1.5 rounded-lg bg-surface-neutral-50 border border-line-neutral-100 text-[11px] text-content-neutral-500 text-center">
          No completed tasks in the last 8 weeks. Move tasks to Done to see weekly output.
        </div>
      )}
      <EChartsAreaChart
        data={data}
        config={config}
        xDataKey="date"
        className="mt-2 min-h-[205px] w-full flex-1"
        curveType="linear"
      >
        <EChartsAreaChart.Grid />
        <EChartsAreaChart.XAxis dataKey="date" />
        <EChartsAreaChart.YAxis />
        <EChartsAreaChart.Tooltip />
        <EChartsAreaChart.Area
          dataKey="completed"
          variant="lines"
          strokeVariant="solid"
        />
      </EChartsAreaChart>
    </div>
  );
}
