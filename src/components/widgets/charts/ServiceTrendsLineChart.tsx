"use client";

import React from "react";
import { EChartsLineChart, type ChartConfig } from "@/components/evilcharts/charts/echarts-line-chart";

const data = [
  { month: "January", web: 340, ai: 180 },
  { month: "February", web: 480, ai: 260 },
  { month: "March", web: 510, ai: 290 },
  { month: "April", web: 620, ai: 390 },
  { month: "May", web: 460, ai: 310 },
  { month: "June", web: 780, ai: 450 },
  { month: "July", web: 590, ai: 380 },
  { month: "August", web: 820, ai: 540 },
  { month: "September", web: 650, ai: 420 },
  { month: "October", web: 710, ai: 490 },
  { month: "November", web: 800, ai: 520 },
  { month: "December", web: 890, ai: 580 },
];

const chartConfig = {
  web: {
    label: "Web Development",
    colors: {
      light: ["#059669"],
      dark: ["#10b981"],
    },
  },
  ai: {
    label: "AI Consulting",
    colors: {
      light: ["#7c3aed"],
      dark: ["#8b5cf6"],
    },
  },
} satisfies ChartConfig;

export function ServiceTrendsLineChart() {
  return (
    <div className="flex h-full w-full min-h-[300px] flex-col p-4">
      <EChartsLineChart
        data={data}
        config={chartConfig}
        className="h-full min-h-[240px] w-full"
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
        <EChartsLineChart.Line
          dataKey="web"
          strokeVariant="solid"
          enableBufferLine
          isClickable
        >
          <EChartsLineChart.Dot variant="border" />
          <EChartsLineChart.ActiveDot variant="colored-border" />
        </EChartsLineChart.Line>
        <EChartsLineChart.Line
          dataKey="ai"
          strokeVariant="solid"
          enableBufferLine
          isClickable
        >
          <EChartsLineChart.Dot variant="border" />
          <EChartsLineChart.ActiveDot variant="colored-border" />
        </EChartsLineChart.Line>
      </EChartsLineChart>
    </div>
  );
}
