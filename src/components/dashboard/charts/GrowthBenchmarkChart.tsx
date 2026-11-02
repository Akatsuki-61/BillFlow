"use client";

import { useMemo } from "react";
import {
  EChartsAreaChart,
  type ChartConfig,
} from "@/components/evilcharts/charts/echarts-area-chart";
import { useData } from "@/lib/data/DataProvider";

const config = {
  completed: {
    label: "Completed tasks",
    colors: { light: ["#2563eb"], dark: ["#60a5fa"] },
  },
} satisfies ChartConfig;

export function GrowthBenchmarkChart() {
  const { tasks } = useData();
  const data = useMemo(() => {
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    return Array.from({ length: 8 }, (_, index) => {
      const end = new Date(now);
      end.setDate(end.getDate() - (7 - index) * 7);
      const start = new Date(end);
      start.setDate(start.getDate() - 7);
      return {
        date: end.toLocaleDateString("en", { month: "short", day: "numeric" }),
        completed: tasks.filter(
          (task) =>
            task.status === "done" &&
            task.completedAt &&
            new Date(task.completedAt) > start &&
            new Date(task.completedAt) <= end,
        ).length,
      };
    });
  }, [tasks]);
  return (
    <div className="flex h-full w-full min-h-[300px] flex-col p-4">
      <p className="summary-caption">
        Completed deliverables per week · last eight weeks. Each task is counted
        once, on its completion date.
      </p>
      <EChartsAreaChart
        data={data}
        config={config}
        xDataKey="date"
        className="mt-4 min-h-[220px] w-full flex-1"
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
