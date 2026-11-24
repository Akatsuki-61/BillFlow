"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Sparkles,
} from "lucide-react";
import { useAiCapture } from "@/context/AiCaptureContext";
import { formatCents, getCurrencySymbol } from "@/lib/format";
import { sharePercent } from "@/lib/visual-metrics";
import type { Currency } from "@/types/billing";
import type {
  DashboardPipelineStage,
  DotMatrixBucket,
  SteppedRetentionPoint,
} from "./DashboardMetricsContext";

const compactFmt = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatCompactMoney(cents: number, currency: Currency): string {
  const sym = getCurrencySymbol(currency);
  const abs = Math.abs(cents) / 100;
  const sign = cents < 0 ? "-" : "";
  if (abs >= 1000) return `${sign}${sym}${compactFmt.format(abs)}`;
  return formatCents(cents, currency).replace(/\.00$/, "");
}

function formatWholeMoney(cents: number, currency: Currency): string {
  return formatCents(cents, currency).replace(/\.00$/, "");
}

/* ==========================================================================
   Standardized Circular "..." Card Overflow Menu (matches all 5 screenshots)
   ========================================================================== */
export interface CardMenuAction {
  label: string;
  onClick: () => void;
  tone?: "default" | "danger";
}

export function CardMenuButton({
  label = "Card options",
  actions,
}: {
  label?: string;
  actions: CardMenuAction[];
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className="zentra-circle-btn zentra-circle-btn--sm"
      >
        <MoreHorizontal className="w-4 h-4" strokeWidth={1.7} />
      </button>

      {open && (
        <div
          role="menu"
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 mt-1.5 w-44 rounded-[16px] bg-[var(--ui-surface-pure)] border border-[var(--ui-border)] shadow-[0_14px_32px_-8px_rgba(0,0,0,0.18)] dark:shadow-[0_18px_40px_-8px_rgba(0,0,0,0.65)] p-1.5 z-40"
        >
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                action.onClick();
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-[10px] text-[12.5px] font-medium text-left transition-colors cursor-pointer ${
                action.tone === "danger"
                  ? "text-content-rose-600 hover:bg-surface-rose-50"
                  : "text-content-neutral-800 hover:bg-surface-neutral-100"
              }`}
            >
              <span>{action.label}</span>
              <ArrowUpRight className="w-3.5 h-3.5 opacity-55" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   Widget 1: Payments 5-Stage Sloped Hatched Funnel + Frosted AI Capture Dock
   Reference: payment timeline widget.png & top left closeup
   ========================================================================== */
const AI_SLASH_COMMANDS = [
  { tag: "/smart-capture", prompt: "Extract client message into invoice or tasks", action: "capture" },
  { tag: "/overdue", prompt: "Inspect overdue balances and aging breakdown", action: "/invoices?view=overdue-summary" },
  { tag: "/new-invoice", prompt: "Create a new itemized client invoice", action: "/invoices?new=1" },
  { tag: "/tasks", prompt: "Review active sprint deliverables on Kanban", action: "/tasks" },
] as const;

export function PaymentsFunnelCard({
  stages,
  currency,
  isCompact = false,
  onOpenInvoices,
  onRemove,
}: {
  stages: DashboardPipelineStage[];
  currency: Currency;
  isCompact?: boolean;
  onOpenInvoices: () => void;
  onRemove?: () => void;
}) {
  const router = useRouter();
  const { openDrawer } = useAiCapture();
  const uid = useId().replaceAll(":", "");

  const [activeIdx, setActiveIdx] = useState<number>(Math.min(2, Math.max(0, stages.length - 1)));
  const [dockExpanded, setDockExpanded] = useState(true);
  const [selectedCmdIdx, setSelectedCmdIdx] = useState(0);
  const [queryText, setQueryText] = useState("Turn a WhatsApp brief or screenshot into");

  const safeActiveIdx = Math.min(activeIdx, Math.max(0, stages.length - 1));
  const activeStage = stages[safeActiveIdx];
  const rawMaxStage = Math.max(...stages.map((s) => Math.abs(s.value)), 0);
  const maxStageValue = rawMaxStage > 0 ? rawMaxStage : 0;
  const yTicks =
    maxStageValue > 0
      ? [1, 0.75, 0.5, 0.25].map((f) =>
          formatCompactMoney(Math.round(maxStageValue * f), currency),
        )
      : ["", "", "", formatCompactMoney(0, currency)];

  // SVG coordinate system for 5 equal-width stages with sloped trapezoid connectors
  const svgW = 800;
  const svgH = 200;
  const colW = svgW / Math.max(1, stages.length);
  const barGap = 24;
  const barW = colW - barGap;
  const barBaseY = svgH;
  const maxBarH = 166;

  const barRects = stages.map((stage, i) => {
    const h = Math.max(24, (stage.heightPct / 100) * maxBarH);
    const x = i * colW + barGap / 2;
    const y = barBaseY - h;
    return { x, y, w: barW, h };
  });

  const activeCmd = AI_SLASH_COMMANDS[selectedCmdIdx];

  const handleDockSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const lower = queryText.trim().toLowerCase();
    if (lower.includes("overdue") || activeCmd.action === "/invoices?view=overdue-summary") {
      router.push("/invoices?view=overdue-summary");
      return;
    }
    if (lower.includes("task") || lower.includes("kanban") || activeCmd.action === "/tasks") {
      router.push("/tasks");
      return;
    }
    if (lower.includes("expense") || lower.includes("cost")) {
      router.push("/expenses");
      return;
    }
    if (activeCmd.action === "/invoices?new=1") {
      router.push("/invoices?new=1");
      return;
    }
    openDrawer();
  };

  return (
    <div className="ui-card relative flex flex-col justify-between h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <h3>Payments</h3>
        <CardMenuButton
          label="Payments options"
          actions={[
            { label: "Open Invoices", onClick: onOpenInvoices },
            { label: "Open Smart Capture", onClick: openDrawer },
            { label: "View Analytics", onClick: () => router.push("/analytics") },
            ...(onRemove ? [{ label: "Hide widget", onClick: onRemove, tone: "danger" as const }] : []),
          ]}
        />
      </div>

      {/* 5-Stage Interactive Funnel Area */}
      <div className="relative flex-1 min-h-[214px] flex flex-col justify-end">
        <div className="relative grid grid-cols-12 flex-1">
          {/* Left Y-Axis Scale */}
          <div className="col-span-1 hidden sm:flex flex-col justify-between pt-14 pb-9 pr-2 text-right text-[11px] font-normal text-content-neutral-400 tabular-nums select-none">
            {yTicks.map((tick, idx) => (
              <span key={idx}>{tick || "\u00A0"}</span>
            ))}
          </div>

          {/* 5 Columns + Unified SVG Sloped Hatched Funnel */}
          <div className="col-span-12 sm:col-span-11 relative flex flex-col justify-between">
            {/* Background Vertical Dividers & Column Headers */}
            <div className="grid grid-cols-5 relative z-10 flex-1">
              {stages.map((stage, idx) => {
                const isSelected = idx === safeActiveIdx;
                return (
                  <button
                    key={stage.label}
                    type="button"
                    onMouseEnter={() => setActiveIdx(idx)}
                    onFocus={() => setActiveIdx(idx)}
                    onClick={() => router.push(stage.href)}
                    className={`relative flex flex-col items-start text-left px-3 pt-1 pb-2 border-l border-[var(--ui-border-hairline)] cursor-pointer transition-colors outline-none ${
                      isSelected ? "pipeline-stage-active" : "hover:bg-black/[0.015] dark:hover:bg-white/[0.015]"
                    }`}
                  >
                    <span
                      className={`text-[11.5px] font-medium leading-tight truncate w-full transition-colors ${
                        isSelected
                          ? "text-content-neutral-950"
                          : "text-content-neutral-400"
                      }`}
                    >
                      {stage.label}
                    </span>
                    <span
                      className={`mt-1 text-[20px] xl:text-[23px] font-normal tracking-[-0.03em] tabular-nums leading-none truncate w-full transition-colors ${
                        isSelected
                          ? "text-content-neutral-950"
                          : "text-content-neutral-400"
                      }`}
                    >
                      {formatCompactMoney(stage.value, currency)}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Sloped Hatched Bars + Translucent Connectors SVG */}
            <div className="relative w-full h-[156px] -mt-[100px] pointer-events-none select-none">
              <svg
                viewBox={`0 0 ${svgW} ${svgH}`}
                preserveAspectRatio="none"
                className="w-full h-full overflow-visible"
                aria-hidden="true"
              >
                <defs>
                  {/* Vertical fade gradient for hatched blue funnel bars */}
                  <linearGradient id={`funnelFade-${uid}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--data-blue)" stopOpacity="0.96" />
                    <stop offset="68%" stopColor="var(--data-blue)" stopOpacity="0.46" />
                    <stop offset="100%" stopColor="var(--data-blue)" stopOpacity="0.12" />
                  </linearGradient>

                  {/* Solid rich vertical cobalt-to-azure gradient for active/hovered bar */}
                  <linearGradient id={`funnelActive-${uid}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--data-blue-deep)" />
                    <stop offset="62%" stopColor="var(--data-blue)" />
                    <stop offset="100%" stopColor="#63a8ff" />
                  </linearGradient>

                  {/* Sloped trapezoid connector gradient */}
                  <linearGradient id={`funnelSlope-${uid}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--data-blue)" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="var(--data-blue)" stopOpacity="0.03" />
                  </linearGradient>

                  {/* Crisp 45-deg upward-right diagonal white hatch overlay */}
                  <pattern
                    id={`funnelHatch-${uid}`}
                    width="9"
                    height="9"
                    patternUnits="userSpaceOnUse"
                    patternTransform="rotate(45)"
                  >
                    <line
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="9"
                      stroke="#ffffff"
                      strokeWidth="2.4"
                      strokeOpacity="0.42"
                    />
                  </pattern>

                  {/* 3D Glossy Floating Sky-Blue Cap Pill Gradient */}
                  <linearGradient id={`capGrad-${uid}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#b8dcff" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>

                {/* Sloped Trapezoid Connectors bridging bar i -> bar i+1 */}
                {barRects.slice(0, -1).map((curr, i) => {
                  const next = barRects[i + 1];
                  const points = `${curr.x + curr.w},${curr.y} ${next.x},${next.y} ${next.x},${barBaseY} ${curr.x + curr.w},${barBaseY}`;
                  return (
                    <polygon
                      key={`slope-${i}`}
                      points={points}
                      fill={`url(#funnelSlope-${uid})`}
                    />
                  );
                })}

                {/* Stage Bars + Hatching + Floating 3D Cap Pills */}
                {barRects.map((rect, i) => {
                  const isSelected = i === safeActiveIdx;
                  const capW = 30;
                  const capH = 5.5;
                  const capX = rect.x + (rect.w - capW) / 2;
                  const capY = Math.max(4, rect.y - 11);

                  return (
                    <g key={`bar-${i}`}>
                      <rect
                        x={rect.x}
                        y={rect.y}
                        width={rect.w}
                        height={rect.h}
                        rx="2"
                        fill={
                          isSelected
                            ? `url(#funnelActive-${uid})`
                            : `url(#funnelFade-${uid})`
                        }
                      />
                      {!isSelected && (
                        <>
                          <rect
                            x={rect.x}
                            y={rect.y}
                            width={rect.w}
                            height={rect.h}
                            rx="2"
                            fill={`url(#funnelHatch-${uid})`}
                          />
                          <rect
                            x={capX}
                            y={capY}
                            width={capW}
                            height={capH}
                            rx="3"
                            fill={`url(#capGrad-${uid})`}
                          />
                        </>
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* Floating Glass Pill Tooltip anchored above the active stage */}
              {activeStage && (
                <div
                  className="absolute z-20 pointer-events-none transition-all duration-200"
                  style={{
                    left: `${Math.min(72, Math.max(18, (safeActiveIdx + 0.5) * 20))}%`,
                    top: `${Math.max(10, Math.min(54, (1 - activeStage.heightPct / 100) * 62))}%`,
                    transform: "translate(-50%, -85%)",
                  }}
                >
                  <div className="zentra-pill-badge !py-1.5 !px-3.5 !text-[11.5px] backdrop-blur-md">
                    <strong className="font-semibold text-content-neutral-950 tabular-nums">
                      {formatCompactMoney(activeStage.value, currency)}
                    </strong>
                    <span className="text-content-neutral-300">|</span>
                    <span className="text-content-neutral-500">
                      Share:{" "}
                      <strong className="font-semibold text-content-neutral-900">
                        {activeStage.conversionPct}%
                      </strong>
                    </span>
                    {maxStageValue > 0 && safeActiveIdx > 0 && activeStage.dropOffPct > 0 && (
                      <>
                        <span className="text-content-neutral-300">|</span>
                        <span className="text-content-neutral-500">
                          Gap:{" "}
                          <strong className="font-semibold text-content-neutral-900">
                            -{activeStage.dropOffPct}%
                          </strong>
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Embedded Frosted-Glass AI & Smart Capture Dock (overlapping bottom of bars) */}
        {!isCompact && (
          <div className="zentra-ai-dock relative z-20 -mt-6">
            <div className="flex items-center justify-between gap-2 px-1 pb-1.5">
              <div className="flex items-center gap-2 text-[12.5px] font-medium text-content-neutral-700 dark:text-content-neutral-200">
                <Sparkles className="w-3.5 h-3.5 text-accent" strokeWidth={2} />
                <span>What would you like to explore next?</span>
              </div>
              <button
                type="button"
                onClick={() => setDockExpanded((v) => !v)}
                aria-label={dockExpanded ? "Collapse AI bar" : "Expand AI bar"}
                className="p-1 rounded-full text-content-neutral-600 hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
              >
                {dockExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {dockExpanded && (
              <form onSubmit={handleDockSubmit} className="zentra-ai-dock-input-wrap">
                <input
                  type="text"
                  aria-label="Explore finances or trigger Smart Capture"
                  value={queryText}
                  onChange={(e) => setQueryText(e.target.value)}
                  placeholder="Ask or capture a client brief…"
                  className="min-w-0 flex-1 bg-transparent border-0 outline-none text-[13px] text-content-neutral-900 placeholder:text-content-neutral-400"
                />
                <button
                  type="button"
                  onClick={() =>
                    setSelectedCmdIdx((prev) => (prev + 1) % AI_SLASH_COMMANDS.length)
                  }
                  title="Click to cycle quick workspace command"
                  className="zentra-ai-command-chip shrink-0"
                >
                  {activeCmd.tag}
                </button>
                <button
                  type="submit"
                  aria-label="Run command or open Smart Capture"
                  className="ui-button ui-button--primary !min-h-[32px] !h-[32px] !w-[32px] !p-0 !rounded-[9px] shrink-0"
                >
                  <ArrowUp className="w-3.5 h-3.5" strokeWidth={2.2} />
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ==========================================================================
   Widget 2: Gross Volume — Massive Regular Numeral + 3D Delta Pill + 3 Hatched Bars
   Reference: top right closeup of the dashboard.png
   ========================================================================== */
export function GrossVolumeCard({
  totalRevenueCents,
  paidFullCents,
  advanceCentsCollected,
  pendingCents,
  grossDeltaPct,
  paidRatioPct,
  currency,
  isCompact = false,
  onOpenInvoices,
  onRemove,
}: {
  totalRevenueCents: number;
  paidFullCents: number;
  advanceCentsCollected: number;
  pendingCents: number;
  grossDeltaPct: number | null;
  paidRatioPct: number;
  currency: Currency;
  isCompact?: boolean;
  onOpenInvoices: () => void;
  onRemove?: () => void;
}) {
  const settledPct = sharePercent(paidFullCents, totalRevenueCents);
  const advancePct = sharePercent(advanceCentsCollected, totalRevenueCents);
  const pendingPct = sharePercent(pendingCents, totalRevenueCents);

  const deltaPositive =
    grossDeltaPct === null
      ? totalRevenueCents === 0 || paidRatioPct >= 50
      : grossDeltaPct >= 0;
  const deltaLabel =
    grossDeltaPct !== null ? `${Math.abs(grossDeltaPct)}%` : `${paidRatioPct}%`;

  const rows = [
    {
      label: "Settled Payments",
      amount: formatWholeMoney(paidFullCents, currency),
      pct: settledPct,
      stripe: "zentra-stripe-green",
    },
    {
      label: "Advance Deposits",
      amount: formatWholeMoney(advanceCentsCollected, currency),
      pct: advancePct,
      stripe: "zentra-stripe-blue",
    },
    {
      label: "Open Balances",
      amount: formatWholeMoney(pendingCents, currency),
      pct: pendingPct,
      stripe: "zentra-stripe-pink",
    },
  ];

  return (
    <div className="ui-card flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between gap-2">
          <h3>Gross Volume</h3>
          <CardMenuButton
            label="Gross Volume options"
            actions={[
              { label: "Open Invoices", onClick: onOpenInvoices },
              ...(onRemove ? [{ label: "Hide widget", onClick: onRemove, tone: "danger" as const }] : []),
            ]}
          />
        </div>

        {/* Hero Figure + Elevated 3D Floating Delta Pill */}
        <div className="mt-4 flex items-center gap-3.5 flex-wrap">
          <span
            className={`dashboard-widget-value ${
              isCompact ? "!text-[30px]" : "!text-[42px] xl:!text-[50px]"
            } font-normal tracking-[-0.035em] leading-none text-content-neutral-950 tabular-nums`}
          >
            {formatWholeMoney(totalRevenueCents, currency)}
          </span>
          <span className="zentra-pill-badge !py-1 !px-3">
            <span
              aria-hidden="true"
              className={`text-[9px] leading-none ${
                deltaPositive ? "text-[var(--data-green)]" : "text-content-rose-600"
              }`}
            >
              {deltaPositive ? "▲" : "▼"}
            </span>
            <span className="tabular-nums font-medium">{deltaLabel}</span>
          </span>
        </div>

        <div className="my-4 border-t border-[var(--ui-border-hairline)]" />

        {/* 3 Signature Hatched Progress Bars on Pure-White / Satin Pill Tracks */}
        <div className={isCompact ? "space-y-3" : "space-y-3.5"}>
          {rows.map((row) => (
            <div key={row.label}>
              <div className="flex items-baseline justify-between gap-2 mb-2">
                <span className="text-[14px] font-normal text-content-neutral-500 truncate">
                  {row.label}
                </span>
                <span className="text-[14.5px] font-medium text-content-neutral-950 tabular-nums shrink-0">
                  {row.amount}
                </span>
              </div>
              <div className="data-track">
                <div
                  className={`data-fill ${row.stripe} transition-[width] duration-500`}
                  style={{ width: `${row.pct > 0 ? Math.max(4, row.pct) : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   Widget 3 (and reusable subpage chart): Stepped Pink Pinstripe Chart
   Reference: 3 other widgets.png ("Retention")
   ========================================================================== */
export function SteppedPinstripeChart({
  points,
  peakIndex,
  peakLabel,
  height = 195,
}: {
  points: SteppedRetentionPoint[];
  peakIndex: number;
  peakLabel: string;
  height?: number;
}) {
  const uid = useId().replaceAll(":", "");
  const count = Math.max(1, points.length);
  const w = 280;
  const h = 185;
  const padTop = 34;
  const baselineY = h - 22;
  const plotH = baselineY - padTop;
  const slotW = w / count;
  const barW = Math.max(3, slotW - 2.6);

  const coords = points.map((pt, i) => {
    const ratio = Math.max(0.06, Math.min(1, pt.value / 100));
    const barH = pt.value > 0 ? Math.max(12, ratio * plotH) : 10;
    const x = i * slotW;
    const y = baselineY - barH;
    return { x, y, barH, pt };
  });

  // Build crisp 90-degree stepped top contour path
  const stepPath = coords
    .map((c, i) => {
      const x1 = c.x;
      const x2 = c.x + slotW;
      if (i === 0) return `M ${x1.toFixed(1)} ${c.y.toFixed(1)} H ${x2.toFixed(1)}`;
      return `V ${c.y.toFixed(1)} H ${x2.toFixed(1)}`;
    })
    .join(" ");

  const safePeakIdx = Math.min(Math.max(0, peakIndex), Math.max(0, coords.length - 1));
  const peak = coords[safePeakIdx];
  const peakPctX = peak ? ((peak.x + slotW * 0.5) / w) * 100 : 50;

  // Unique month labels spaced evenly across the bottom
  const monthLabels = points.filter((p) => p.showMonth);

  return (
    <div className="relative w-full select-none" style={{ height }}>
      {/* Floating 3D Peak Pill Badge */}
      {peak && (
        <div
          className="absolute z-10 pointer-events-none"
          style={{
            left: `${Math.min(82, Math.max(18, peakPctX))}%`,
            top: `${Math.max(0, ((peak.y - 30) / h) * 100)}%`,
            transform: "translateX(-50%)",
          }}
        >
          <span className="zentra-pill-badge !py-1 !px-3 !text-[12px] font-medium tabular-nums">
            {peakLabel}
          </span>
        </div>
      )}

      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-full overflow-visible"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Stepped trend peaking at ${peakLabel}`}
      >
        <defs>
          <linearGradient id={`stepBar-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--data-pink-bar)" />
            <stop offset="100%" stopColor="var(--data-pink-bar-end)" />
          </linearGradient>
        </defs>

        {/* Tightly Spaced Vertical Blush Bars */}
        {coords.map((c, i) => (
          <rect
            key={c.pt.key || i}
            x={c.x + 1.3}
            y={c.y}
            width={barW}
            height={c.barH}
            rx="1.5"
            fill={`url(#stepBar-${uid})`}
          >
            <title>{`${c.pt.monthLabel}: ${c.pt.value}%`}</title>
          </rect>
        ))}

        {/* Continuous Sharp Stepped Magenta Contour Line */}
        {stepPath && (
          <path
            d={stepPath}
            fill="none"
            stroke="var(--data-pink-line)"
            strokeWidth="2.1"
            strokeLinejoin="miter"
          />
        )}

        {/* Glowing White-Ringed Peak Dot */}
        {peak && (
          <circle
            cx={peak.x + slotW * 0.5}
            cy={peak.y}
            r="4.2"
            fill="var(--data-pink-line)"
            stroke="var(--ui-surface)"
            strokeWidth="2.4"
          />
        )}

        {/* Crisp Horizontal Baseline */}
        <line
          x1="0"
          y1={baselineY + 1}
          x2={w}
          y2={baselineY + 1}
          stroke="var(--ui-border-hairline)"
          strokeWidth="1"
        />
      </svg>

      {/* Month Labels */}
      <div className="flex items-center justify-between px-1 -mt-4 pb-0.5 text-[11px] font-normal text-content-neutral-500">
        {monthLabels.map((m) => (
          <span key={m.key}>{m.monthLabel}</span>
        ))}
      </div>
    </div>
  );
}

export function RetentionSteppedCard({
  title = "Net Margin",
  points,
  peakIndex,
  peakPct,
  onOpenAnalytics,
  onRemove,
}: {
  title?: string;
  points: SteppedRetentionPoint[];
  peakIndex: number;
  peakPct: number;
  onOpenAnalytics: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className="ui-card flex flex-col justify-between h-full min-h-[268px]">
      <div className="flex items-center justify-between gap-2">
        <h3>{title}</h3>
        <CardMenuButton
          label={`${title} options`}
          actions={[
            { label: "Open Analytics", onClick: onOpenAnalytics },
            ...(onRemove ? [{ label: "Hide widget", onClick: onRemove, tone: "danger" as const }] : []),
          ]}
        />
      </div>

      <div className="mt-3 flex-1 flex items-end">
        <SteppedPinstripeChart
          points={points}
          peakIndex={peakIndex}
          peakLabel={`${peakPct}%`}
          height={196}
        />
      </div>
    </div>
  );
}

/* ==========================================================================
   Widgets 4 & 5: Stacked Horizontal Dot-Matrix Equalizer Cards
   Reference: 3 other widgets.png ("Transactions" & "Customers")
   ========================================================================== */
export function DotMatrixCard({
  title,
  value,
  peakPrefix = "Peak",
  peakLabel,
  deltaText,
  buckets,
  tone,
  onOpen,
  onRemove,
}: {
  title: string;
  value: string;
  peakPrefix?: string;
  peakLabel: string;
  deltaText: string;
  buckets: DotMatrixBucket[];
  tone: "green" | "blue";
  onOpen: () => void;
  onRemove?: () => void;
}) {
  const isGreen = tone === "green";

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) onOpen();
      }}
      className="ui-card flex flex-col justify-between h-full min-h-[126px] cursor-pointer"
    >
      {/* Top Row: Title + Circular "..." Button */}
      <div className="flex items-center justify-between gap-2">
        <h3>{title}</h3>
        <CardMenuButton
          label={`${title} options`}
          actions={[
            { label: `Open ${title}`, onClick: onOpen },
            ...(onRemove ? [{ label: "Hide widget", onClick: onRemove, tone: "danger" as const }] : []),
          ]}
        />
      </div>

      {/* Bottom 3-Zone Row: Big Value | Centered 12-Col Circular Dots + Peak Pill | vs last period */}
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="text-[34px] xl:text-[40px] font-normal tracking-[-0.035em] leading-none text-content-neutral-950 tabular-nums shrink-0">
          {value}
        </div>

        {/* Center: Floating Peak Pill + 12-Column Round Dot Matrix */}
        <div className="flex flex-col items-center gap-2.5 min-w-0 flex-1 max-w-[300px]">
          <span className="zentra-pill-badge !py-1 !px-3 !text-[11.5px]">
            <span className="text-content-neutral-500 font-normal">
              {peakPrefix}:
            </span>
            <strong className="font-semibold text-content-neutral-950">
              {peakLabel}
            </strong>
          </span>

          <div
            className="flex items-end justify-center gap-[7px] h-[48px]"
            aria-label={`${title} activity dot equalizer, ${peakPrefix} ${peakLabel}`}
          >
            {buckets.map((bucket) => (
              <div
                key={bucket.key}
                title={`${bucket.label}: ${bucket.count}`}
                className="flex flex-col-reverse items-center gap-[4px]"
              >
                {Array.from({ length: bucket.dots }, (_, idx) => (
                  <span
                    key={idx}
                    className="w-[8px] h-[8px] rounded-full transition-colors"
                    style={{
                      backgroundColor: bucket.isPeak
                        ? isGreen
                          ? "var(--data-green)"
                          : "var(--data-blue)"
                        : isGreen
                          ? "var(--data-green-muted)"
                          : "var(--data-blue-muted)",
                      opacity: bucket.count === 0 ? 0.55 : 1,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Period Comparison Delta */}
        <div className="text-right shrink-0">
          <div className="text-[11px] font-normal text-content-neutral-500 whitespace-nowrap">
            vs last period
          </div>
          <div className="mt-0.5 text-[18px] xl:text-[20px] font-medium tracking-[-0.02em] text-content-neutral-950 tabular-nums leading-tight">
            {deltaText}
          </div>
        </div>
      </div>
    </div>
  );
}
