"use client";

import React, { useMemo } from "react";
import { EChartsAreaChart, type ChartConfig } from "@/components/evilcharts/charts/echarts-area-chart";
import { useData } from "@/lib/data/DataProvider";

const chartConfig = {
  actual: { label: "Actual", colors: { light: ["#18181b"], dark: ["#f4f4f5"] } },
  target: { label: "Target", colors: { light: ["#a1a1aa"], dark: ["#71717a"] } },
} satisfies ChartConfig;

export function GrowthBenchmarkChart() {
  const { tasks } = useData();

  const { chartData, latestActual, deltaPct, hasTrackedHours } = useMemo(() => {
    const weeklyData: Array<{ date: string; actual: number; target: number }> = [];
    const now = new Date();
    const MS_PER_DAY = 86400000;
    const MS_PER_WEEK = MS_PER_DAY * 7;
    const WEEK_TARGET_HOURS = 40;

    // Generate last 8 weeks
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now.getTime() - (i + 1) * MS_PER_WEEK);
      const weekEnd = new Date(now.getTime() - i * MS_PER_WEEK);

      const label = `${weekEnd.toLocaleString("default", { month: "short" })} ${weekEnd.getDate()}`;

      // Sum task hours within this window
      let weekHours = 0;
      (tasks || []).forEach((t) => {
        const timeStr = t.completedAt || t.startedAt || t.createdAt;
        if (!timeStr) return;
        const taskTime = new Date(timeStr).getTime();
        if (taskTime >= weekStart.getTime() && taskTime <= weekEnd.getTime()) {
          weekHours += (t.activeMilliseconds || 0) / 3600000;
        }
      });

      weeklyData.push({
        date: label,
        actual: Math.round(weekHours * 10) / 10,
        target: WEEK_TARGET_HOURS,
      });
    }

    const latest = weeklyData[weeklyData.length - 1];
    const totalActual = weeklyData.reduce((s, w) => s + w.actual, 0);

    let delta = 0;
    if (latest.target > 0) {
      delta = Math.round(((latest.actual - latest.target) / latest.target) * 100);
    }

    return {
      chartData: weeklyData,
      latestActual: latest.actual,
      deltaPct: delta,
      hasTrackedHours: totalActual > 0,
    };
  }, [tasks]);

  return (
    <div className="flex h-full w-full min-h-[300px] flex-col p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-content-neutral-500 text-xs">Weekly Billable Sprints</span>
          <div className="flex items-baseline gap-2">
            <span className="text-content-neutral-900 text-2xl font-semibold tracking-tight sm:text-3xl">
              {latestActual}h
            </span>
            <span
              className={`text-sm font-medium ${
                hasTrackedHours && deltaPct >= 0
                  ? "text-content-emerald-600"
                  : hasTrackedHours
                    ? "text-content-amber-600"
                    : "text-content-neutral-400"
              }`}
            >
              {hasTrackedHours
                ? `${deltaPct >= 0 ? "+" : ""}${deltaPct}% vs target`
                : "No tracked sprint hours"}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 pt-1">
          <div className="text-content-neutral-600 flex items-center gap-2 text-xs">
            <svg className="text-content-neutral-900" width="18" height="2" viewBox="0 0 18 2" aria-hidden>
              <line x1="0" y1="1" x2="18" y2="1" stroke="currentColor" strokeWidth="2" />
            </svg>
            Actual
          </div>
          <div className="text-content-neutral-500 flex items-center gap-2 text-xs">
            <svg width="18" height="2" viewBox="0 0 18 2" aria-hidden>
              <line
                x1="0"
                y1="1"
                x2="18"
                y2="1"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray="4 3"
              />
            </svg>
            Target (40h/wk)
          </div>
        </div>
      </div>

      <EChartsAreaChart
        data={chartData}
        config={chartConfig}
        xDataKey="date"
        className="mt-4 min-h-[220px] w-full flex-1"
        curveType="smooth"
      >
        <EChartsAreaChart.Grid />
        <EChartsAreaChart.XAxis
          dataKey="date"
        />
        <EChartsAreaChart.YAxis />
        <EChartsAreaChart.Tooltip />
        <EChartsAreaChart.Area dataKey="target" variant="none" strokeVariant="dashed" />
        <EChartsAreaChart.Area dataKey="actual" variant="lines" strokeVariant="solid" />
      </EChartsAreaChart>
    </div>
  );
}
