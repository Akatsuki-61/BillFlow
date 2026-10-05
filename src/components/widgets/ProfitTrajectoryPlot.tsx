"use client";

import { useEffect, useId, useRef, useState } from "react";
import { formatCents } from "@/lib/format";

// Smooth Bezier Curve Path Generator for Financial Charts
function getSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i < points.length - 2 ? points[i + 2] : p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

interface Props {
  months: Array<{ label: string; profitCents: number; marginPct: number }>;
  metric: "profit" | "margin";
  currency: string;
}

export function ProfitTrajectoryPlot({ months, metric, currency }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(540);
  const gradientId = useId();

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const maximum = metric === "profit"
    ? Math.max(0, ...months.map(month => month.profitCents)) || 500000
    : 100;
  const format = (value: number) => metric === "profit" ? formatCents(value, currency) : `${value}%`;
  const ticks = [maximum, maximum / 2, 0];
  // Match SVG coordinates to actual pixels so text and circles never stretch.
  const left = Math.max(64, ...ticks.map(value => format(value).length * 7 + 16));
  const right = width - 24;
  const top = 42;
  const bottom = 140;
  const points = months.map((month, index) => ({
    ...month,
    value: metric === "profit" ? month.profitCents : month.marginPct,
    x: left + (right - left) * (months.length > 1 ? index / (months.length - 1) : 0.5),
    y: bottom - Math.min(1, Math.max(0, (metric === "profit" ? month.profitCents : month.marginPct) / maximum)) * (bottom - top),
  }));
  const line = getSmoothPath(points);
  const last = points.at(-1);
  const tagText = last ? format(last.value) : "";
  const tagWidth = Math.max(64, tagText.length * 7 + 20);
  const tagX = last ? Math.max(tagWidth / 2, Math.min(width - tagWidth / 2, last.x)) : 0;
  const labelStride = Math.max(1, Math.ceil(months.length * 42 / Math.max(1, right - left)));

  return (
    <div className="analytics-creative-canvas-area">
      <div ref={container} className="profit-trajectory-plot">
        <svg viewBox={`0 0 ${width} 184`} role="img" aria-label={`Monthly ${metric === "profit" ? "net profit" : "profit margin"} trajectory`}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--theme-accent)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--theme-accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((value, index) => {
            const y = top + index * (bottom - top) / 2;
            return <g key={index}>
              <line x1={left} y1={y} x2={width - 8} y2={y} className="analytics-grid-line" />
              <text x={left - 12} y={y + 4} textAnchor="end" className="analytics-axis-text">{format(value)}</text>
            </g>;
          })}
          {last && <path d={`${line} L ${last.x} ${bottom} L ${points[0].x} ${bottom} Z`} fill={`url(#${gradientId})`} />}
          {line && <path d={line} className="analytics-spline-path" />}
          {points.map((point, index) => <g key={index}>
            <circle cx={point.x} cy={point.y} r={index === points.length - 1 ? 5 : 4} className="analytics-node-dot">
              <title>{`${point.label} ${metric === "profit" ? "Profit" : "Margin"}: ${format(point.value)}`}</title>
            </circle>
            {(index === points.length - 1 || (index % labelStride === 0 && (points.length - 1 - index) * (right - left) / Math.max(1, points.length - 1) >= 42)) &&
              <text x={point.x} y={168} className={`analytics-month-text ${index === points.length - 1 ? "active" : ""}`}>{point.label.toUpperCase()}</text>}
          </g>)}
          {last && <g transform={`translate(${tagX}, ${last.y - 34})`}>
            <rect x={-tagWidth / 2} width={tagWidth} height={24} rx={6} className="analytics-floating-tag-bg" />
            <text y={16} className="analytics-floating-tag-text">{tagText}</text>
          </g>}
        </svg>
      </div>
    </div>
  );
}
