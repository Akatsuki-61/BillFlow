"use client";

import React from "react";
import { EChartsAreaChart, type ChartConfig } from "@/components/evilcharts/charts/echarts-area-chart";

const SERIES = [
  { key: "web", label: "Web & Custom Software", color: "#2563eb", pct: 14.2, delta: 4250.00 },
  { key: "ai", label: "AI Consulting Retainers", color: "#10b981", pct: 28.6, delta: 6800.00 },
] as const;

const chartData = [
  { date: "Oct 01", web: 48200, ai: 42100 },
  { date: "Oct 02", web: 48900, ai: 42600 },
  { date: "Oct 03", web: 49400, ai: 43200 },
  { date: "Oct 04", web: 50100, ai: 43900 },
  { date: "Oct 05", web: 50600, ai: 44500 },
  { date: "Oct 06", web: 51200, ai: 45200 },
  { date: "Oct 07", web: 51800, ai: 46000 },
  { date: "Oct 08", web: 52100, ai: 46800 },
  { date: "Oct 09", web: 52400, ai: 47600 },
  { date: "Oct 10", web: 52800, ai: 48300 },
  { date: "Oct 11", web: 53100, ai: 49100 },
  { date: "Oct 12", web: 53500, ai: 49900 },
  { date: "Oct 13", web: 53900, ai: 50700 },
  { date: "Oct 14", web: 54200, ai: 51400 },
  { date: "Oct 15", web: 54600, ai: 52100 },
  { date: "Oct 16", web: 55100, ai: 52900 },
  { date: "Oct 17", web: 55600, ai: 53700 },
  { date: "Oct 18", web: 56000, ai: 54400 },
  { date: "Oct 19", web: 56300, ai: 55000 },
  { date: "Oct 20", web: 56700, ai: 55800 },
  { date: "Oct 21", web: 57100, ai: 56500 },
  { date: "Oct 22", web: 57400, ai: 57100 },
  { date: "Oct 23", web: 57800, ai: 57800 },
  { date: "Oct 24", web: 58100, ai: 58500 },
  { date: "Oct 25", web: 58450, ai: 58900 },
];

const chartConfig = {
  web: { label: "Web & Custom Software", colors: { light: ["#2563eb"], dark: ["#3b82f6"] } },
  ai: { label: "AI Consulting Retainers", colors: { light: ["#059669"], dark: ["#10b981"] } },
} satisfies ChartConfig;

const formatDelta = (value: number) =>
  Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function PortfolioComparisonChart() {
  return (
    <div className="flex h-full w-full min-h-[300px] flex-col pt-4">
      <div className="grid grid-cols-2 gap-x-8 px-4">
        {SERIES.map(({ key, label, color, pct, delta }) => (
          <div key={key} className="flex flex-col gap-1">
            <div className="text-content-neutral-500 flex items-center gap-2 text-xs">
              <span
                className="size-2.5 shrink-0 rounded-full border-2"
                style={{ borderColor: color }}
              />
              {label}
            </div>
            <div className="text-content-neutral-900 text-xl font-semibold tracking-tight sm:text-2xl">
              {pct > 0 ? "+" : "−"}
              {Math.abs(pct).toFixed(1)}%
            </div>
            <div className={`text-xs font-medium ${delta < 0 ? "text-content-rose-600" : "text-content-emerald-600"}`}>
              {delta < 0 ? "−" : "+"}${formatDelta(delta)}
            </div>
          </div>
        ))}
      </div>

      <EChartsAreaChart
        data={chartData}
        config={chartConfig}
        xDataKey="date"
        className="mt-4 min-h-[200px] w-full flex-1"
        curveType="step"
        enableHoverReveal
        chartOptions={{
          grid: { left: 8, right: 8, top: 16, bottom: 8 },
          yAxis: { type: "value", show: false, scale: true, boundaryGap: ["12%", "16%"] },
        }}
      >
        <EChartsAreaChart.Tooltip variant="frosted-glass" />
        <EChartsAreaChart.Area dataKey="web" variant="dotted" strokeVariant="solid">
          <EChartsAreaChart.ActiveDot variant="ping" />
        </EChartsAreaChart.Area>
        <EChartsAreaChart.Area dataKey="ai" variant="dotted" strokeVariant="solid">
          <EChartsAreaChart.ActiveDot variant="ping" />
        </EChartsAreaChart.Area>
      </EChartsAreaChart>
    </div>
  );
}
