"use client";

import React from "react";
import { EChartsBarChart, type ChartConfig } from "@/components/evilcharts/charts/echarts-bar-chart";

const data = [
  { month: "January", web: 342, ai: 184 },
  { month: "February", web: 486, ai: 291 },
  { month: "March", web: 512, ai: 290 },
  { month: "April", web: 629, ai: 391 },
  { month: "May", web: 458, ai: 309 },
  { month: "June", web: 781, ai: 449 },
  { month: "July", web: 394, ai: 234 },
  { month: "August", web: 825, ai: 517 },
  { month: "September", web: 647, ai: 367 },
  { month: "October", web: 532, ai: 357 },
  { month: "November", web: 803, ai: 515 },
  { month: "December", web: 871, ai: 549 },
];

const chartConfig = {
  web: {
    label: "Web Deliverables",
    colors: {
      light: ["#0284c7"],
      dark: ["#38bdf8"],
    },
  },
  ai: {
    label: "AI Solutions",
    colors: {
      light: ["#e11d48"],
      dark: ["#fb7185"],
    },
  },
} satisfies ChartConfig;

export function ItemizedVolumeBarChart() {
  return (
    <div className="flex h-full w-full min-h-[300px] flex-col p-4">
      <EChartsBarChart
        data={data}
        config={chartConfig}
        className="h-full min-h-[240px] w-full"
        xDataKey="month"
      >
        <EChartsBarChart.Grid />
        <EChartsBarChart.XAxis
          dataKey="month"
          tickFormatter={(value) => value.substring(0, 3)}
        />
        <EChartsBarChart.YAxis />
        <EChartsBarChart.Brush formatLabel={(value) => String(value).substring(0, 3)} />
        <EChartsBarChart.Legend isClickable />
        <EChartsBarChart.Tooltip />
        <EChartsBarChart.Bar dataKey="web" variant="default" isClickable />
        <EChartsBarChart.Bar dataKey="ai" variant="default" isClickable />
      </EChartsBarChart>
    </div>
  );
}
