"use client";

import React, { useMemo } from "react";
import { EChartsLineChart, type ChartConfig } from "@/components/evilcharts/charts/echarts-line-chart";
import { useData } from "@/lib/data/DataProvider";

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
  const { tasks, invoices } = useData();

  const { chartData, hasData } = useMemo(() => {
    const months: Array<{ month: string; key: string; web: number; ai: number }> = [];
    const now = new Date();

    // 6 rolling months
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const month = d.toLocaleString("default", { month: "long" });
      months.push({ month, key, web: 0, ai: 0 });
    }

    let count = 0;

    // Aggregate from tasks
    (tasks || []).forEach((t) => {
      const timeStr = t.completedAt || t.startedAt || t.createdAt;
      if (!timeStr) return;
      const key = timeStr.slice(0, 7);
      const target = months.find((m) => m.key === key);
      if (!target) return;

      const isWeb = t.category === "Development" || /web|software|site|frontend|backend/i.test(t.title);
      const isAi = t.category === "Client Ops" || t.category === "Design" || /ai|consulting|automation|agent/i.test(t.title);

      if (isWeb) {
        target.web += 1;
        count += 1;
      }
      if (isAi) {
        target.ai += 1;
        count += 1;
      }
    });

    // Also factor in non-draft invoices if tasks are not created yet
    (invoices || []).forEach((inv) => {
      if (inv.status === "DRAFT" || !inv.issueDate) return;
      const key = inv.issueDate.slice(0, 7);
      const target = months.find((m) => m.key === key);
      if (!target) return;

      if (inv.items && inv.items.length > 0) {
        inv.items.forEach((item) => {
          const desc = `${item.description || ""}`.toLowerCase();
          const isWeb = /web|software|site|development|frontend|backend/i.test(desc);
          const isAi = /ai|consulting|automation|agent/i.test(desc);
          if (isWeb) {
            target.web += 1;
            count += 1;
          }
          if (isAi) {
            target.ai += 1;
            count += 1;
          }
        });
        return;
      }

      const title = (inv.title || inv.clientName || "").toLowerCase();
      const isWeb = /web|software|site/i.test(title);
      const isAi = /ai|consulting|automation/i.test(title);

      if (isWeb && target.web === 0) {
        target.web += 1;
        count += 1;
      }
      if (isAi && target.ai === 0) {
        target.ai += 1;
        count += 1;
      }
    });

    return {
      chartData: months.map(({ month, web, ai }) => ({ month, web, ai })),
      hasData: count > 0,
    };
  }, [tasks, invoices]);

  return (
    <div className="flex h-full w-full min-h-[300px] flex-col p-4">
      {!hasData && (
        <div className="mb-2 px-3 py-1.5 rounded-lg bg-surface-neutral-50 border border-line-neutral-100 text-[11px] text-content-neutral-500 text-center">
          No service delivery volume recorded. Activity updates as client deliverables and invoices are added.
        </div>
      )}
      <EChartsLineChart
        data={chartData}
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
