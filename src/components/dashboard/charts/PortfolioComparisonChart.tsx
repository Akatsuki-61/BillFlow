"use client";

import React, { useMemo } from "react";
import { EChartsAreaChart, type ChartConfig } from "@/components/evilcharts/charts/echarts-area-chart";
import { useData, useActiveCurrency } from "@/lib/data/DataProvider";
import { formatCents } from "@/lib/format";

const chartConfig = {
  web: { label: "Web & Custom Software", colors: { light: ["#2563eb"], dark: ["#3b82f6"] } },
  ai: { label: "AI Consulting Retainers", colors: { light: ["#059669"], dark: ["#10b981"] } },
} satisfies ChartConfig;

export function PortfolioComparisonChart() {
  const { invoices } = useData();
  const { activeCurrency } = useActiveCurrency();

  const { series, chartData, hasInvoices } = useMemo(() => {
    let totalWebCents = 0;
    let totalAiCents = 0;
    const validInvoices = (invoices || []).filter((inv) => inv.status !== "DRAFT");

    validInvoices.forEach((inv) => {
      const text = `${inv.title || ""} ${inv.notes || ""} ${inv.clientName || ""}`.toLowerCase();
      const isAi = /ai|consulting|automation|agent/i.test(text);
      if (isAi) {
        totalAiCents += inv.amountCents;
      } else {
        totalWebCents += inv.amountCents;
      }
    });

    const totalPortfolioCents = totalWebCents + totalAiCents;
    const webPct = totalPortfolioCents > 0 ? Math.round((totalWebCents / totalPortfolioCents) * 100) : 0;
    const aiPct = totalPortfolioCents > 0 ? Math.round((totalAiCents / totalPortfolioCents) * 100) : 0;

    const seriesData = [
      {
        key: "web",
        label: "Web & Custom Software",
        color: "#2563eb",
        pct: webPct,
        formattedTotal: formatCents(totalWebCents, activeCurrency),
      },
      {
        key: "ai",
        label: "AI Consulting Retainers",
        color: "#10b981",
        pct: aiPct,
        formattedTotal: formatCents(totalAiCents, activeCurrency),
      },
    ] as const;

    // 14-day timeline
    const days: Array<{ date: string; key: string; web: number; ai: number }> = [];
    const now = new Date();
    const MS_PER_DAY = 86400000;

    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * MS_PER_DAY);
      const key = d.toISOString().split("T")[0];
      const dateLabel = `${d.toLocaleString("default", { month: "short" })} ${String(d.getDate()).padStart(2, "0")}`;
      days.push({ date: dateLabel, key, web: 0, ai: 0 });
    }

    validInvoices.forEach((inv) => {
      if (!inv.issueDate) return;
      const invDate = inv.issueDate.split("T")[0];
      const target = days.find((d) => d.key === invDate);
      if (!target) return;

      const text = `${inv.title || ""} ${inv.notes || ""} ${inv.clientName || ""}`.toLowerCase();
      const isAi = /ai|consulting|automation|agent/i.test(text);
      const amtMajor = Math.round(inv.amountCents / 100);

      if (isAi) {
        target.ai += amtMajor;
      } else {
        target.web += amtMajor;
      }
    });

    return {
      series: seriesData,
      chartData: days.map(({ date, web, ai }) => ({ date, web, ai })),
      hasInvoices: validInvoices.length > 0,
    };
  }, [invoices, activeCurrency]);

  return (
    <div className="flex h-full w-full min-h-[300px] flex-col pt-4">
      <div className="grid grid-cols-2 gap-x-8 px-4">
        {series.map(({ key, label, color, pct, formattedTotal }) => (
          <div key={key} className="flex flex-col gap-1">
            <div className="text-content-neutral-500 flex items-center gap-2 text-xs">
              <span
                className="size-2.5 shrink-0 rounded-full border-2"
                style={{ borderColor: color }}
              />
              {label}
            </div>
            <div className="text-content-neutral-900 text-xl font-semibold tracking-tight sm:text-2xl">
              {pct}%
            </div>
            <div className="text-xs font-medium text-content-neutral-600">
              {formattedTotal}
            </div>
          </div>
        ))}
      </div>

      {!hasInvoices && (
        <div className="mt-2 mx-4 px-3 py-1.5 rounded-lg bg-surface-neutral-50 border border-line-neutral-100 text-[11px] text-content-neutral-500 text-center">
          No service invoices recorded. Portfolio breakdown calculates from active client invoices.
        </div>
      )}

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
