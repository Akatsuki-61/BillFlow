"use client";

import { useState, useMemo } from "react";
import {
  EChartsAreaChart,
  type ChartConfig,
} from "@/components/evilcharts/charts/echarts-area-chart";
import { cn } from "@/lib/utils";
import { useData } from "@/lib/data/DataProvider";
import { buildLatencyPercentilesData } from "@/lib/widgets/chartData";

const chartConfig = {
  p99: {
    label: "P99 active time",
    colors: { light: ["#f87171"], dark: ["#D41F12"] },
  },
  p95: {
    label: "P95 active time",
    colors: { light: ["#fbbf24"], dark: ["#F37A00"] },
  },
  p75: {
    label: "P75 active time",
    colors: { light: ["#60a5fa"], dark: ["#62C9D4"] },
  },
  p50: {
    label: "P50 active time",
    colors: { light: ["#93c5fd"], dark: ["#007292"] },
  },
} satisfies ChartConfig;

export function LatencyPercentilesChart() {
  const { tasks } = useData();
  const [selected, setSelected] = useState<string | null>(null);

  const { series, chartData, hasTrackedHours } = useMemo(
    () => buildLatencyPercentilesData(tasks),
    [tasks],
  );

  return (
    <div className="flex h-full w-full min-h-[260px] flex-col">
      <div className="grid grid-cols-2 gap-y-2 sm:grid-cols-4 sm:gap-y-3">
        {series.map(({ key, label, color, latest }) => (
          <button
            key={key}
            type="button"
            onClick={() => setSelected((prev) => (prev === key ? null : key))}
            className={cn(
              "border-line-neutral-200 flex cursor-pointer flex-row items-center gap-1.5 px-2.5 text-left transition-opacity sm:flex-col sm:items-start sm:gap-1 sm:px-3 sm:first:pl-0 sm:[&:not(:first-child)]:border-l [&:nth-child(even)]:border-l",
              selected !== null && selected !== key && "opacity-40",
            )}
          >
            <div className="text-content-neutral-900 flex items-center gap-1.5 text-xs font-medium">
              <span
                className="size-2 shrink-0 rounded-[2px]"
                style={{ backgroundColor: color }}
              />
              {label}
            </div>
            <span className="text-content-neutral-400 text-xs sm:hidden">
              –
            </span>
            <div className="leading-none">
              <span className="text-content-neutral-900 text-sm font-semibold tracking-tight sm:text-xl tabular-nums">
                {latest}
              </span>
              <span className="text-content-neutral-500 ml-0.5 text-xs font-light sm:ml-1 sm:text-sm">
                h
              </span>
            </div>
          </button>
        ))}
      </div>

      {!hasTrackedHours && (
        <div className="mt-3 px-3 py-1.5 rounded-lg bg-surface-neutral-50 border border-line-neutral-100 text-[11px] text-content-neutral-500 text-center">
          No tasks with recorded active time yet. Move a task to In Progress to track active hours.
        </div>
      )}

      <EChartsAreaChart
        data={chartData}
        config={chartConfig}
        xDataKey="milestone"
        className="mt-3 min-h-[195px] w-full flex-1"
        curveType="linear"
        enableHoverHighlight
        selectedDataKey={selected}
        onSelectionChange={setSelected}
      >
        <EChartsAreaChart.Grid />
        <EChartsAreaChart.XAxis
          dataKey="milestone"
          label="Month"
          tickFormatter={(value) => value.replace("Sprint ", "S")}
        />
        <EChartsAreaChart.YAxis />
        <EChartsAreaChart.Tooltip />
        <EChartsAreaChart.Area
          dataKey="p50"
          variant="gradient"
          strokeVariant="solid"
          isClickable
        />
        <EChartsAreaChart.Area
          dataKey="p75"
          variant="gradient"
          strokeVariant="solid"
          isClickable
        />
        <EChartsAreaChart.Area
          dataKey="p95"
          variant="gradient"
          strokeVariant="solid"
          isClickable
        />
        <EChartsAreaChart.Area
          dataKey="p99"
          variant="gradient"
          strokeVariant="solid"
          isClickable
        />
      </EChartsAreaChart>
    </div>
  );
}
