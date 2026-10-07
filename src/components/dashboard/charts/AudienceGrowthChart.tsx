"use client";

import React, { useMemo } from "react";
import { EChartsAreaChart, type ChartConfig } from "@/components/evilcharts/charts/echarts-area-chart";
import { useData, useActiveCurrency } from "@/lib/data/DataProvider";
import { formatCents } from "@/lib/format";

const chartConfig = {
  collections: {
    label: "Collected Revenue",
    colors: {
      light: ["#10b981", "#0ea5e9", "#8b5cf6"],
      dark: ["#34d399", "#38bdf8", "#a78bfa"],
    },
  },
} satisfies ChartConfig;

export function AudienceGrowthChart() {
  const { invoices } = useData();
  const { activeCurrency } = useActiveCurrency();

  const { chartData, totalCollectedCents } = useMemo(() => {
    const months: Array<{ month: string; key: string; collections: number }> = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const month = d.toLocaleString("default", { month: "short" });
      months.push({ month, key, collections: 0 });
    }

    let total = 0;
    (invoices || []).forEach((inv) => {
      if (inv.status === "DRAFT") return;
      const collected = inv.paidCents ?? (inv.status === "PAID" ? inv.amountCents : 0);
      total += collected;

      if (!inv.issueDate) return;
      const invKey = inv.issueDate.slice(0, 7);
      const target = months.find((m) => m.key === invKey);
      if (target) {
        target.collections += Math.round(collected / 100);
      }
    });

    return {
      chartData: months.map(({ month, collections }) => ({ month, collections })),
      totalCollectedCents: total,
    };
  }, [invoices]);

  const hasData = totalCollectedCents > 0;

  return (
    <div className="flex h-full w-full min-h-[300px] flex-col">
      <div className="flex items-start justify-between gap-4 px-4 pt-4">
        <div className="flex flex-col gap-1">
          <span className="text-content-neutral-900 text-base font-semibold tracking-tight sm:text-lg">
            Delivered Solutions Value
          </span>
          <span className="text-content-neutral-500 max-w-[32ch] text-xs leading-snug">
            {hasData
              ? "Realized cash collections across delivered client projects"
              : "No client collections recorded in this period"}
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-content-neutral-900 text-2xl font-semibold tracking-tight sm:text-3xl">
            {formatCents(totalCollectedCents, activeCurrency)}
          </span>
          <span className="text-content-neutral-500 text-xs">Total Realized</span>
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
            dataKey="collections"
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
