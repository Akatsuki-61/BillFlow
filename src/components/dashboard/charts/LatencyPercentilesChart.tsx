"use client";

import React, { useState, useMemo } from "react";
import {
  EChartsAreaChart,
  type ChartConfig,
} from "@/components/evilcharts/charts/echarts-area-chart";
import { cn } from "@/lib/utils";
import { useData } from "@/lib/data/DataProvider";
import type { TaskItem } from "@/types/tasks";

function getTaskHours(t: TaskItem): number {
  return Math.round(((t.activeMilliseconds || 0) / 3600000) * 10) / 10;
}

function calcPercentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return (
    Math.round(
      (sorted[Math.max(0, Math.min(sorted.length - 1, idx))] || 0) * 10,
    ) / 10
  );
}

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

  const { series, chartData, hasTrackedHours } = useMemo(() => {
    const now = new Date();
    const getHours = getTaskHours;
    const completed = tasks.filter(
      (task) => task.status === "done" && task.completedAt,
    );
    const allHours = completed.map(getHours);
    const positiveHours = allHours.filter((h) => h > 0);

    const p99 = calcPercentile(positiveHours, 99);
    const p95 = calcPercentile(positiveHours, 95);
    const p75 = calcPercentile(positiveHours, 75);
    const p50 = calcPercentile(positiveHours, 50);

    const seriesData = [
      { key: "p99", label: "P99 active time", color: "#D41F12", latest: p99 },
      { key: "p95", label: "P95 active time", color: "#F37A00", latest: p95 },
      { key: "p75", label: "P75 active time", color: "#62C9D4", latest: p75 },
      { key: "p50", label: "P50 active time", color: "#007292", latest: p50 },
    ] as const;

    // Build 6 monthly/sprint milestone buckets
    const milestones: Array<{
      milestone: string;
      key: string;
      p99: number;
      p95: number;
      p75: number;
      p50: number;
    }> = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const sprintLabel = d.toLocaleDateString("en", { month: "short" });

      const bucketTasks = completed.filter((t) => {
        const dateStr = t.completedAt;
        return dateStr && dateStr.startsWith(key);
      });

      const bucketHours = bucketTasks.map(getHours).filter((h) => h > 0);

      milestones.push({
        milestone: sprintLabel,
        key,
        p99: calcPercentile(bucketHours, 99),
        p95: calcPercentile(bucketHours, 95),
        p75: calcPercentile(bucketHours, 75),
        p50: calcPercentile(bucketHours, 50),
      });
    }

    return {
      series: seriesData,
      chartData: milestones,
      hasTrackedHours: positiveHours.length > 0,
    };
  }, [tasks]);

  return (
    <div className="flex h-full w-full min-h-[300px] flex-col p-4">
      <div className="grid grid-cols-2 gap-y-2 sm:grid-cols-4 sm:gap-y-4">
        {series.map(({ key, label, color, latest }) => (
          <button
            key={key}
            type="button"
            onClick={() => setSelected((prev) => (prev === key ? null : key))}
            className={cn(
              "border-line-neutral-200 flex cursor-pointer flex-row items-center gap-1.5 px-3 text-left transition-opacity sm:flex-col sm:items-start sm:gap-1.5 sm:px-4 sm:first:pl-1 sm:[&:not(:first-child)]:border-l [&:nth-child(even)]:border-l",
              selected !== null && selected !== key && "opacity-40",
            )}
          >
            <div className="text-content-neutral-900 flex items-center gap-1.5 text-xs font-medium sm:gap-2">
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
              <span className="text-content-neutral-900 text-sm font-semibold tracking-tight sm:text-xl">
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
          No completed tasks with recorded active time yet. Shows recorded In
          progress time for completed tasks; waiting time is excluded.
        </div>
      )}

      <EChartsAreaChart
        data={chartData}
        config={chartConfig}
        xDataKey="milestone"
        className="mt-4 min-h-[220px] w-full flex-1"
        curveType="linear"
        enableHoverHighlight
        selectedDataKey={selected}
        onSelectionChange={setSelected}
      >
        <EChartsAreaChart.Grid />
        <EChartsAreaChart.XAxis
          dataKey="milestone"
          label="Completion month"
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
