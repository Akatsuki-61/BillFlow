"use client";

import React, { useState } from "react";
import { EChartsAreaChart, type ChartConfig } from "@/components/evilcharts/charts/echarts-area-chart";
import { cn } from "@/lib/utils";

const SERIES = [
  { key: "p99", label: "P99 Custom Software", color: "#D41F12", latest: 192 },
  { key: "p95", label: "P95 AI Integrations", color: "#F37A00", latest: 96 },
  { key: "p75", label: "P75 Full-Stack Web", color: "#62C9D4", latest: 48 },
  { key: "p50", label: "P50 Consulting Sprints", color: "#007292", latest: 18 },
] as const;

const chartData = [
  { milestone: "Sprint 01", p99: 184, p95: 92, p75: 44, p50: 18 },
  { milestone: "Sprint 02", p99: 188, p95: 94, p75: 46, p50: 19 },
  { milestone: "Sprint 03", p99: 176, p95: 88, p75: 42, p50: 17 },
  { milestone: "Sprint 04", p99: 192, p95: 95, p75: 47, p50: 19 },
  { milestone: "Sprint 05", p99: 204, p95: 98, p75: 48, p50: 20 },
  { milestone: "Sprint 06", p99: 185, p95: 90, p75: 45, p50: 18 },
  { milestone: "Sprint 07", p99: 178, p95: 87, p75: 43, p50: 17 },
  { milestone: "Sprint 08", p99: 195, p95: 96, p75: 47, p50: 19 },
  { milestone: "Sprint 09", p99: 208, p95: 102, p75: 49, p50: 20 },
  { milestone: "Sprint 10", p99: 194, p95: 93, p75: 46, p50: 18 },
  { milestone: "Sprint 11", p99: 201, p95: 97, p75: 48, p50: 19 },
  { milestone: "Sprint 12", p99: 215, p95: 104, p75: 50, p50: 21 },
  { milestone: "Sprint 13", p99: 228, p95: 110, p75: 52, p50: 21 },
  { milestone: "Sprint 14", p99: 245, p95: 118, p75: 54, p50: 22 },
  { milestone: "Sprint 15", p99: 232, p95: 112, p75: 53, p50: 21 },
  { milestone: "Sprint 16", p99: 218, p95: 106, p75: 51, p50: 20 },
  { milestone: "Sprint 17", p99: 205, p95: 100, p75: 49, p50: 20 },
  { milestone: "Sprint 18", p99: 198, p95: 97, p75: 47, p50: 19 },
  { milestone: "Sprint 19", p99: 190, p95: 93, p75: 45, p50: 18 },
  { milestone: "Sprint 20", p99: 196, p95: 96, p75: 46, p50: 19 },
  { milestone: "Sprint 21", p99: 202, p95: 99, p75: 48, p50: 19 },
  { milestone: "Sprint 22", p99: 189, p95: 92, p75: 45, p50: 18 },
  { milestone: "Sprint 23", p99: 185, p95: 90, p75: 44, p50: 17 },
  { milestone: "Sprint 24", p99: 192, p95: 96, p75: 48, p50: 18 },
];

const chartConfig = {
  p99: { label: "P99 Custom Software", colors: { light: ["#f87171"], dark: ["#D41F12"] } },
  p95: { label: "P95 AI Integrations", colors: { light: ["#fbbf24"], dark: ["#F37A00"] } },
  p75: { label: "P75 Full-Stack Web", colors: { light: ["#60a5fa"], dark: ["#62C9D4"] } },
  p50: { label: "P50 Consulting Sprints", colors: { light: ["#93c5fd"], dark: ["#007292"] } },
} satisfies ChartConfig;

export function LatencyPercentilesChart() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="flex h-full w-full min-h-[300px] flex-col p-4">
      <div className="grid grid-cols-2 gap-y-2 sm:grid-cols-4 sm:gap-y-4">
        {SERIES.map(({ key, label, color, latest }) => (
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
              <span className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: color }} />
              {label}
            </div>
            <span className="text-content-neutral-400 text-xs sm:hidden">–</span>
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
          label="Milestone Sprints"
          tickFormatter={(value) => value.replace("Sprint ", "S")}
        />
        <EChartsAreaChart.YAxis />
        <EChartsAreaChart.Tooltip />
        <EChartsAreaChart.Area dataKey="p50" variant="gradient" strokeVariant="solid" isClickable />
        <EChartsAreaChart.Area dataKey="p75" variant="gradient" strokeVariant="solid" isClickable />
        <EChartsAreaChart.Area dataKey="p95" variant="gradient" strokeVariant="solid" isClickable />
        <EChartsAreaChart.Area dataKey="p99" variant="gradient" strokeVariant="solid" isClickable />
      </EChartsAreaChart>
    </div>
  );
}
