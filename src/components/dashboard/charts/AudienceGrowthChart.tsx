"use client";

import React from "react";
import { EChartsAreaChart, type ChartConfig } from "@/components/evilcharts/charts/echarts-area-chart";

const chartData = [
  { month: "Jan", users: 2980 },
  { month: "Feb", users: 3120 },
  { month: "Mar", users: 3460 },
  { month: "Apr", users: 3380 },
  { month: "May", users: 3720 },
  { month: "Jun", users: 4180 },
  { month: "Jul", users: 4560 },
];

const chartConfig = {
  users: {
    label: "Active Users",
    colors: {
      light: ["#10b981", "#0ea5e9", "#8b5cf6"],
      dark: ["#34d399", "#38bdf8", "#a78bfa"],
    },
  },
} satisfies ChartConfig;

const TOTAL = chartData.reduce((sum, { users }) => sum + users, 0);

export function AudienceGrowthChart() {
  return (
    <div className="flex h-full w-full min-h-[300px] flex-col">
      <div className="flex items-start justify-between gap-4 px-4 pt-4">
        <div className="flex flex-col gap-1">
          <span className="text-content-neutral-900 text-base font-semibold tracking-tight sm:text-lg">
            Client Platform Reach
          </span>
          <span className="text-content-neutral-500 max-w-[28ch] text-xs leading-snug">
            Monthly active users across delivered web solutions
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-content-neutral-900 text-2xl font-semibold tracking-tight sm:text-3xl">
            {TOTAL.toLocaleString("en-US")}
          </span>
          <span className="text-content-neutral-500 text-xs">Total Interactions</span>
        </div>
      </div>

      <div className="relative mt-2 min-h-[220px] w-full flex-1">
        <EChartsAreaChart
          data={chartData}
          config={chartConfig}
          xDataKey="month"
          className="h-full w-full"
          curveType="monotone"
          chartOptions={{
            grid: { left: 8, right: 8, top: 16, bottom: 28, outerBoundsMode: "none" },
            yAxis: { type: "value", show: false, scale: true, boundaryGap: ["16%", "20%"] },
          }}
        >
          <EChartsAreaChart.Tooltip variant="frosted-glass" />
          <EChartsAreaChart.Area
            dataKey="users"
            variant="gradient"
            strokeVariant="solid"
            strokeWidth={2.5}
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
