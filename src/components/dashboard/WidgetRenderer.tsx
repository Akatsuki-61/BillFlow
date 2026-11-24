"use client";
import { ReportingGuard } from "@/context/ReportingContext";
import dynamic from "next/dynamic";

import React, { useMemo } from "react";
import Link from "next/link";
import { MonthlyBars, DataDots } from "@/components/ui/DataGraphic";
import {
  sharePercent,
  taskProgress,
  recentMonths,
} from "@/lib/visual-metrics";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  X,
} from "lucide-react";
import {
  useClients,
  useTasks,
  useVendors,
} from "@/lib/data/DataProvider";
import type { TaskItem } from "@/types/tasks";
import {
  formatCents,
  formatDateDisplay,
  getCurrencySymbol,
} from "@/lib/format";
import { DashboardPeriod } from "@/types/dashboard";
import { WidgetDisplaySize } from "@/types/widgets";
import { useWidgetContext } from "@/context/WidgetContext";
import { computeCashflowRunwayCard } from "@/lib/widgets/chartData";
import "../analytics/analytics.css";
import { useDashboardMetrics } from "./DashboardMetricsContext";
import { LedgerWidget } from "./LedgerWidget";
import {
  CardMenuButton,
  DotMatrixCard,
  GrossVolumeCard,
  PaymentsFunnelCard,
  RetentionSteppedCard,
} from "./ZentraCharts";

function ChartLoadingSkeleton() {
  return (
    <div
      className="min-h-[260px] w-full flex flex-col justify-between p-1 animate-pulse"
      aria-hidden="true"
    >
      <div className="flex items-center justify-between">
        <div className="h-4 w-28 rounded-md bg-surface-neutral-100" />
        <div className="h-4 w-14 rounded-md bg-surface-neutral-100" />
      </div>
      <div className="h-[190px] w-full rounded-xl bg-surface-neutral-100/70" />
    </div>
  );
}

const LatencyPercentilesChart = dynamic(
  () =>
    import("./charts/LatencyPercentilesChart").then(
      (m) => m.LatencyPercentilesChart,
    ),
  { ssr: false, loading: () => <ChartLoadingSkeleton /> },
);

const PortfolioComparisonChart = dynamic(
  () =>
    import("./charts/PortfolioComparisonChart").then(
      (m) => m.PortfolioComparisonChart,
    ),
  { ssr: false, loading: () => <ChartLoadingSkeleton /> },
);

const GrowthBenchmarkChart = dynamic(
  () =>
    import("./charts/GrowthBenchmarkChart").then(
      (m) => m.GrowthBenchmarkChart,
    ),
  { ssr: false, loading: () => <ChartLoadingSkeleton /> },
);

const AudienceGrowthChart = dynamic(
  () =>
    import("./charts/AudienceGrowthChart").then(
      (m) => m.AudienceGrowthChart,
    ),
  { ssr: false, loading: () => <ChartLoadingSkeleton /> },
);

const ServiceTrendsLineChart = dynamic(
  () =>
    import("./charts/ServiceTrendsLineChart").then(
      (m) => m.ServiceTrendsLineChart,
    ),
  { ssr: false, loading: () => <ChartLoadingSkeleton /> },
);

const ItemizedVolumeBarChart = dynamic(
  () =>
    import("./charts/ItemizedVolumeBarChart").then(
      (m) => m.ItemizedVolumeBarChart,
    ),
  { ssr: false, loading: () => <ChartLoadingSkeleton /> },
);

let sharedTransparentDragCanvas: HTMLCanvasElement | null = null;
function getTransparentDragCanvas(): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  if (!sharedTransparentDragCanvas) {
    sharedTransparentDragCanvas = document.createElement("canvas");
    sharedTransparentDragCanvas.width = 1;
    sharedTransparentDragCanvas.height = 1;
  }
  return sharedTransparentDragCanvas;
}

function ActiveClientsMonthlyDots() {
  const { clients } = useClients();
  return (
    <DataDots
      label="New clients by month"
      noun="clients"
      points={recentMonths().map((month) => ({
        ...month,
        value: clients.filter((client) =>
          client.createdAt.startsWith(month.key),
        ).length,
      }))}
    />
  );
}

function OutsourcedCostsMetric({
  renderCard,
}: {
  renderCard: (vendorCount: number) => React.ReactNode;
}) {
  const { vendors } = useVendors();
  return <>{renderCard(vendors.length)}</>;
}

function SprintTasksList({
  isCompact,
  activeTasks,
  onNavigate,
}: {
  isCompact: boolean;
  activeTasks: TaskItem[];
  onNavigate: () => void;
}) {
  const { tasks } = useTasks();
  return (
    <div className="mt-3.5 space-y-2">
      {tasks.length === 0 ? (
        <div
          onClick={onNavigate}
          className="p-4 rounded-[16px] bg-surface border border-line-neutral-200/80 flex items-center justify-between cursor-pointer hover:bg-surface-neutral-50"
        >
          <div>
            <div className="text-[13.5px] font-medium text-content-neutral-950">
              Launch your first sprint deliverable
            </div>
            <div className="text-[12px] text-content-neutral-500 mt-0.5">
              Tasks auto-generate when an invoice reaches Advance Paid
            </div>
          </div>
          <span className="zentra-circle-btn zentra-circle-btn--sm">
            <ArrowUpRight className="w-4 h-4" />
          </span>
        </div>
      ) : (
        (activeTasks.length > 0 ? activeTasks : tasks)
          .slice(0, isCompact ? 2 : 3)
          .map((t) => {
            const progressPct = taskProgress(t);
            const barClass =
              t.status === "done"
                ? "zentra-stripe-green"
                : t.status === "review"
                  ? "zentra-stripe-pink"
                  : t.status === "in-progress"
                    ? "zentra-stripe-blue"
                    : "zentra-stripe-blue-soft";

            return (
              <div
                key={t.id}
                onClick={onNavigate}
                className="p-3 rounded-[16px] bg-surface hover:bg-surface-neutral-50 transition-all cursor-pointer border border-line-neutral-200/80 shadow-2xs"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          t.priority === "urgent"
                            ? "bg-[#ec4899]"
                            : t.priority === "high"
                              ? "bg-[#f59e0b]"
                              : "bg-accent-solid"
                        }`}
                      />
                      <span className="text-[13.5px] font-medium text-content-neutral-950 truncate">
                        {t.title}
                      </span>
                    </div>
                    <div className="mt-0.5 pl-4 text-[11.5px] text-content-neutral-400 truncate">
                      {t.clientName || t.category || "Sprint Deliverable"}
                      {t.invoiceCode ? ` · ${t.invoiceCode}` : ""}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="zentra-pill-badge !py-0.5 !px-2 !text-[10.5px]">
                      {t.status.replace("-", " ")}
                    </span>
                  </div>
                </div>

                <div className="mt-2.5 flex items-center gap-2.5">
                  <div className="flex-1 h-1.5 rounded-full bg-surface-neutral-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${barClass} transition-all duration-300`}
                      style={{ width: `${progressPct ?? 0}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-semibold tabular-nums text-content-neutral-600">
                    {progressPct === null ? "No checklist" : `${progressPct}%`}
                  </span>
                </div>
              </div>
            );
          })
      )}
    </div>
  );
}

interface WidgetRendererProps {
  widgetId: string;
  source: "dashboard" | "analytics";
  period?: DashboardPeriod;
  displaySize?: WidgetDisplaySize;
  isDraggable?: boolean;
  isEditing?: boolean;
  onToggleSize?: () => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  onRemove?: () => void;
  onContextMenu?: (e: React.MouseEvent, widgetId: string) => void;
  onNavigateToInvoice?: (id: string) => void;
}

function WidgetContent({
  widgetId,
  source,
  period = "quarter",
  displaySize = "normal",
  isDraggable = false,
  isEditing = false,
  onToggleSize,
  onMoveLeft,
  onMoveRight,
  onRemove,
  onContextMenu,
  onNavigateToInvoice,
}: WidgetRendererProps) {
  const router = useRouter();
  const {
    activeCurrency,
    grossDeltaPct,
    invoicesCountDelta,
    clientsCountDelta,
    activeTasks,
    filteredInvoices,
    financials,
    totalOutsourcedCents,
    outsourcedCostsStr,
    totalRevenueCents,
    paidCount,
    paidCents,
    paidFullCents,
    advanceCentsCollected,
    advancePaidCount,
    pendingCents,
    pendingCount,
    paidRatioPct,
    avgInvoiceCents,
    avgInvoiceStr,
    totalRevenueStr,
    pendingReceivablesStr,
    opexStr,
    opexRatioPct,
    isLoss,
    netProfitStr,
    marginPct,
    totalClientsCount,
    activeClientsCount,
    topClient,
    topClientPct,
    effectiveHourlyRate,
    totalTrackedHours,
    overdueInvoices,
    overdueTotalStr,
    currencyIssuedCount,
    monthlyStats,
    steppedRetentionSeries,
    steppedPeakIndex,
    steppedPeakPct,
    invoiceDotBuckets,
    invoicePeakLabel,
    clientDotBuckets,
    clientPeakLabel,
    taskCounts,
    pipelineStages,
  } = useDashboardMetrics(period);
  const { draggedWidgetId, startWidgetDrag, endWidgetDrag } =
    useWidgetContext();
  const isBeingDragged = draggedWidgetId === widgetId;

  const displayInvoices = useMemo(
    () => filteredInvoices.slice(0, displaySize === "compact" ? 2 : 4),
    [filteredInvoices, displaySize],
  );

  const isCompact = displaySize === "compact";
  const isDashboard = source === "dashboard";

  // Helper to render a Zentra Metric Card with a Dot-Matrix + Striped Bar
  const renderZentraMetric = ({
    title,
    value,
    badgeText,
    subtitle,
    footerLabel,
    barPct = 0,
    stripeTone = "blue",
    href = "/analytics",
    actionLabel,
  }: {
    title: string;
    value: React.ReactNode;
    badgeText: string;
    subtitle: string;
    footerLabel?: string;
    barPct?: number;
    stripeTone?: "blue" | "green" | "pink" | "amber";
    href?: string;
    actionLabel?: string;
  }) => {
    const stripeClass =
      stripeTone === "green"
        ? "zentra-stripe-green"
        : stripeTone === "pink"
          ? "zentra-stripe-pink"
          : stripeTone === "amber"
            ? "zentra-stripe-amber"
            : "zentra-stripe-blue";

    const dotActiveColor =
      stripeTone === "green"
        ? "bg-[#16a34a]"
        : stripeTone === "pink"
          ? "bg-[#ec4899]"
          : stripeTone === "amber"
            ? "bg-[#f59e0b]"
            : "bg-accent-solid";

    const clampedPct = Math.max(0, Math.min(100, Math.round(barPct)));

    return (
      <div
        role="link"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" && event.target === event.currentTarget)
            router.push(href);
        }}
        onClick={() => router.push(href)}
        className={`ui-card cursor-pointer flex flex-col justify-between h-full ${
          isCompact ? "p-4 min-h-[195px]" : "p-6 min-h-[248px]"
        }`}
      >
        <div>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[18px] font-medium tracking-[-0.02em] text-content-neutral-950 truncate">
              {title}
            </h3>
            {isDashboard && (
              <CardMenuButton
                label={`${title} options`}
                actions={[
                  { label: actionLabel || `Open ${title}`, onClick: () => router.push(href) },
                  ...(onRemove
                    ? [{ label: "Hide widget", onClick: onRemove, tone: "danger" as const }]
                    : []),
                ]}
              />
            )}
          </div>

          <div className="my-3.5 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div
                className={`${
                  isCompact ? "text-[26px]" : "text-[34px] xl:text-[38px]"
                } dashboard-widget-value font-normal tracking-[-0.035em] text-content-neutral-950 leading-none tabular-nums truncate`}
              >
                {value}
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <span className="zentra-pill-badge !py-0.5 !px-2.5 !text-[11.5px]">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${dotActiveColor}`}
                  />
                  {badgeText}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--ui-border-hairline)] space-y-2">
            <div className="flex items-center justify-between text-[12.5px] text-content-neutral-500 gap-2">
              <span className="truncate">{subtitle}</span>
              <span className="font-medium tabular-nums text-content-neutral-950 shrink-0">
                {clampedPct}%
              </span>
            </div>
            <div className="data-track">
              <div
                className={`data-fill ${stripeClass} transition-[width] duration-500`}
                style={{ width: `${clampedPct > 0 ? Math.max(4, clampedPct) : 0}%` }}
              />
            </div>
          </div>
        </div>

        {!isDashboard && (
          <div className="dashboard-widget-footer mt-3.5 pt-3 border-t border-line-neutral-100 flex items-center justify-between text-[12.5px] text-content-neutral-500">
            <span className="truncate text-[12px]">
              {footerLabel || badgeText}
            </span>
            <Link
              href={href}
              onClick={(e) => e.stopPropagation()}
              className="text-content-neutral-950 font-medium hover:underline inline-flex items-center gap-1 shrink-0"
            >
              <span>{actionLabel || `Open ${title}`}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </div>
    );
  };

  // Render individual widget based on ID
  const renderContent = () => {
    switch (widgetId) {
      // 1. Total Revenue / Gross Volume — Zentra Pattern B (Massive Numeral + 3D Delta Pill + 3 Hatched Bars)
      case "total-revenue":
        return (
          <GrossVolumeCard
            totalRevenueCents={totalRevenueCents}
            paidFullCents={paidFullCents}
            advanceCentsCollected={advanceCentsCollected}
            pendingCents={pendingCents}
            grossDeltaPct={grossDeltaPct}
            paidRatioPct={paidRatioPct}
            currency={activeCurrency}
            isCompact={isCompact}
            onOpenInvoices={() => router.push("/invoices")}
            onRemove={isDashboard ? onRemove : undefined}
          />
        );

      // 2. Net Profit & Margin — Zentra Pattern C (Stepped Pink Pinstripe Chart + Peak Pill)
      case "net-profit":
        if (isDashboard) {
          return (
            <RetentionSteppedCard
              title={isLoss ? "Net Loss" : "Net Margin"}
              points={steppedRetentionSeries}
              peakIndex={steppedPeakIndex}
              peakPct={steppedPeakPct}
              onOpenAnalytics={() => router.push("/analytics")}
              onRemove={onRemove}
            />
          );
        }
        return (
          <div
            className={`ui-card flex flex-col justify-between h-full ${
              isCompact ? "p-4 min-h-[195px]" : "p-6 min-h-[248px]"
            }`}
          >
            <div>
              <h3 className="text-[18px] font-medium tracking-[-0.02em] text-content-neutral-950 truncate">
                {isLoss ? "Net Loss & Margin" : "Net Profit & Margin"}
              </h3>
              <div
                className={`mt-3 ${
                  isCompact ? "text-[26px]" : "text-[34px] xl:text-[36px]"
                } dashboard-widget-value font-normal tracking-[-0.035em] text-content-neutral-950 leading-none tabular-nums truncate`}
              >
                {netProfitStr}
              </div>
              <p className="summary-caption">
                {marginPct}% margin · billed less {opexStr} costs
              </p>
              <div className="mt-2">
                <MonthlyBars
                  label={`Monthly profit · ${activeCurrency}`}
                  points={monthlyStats.map((month) => ({
                    ...month,
                    value: month.profitCents,
                  }))}
                  formatValue={(value) => formatCents(value, activeCurrency)}
                />
              </div>
            </div>
            <div className="dashboard-widget-footer relative z-10 mt-3.5 pt-3 border-t border-line-neutral-100 flex items-center justify-between text-[12.5px] text-content-neutral-500">
              <span className="dashboard-widget-footer-copy truncate text-[12px]">
                {marginPct}% net margin
              </span>
              <Link
                href="/analytics"
                className="text-content-neutral-950 font-medium hover:underline inline-flex items-center gap-1 shrink-0"
              >
                <span>Open Analytics</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        );

      // 3. Pending Receivables / Invoices — Zentra Pattern D (Green Circular Dot-Matrix Equalizer)
      case "pending-receivables":
        if (isDashboard) {
          return (
            <DotMatrixCard
              title="Invoices"
              value={filteredInvoices.length.toLocaleString()}
              peakPrefix="Peak"
              peakLabel={invoicePeakLabel}
              deltaText={
                invoicesCountDelta >= 0
                  ? `+${invoicesCountDelta}`
                  : `${invoicesCountDelta}`
              }
              buckets={invoiceDotBuckets}
              tone="green"
              onOpen={() => router.push("/invoices")}
              onRemove={onRemove}
            />
          );
        }
        return (
          <div
            className={`ui-card receivables-card flex flex-col justify-between h-full ${
              isCompact ? "p-4 min-h-[195px]" : "p-6 min-h-[248px]"
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[18px] font-medium tracking-[-0.02em] text-content-neutral-950 truncate">
                  Pending Receivables
                </h3>
              </div>

              <div className="mt-3 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <div
                    className={`${
                      isCompact ? "text-[26px]" : "text-[34px] xl:text-[36px]"
                    } dashboard-widget-value font-normal tracking-[-0.035em] text-content-neutral-950 leading-none tabular-nums truncate`}
                  >
                    {pendingReceivablesStr}
                  </div>
                  <div className="mt-2 text-[12px] text-content-neutral-500 truncate">
                    {pendingCount}{" "}
                    {pendingCount === 1
                      ? "invoice awaiting payment"
                      : "invoices awaiting payment"}
                  </div>
                </div>

                <div className="text-right shrink-0 hidden sm:block">
                  <div className="text-[11px] text-content-neutral-400">
                    paid ratio
                  </div>
                  <div className="text-[16px] font-medium tracking-tight text-content-neutral-950 tabular-nums mt-0.5">
                    {paidRatioPct}%
                  </div>
                </div>
              </div>

              <DataDots
                label="Open invoices by issue month"
                noun="invoices"
                tone="green"
                points={recentMonths().map((month) => ({
                  ...month,
                  value: filteredInvoices.filter(
                    (invoice) =>
                      invoice.currency === activeCurrency &&
                      invoice.status !== "DRAFT" &&
                      invoice.amountCents > invoice.paidCents &&
                      invoice.issueDate.startsWith(month.key),
                  ).length,
                }))}
              />
            </div>

            <div className="dashboard-widget-footer relative z-10 mt-3.5 pt-3 border-t border-line-neutral-100 flex items-center justify-between text-[12.5px] text-content-neutral-500">
              <span className="dashboard-widget-footer-copy truncate text-[12px]">
                {pendingCount}{" "}
                {pendingCount === 1 ? "invoice awaiting" : "invoices awaiting"}
              </span>
              <Link
                href="/invoices"
                className="text-content-neutral-950 font-medium hover:underline inline-flex items-center gap-1 shrink-0"
              >
                <span>Open Invoices</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        );

      // 4. Total Clients — Zentra Pattern D (Blue Circular Dot-Matrix Equalizer)
      case "active-clients":
        if (isDashboard) {
          return (
            <DotMatrixCard
              title="Clients"
              value={totalClientsCount.toLocaleString()}
              peakPrefix="Highest"
              peakLabel={clientPeakLabel}
              deltaText={
                clientsCountDelta >= 0
                  ? `+${clientsCountDelta}`
                  : `${clientsCountDelta}`
              }
              buckets={clientDotBuckets}
              tone="blue"
              onOpen={() => router.push("/clients")}
              onRemove={onRemove}
            />
          );
        }
        return (
          <div
            className={`ui-card flex flex-col justify-between h-full ${
              isCompact ? "p-4 min-h-[195px]" : "p-6 min-h-[248px]"
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[18px] font-medium tracking-[-0.02em] text-content-neutral-950 truncate">
                  Customers & Clients
                </h3>
              </div>

              <div className="mt-3 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <div
                    className={`${
                      isCompact ? "text-[26px]" : "text-[34px] xl:text-[36px]"
                    } dashboard-widget-value font-normal tracking-[-0.035em] text-content-neutral-950 leading-none tabular-nums truncate`}
                  >
                    {totalClientsCount.toLocaleString()}
                  </div>
                  <div className="mt-2 text-[12px] text-content-neutral-500 truncate">
                    {activeClientsCount} active accounts
                  </div>
                </div>

                <div className="text-right shrink-0 hidden sm:block">
                  <div className="text-[11px] text-content-neutral-400">
                    active share
                  </div>
                  <div className="text-[16px] font-medium tracking-tight text-content-neutral-950 tabular-nums mt-0.5">
                    {totalClientsCount > 0
                      ? Math.round((activeClientsCount / totalClientsCount) * 100)
                      : 0}
                    %
                  </div>
                </div>
              </div>

              <ActiveClientsMonthlyDots />
            </div>

            <div className="dashboard-widget-footer relative z-10 mt-3.5 pt-3 border-t border-line-neutral-100 flex items-center justify-between text-[12.5px] text-content-neutral-500">
              <span className="dashboard-widget-footer-copy truncate text-[12px]">
                {activeClientsCount} active accounts
              </span>
              <Link
                href="/clients"
                className="text-content-neutral-950 font-medium hover:underline inline-flex items-center gap-1 shrink-0"
              >
                <span>Open Clients</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        );

      // 5. Outsourced Costs
      case "outsourced-costs":
        return (
          <OutsourcedCostsMetric
            renderCard={(vendorCount) =>
              renderZentraMetric({
                title: "Subcontractor Payables",
                value:
                  vendorCount > 0
                    ? outsourcedCostsStr
                    : formatCents(0, activeCurrency),
                badgeText: `${vendorCount} vendors`,
                subtitle: "Contractor share of gross revenue",
                barPct:
                  totalRevenueCents > 0
                    ? Math.round((totalOutsourcedCents / totalRevenueCents) * 100)
                    : 0,
                stripeTone: "blue",
                href: "/outsourcing",
                actionLabel: "Open Outsourcing",
              })
            }
          />
        );

      // 6. Operating Expenses
      case "operating-expenses":
        return renderZentraMetric({
          title: "Operating Expenses",
          value: opexStr,
          badgeText: `${opexRatioPct}% overhead`,
          subtitle: "Costs as a share of billed revenue",
          barPct: opexRatioPct,
          stripeTone: "pink",
          href: "/expenses",
          actionLabel: "Open Expenses",
        });

      // 7. Paid Ratio
      case "paid-ratio":
        return renderZentraMetric({
          title: "Collection Rate",
          value: totalRevenueCents > 0 ? `${paidRatioPct}%` : "0%",
          badgeText: `${paidCount} of ${filteredInvoices.length} settled`,
          subtitle: "Realized collection efficiency",
          barPct: paidRatioPct,
          stripeTone: "green",
          href: "/invoices",
          actionLabel: "Open Invoices",
        });

      // 8. Average Invoice Value
      case "average-invoice-value": {
        const maxInvoiceCents = filteredInvoices.reduce(
          (max, inv) => Math.max(max, inv.amountCents),
          0,
        );
        return renderZentraMetric({
          title: "Average Contract Value",
          value:
            filteredInvoices.length > 0
              ? avgInvoiceStr
              : formatCents(0, activeCurrency),
          badgeText: `${filteredInvoices.length} invoices`,
          subtitle: "Share vs largest issued invoice",
          footerLabel:
            maxInvoiceCents > 0
              ? `Peak ${formatCents(maxInvoiceCents, activeCurrency)}`
              : "No issued invoices",
          barPct:
            maxInvoiceCents > 0
              ? Math.round((avgInvoiceCents / maxInvoiceCents) * 100)
              : 0,
          stripeTone: "blue",
          href: "/invoices",
          actionLabel: "Open Invoices",
        });
      }

      // 9. Overdue Receivables
      case "overdue-receivables":
        return renderZentraMetric({
          title: "Overdue Receivables",
          value: overdueTotalStr,
          badgeText: `${overdueInvoices.length} overdue`,
          subtitle: "Share of issued invoices overdue",
          barPct:
            currencyIssuedCount > 0
              ? Math.min(
                  100,
                  Math.round(
                    (overdueInvoices.length / currencyIssuedCount) * 100,
                  ),
                )
              : 0,
          stripeTone: "pink",
          href: "/invoices",
          actionLabel: "Open Invoices",
        });

      // 10. Cashflow Runway
      case "cashflow-runway": {
        const runway = computeCashflowRunwayCard(financials, activeCurrency);
        return renderZentraMetric({
          title: "Cashflow Runway",
          value: runway.value,
          badgeText: runway.badgeText,
          subtitle: runway.subtitle,
          barPct: runway.barPct,
          stripeTone: "green",
          href: "/analytics",
          actionLabel: "Open Analytics",
        });
      }

      // 11. Top Client Concentration
      case "client-concentration":
        return renderZentraMetric({
          title: "Client Concentration",
          value: totalRevenueCents > 0 ? `${topClientPct}%` : "0%",
          badgeText: topClient?.name || "Portfolio",
          subtitle: "Share of revenue from top client",
          barPct: topClientPct,
          stripeTone: "blue",
          href: "/clients",
          actionLabel: "Open Clients",
        });

      // 12. Realized Hourly Yield
      case "effective-hourly-rate":
        return renderZentraMetric({
          title: "Profit per Tracked Hour",
          value:
            totalTrackedHours > 0
              ? `${getCurrencySymbol(activeCurrency)}${effectiveHourlyRate}/hr`
              : `${getCurrencySymbol(activeCurrency)}0/hr`,
          badgeText:
            totalTrackedHours > 0
              ? `${Math.round(totalTrackedHours * 10) / 10} hrs tracked`
              : "Track sprint hours",
          subtitle: "Task completion vs active time yield",
          footerLabel: `${taskCounts.done} of ${taskCounts.total} tasks done`,
          barPct: taskCounts.donePct,
          stripeTone: "green",
          href: "/tasks",
          actionLabel: "Open Sprint Board",
        });

      // 13. Revenue vs Expenses Paired Bar Chart (Zentra Royal Blue & Pink Hatched Bars)
      case "revenue-expenses-chart": {
        const rawMax = Math.max(
          0,
          ...monthlyStats.map((m) => Math.max(m.revenueCents, m.expensesCents)),
        );
        const maxChartVal = rawMax;
        const topLabel = formatCents(maxChartVal, activeCurrency);
        const midLabel = formatCents(
          Math.round(maxChartVal / 2),
          activeCurrency,
        );

        return (
          <div className="ui-card p-6 flex flex-col justify-between h-full min-h-[330px]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-[18px] font-medium tracking-[-0.02em] text-content-neutral-950">
                  Revenue vs Expenses
                </h3>
                {!isCompact && (
                  <p className="text-[12.5px] text-content-neutral-500 mt-0.5">
                    Six months: billed revenue and linked fees by invoice month;
                    expenses by incurred date
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="zentra-pill-badge !py-1 !px-2.5 !text-[11.5px]">
                  <span className="w-2 h-2 rounded-full bg-accent-solid" />
                  <span>Revenue</span>
                </span>
                <span className="zentra-pill-badge !py-1 !px-2.5 !text-[11.5px]">
                  <span className="w-2 h-2 rounded-full bg-[#ec4899]" />
                  <span>Expenses</span>
                </span>
              </div>
            </div>

            <div className="my-4">
              <svg
                viewBox="0 0 540 170"
                className="w-full h-[175px] overflow-visible"
                preserveAspectRatio="xMidYMid meet"
              >
                <defs>
                  <linearGradient id="revBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--theme-accent)" />
                    <stop
                      offset="100%"
                      stopColor="var(--theme-accent-deep-solid)"
                    />
                  </linearGradient>
                  <linearGradient id="expBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f472b6" />
                    <stop offset="100%" stopColor="#db2777" />
                  </linearGradient>
                </defs>

                <line
                  x1="45"
                  y1="28"
                  x2="525"
                  y2="28"
                  className="analytics-grid-line"
                />
                <line
                  x1="45"
                  y1="80"
                  x2="525"
                  y2="80"
                  className="analytics-grid-line"
                />
                <line
                  x1="45"
                  y1="135"
                  x2="525"
                  y2="135"
                  className="analytics-grid-line"
                />

                <text
                  x="38"
                  y="32"
                  textAnchor="end"
                  className="analytics-axis-text"
                >
                  {topLabel}
                </text>
                <text
                  x="38"
                  y="84"
                  textAnchor="end"
                  className="analytics-axis-text"
                >
                  {midLabel}
                </text>
                <text
                  x="38"
                  y="138"
                  textAnchor="end"
                  className="analytics-axis-text"
                >
                  {getCurrencySymbol(activeCurrency)}0
                </text>

                {monthlyStats.map((m, i) => {
                  const cx = 82 + i * 78;
                  const revHeight =
                    maxChartVal > 0 && m.revenueCents > 0
                      ? (m.revenueCents / maxChartVal) * 102
                      : 0;
                  const expHeight =
                    maxChartVal > 0 && m.expensesCents > 0
                      ? (m.expensesCents / maxChartVal) * 102
                      : 0;
                  const revY = 135 - revHeight;
                  const expY = 135 - expHeight;
                  const isCurrent = i === 5;

                  return (
                    <g key={m.key}>
                      <rect
                        x={cx - 19}
                        y="22"
                        width="38"
                        height="113"
                        rx="11"
                        className="analytics-capsule-bg"
                      />
                      <rect
                        x={cx - 13}
                        y={revY}
                        width="11"
                        height={revHeight}
                        rx="5.5"
                        fill="url(#revBarGrad)"
                      >
                        <title>{`${m.label} Revenue: ${formatCents(m.revenueCents, activeCurrency)}`}</title>
                      </rect>
                      <rect
                        x={cx + 2}
                        y={expY}
                        width="11"
                        height={expHeight}
                        rx="5.5"
                        fill="url(#expBarGrad)"
                      >
                        <title>{`${m.label} Expenses: ${formatCents(m.expensesCents, activeCurrency)}`}</title>
                      </rect>
                      <text
                        x={cx}
                        y="154"
                        className={`analytics-month-text ${isCurrent ? "active" : ""}`}
                      >
                        {m.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            <div className="pt-3 border-t border-line-neutral-100 flex items-center justify-between text-[12.5px] text-content-neutral-500">
              <div className="flex items-center gap-4">
                <span>
                  Gross:{" "}
                  <strong className="text-content-neutral-950 font-semibold tabular-nums">
                    {totalRevenueStr}
                  </strong>
                </span>
                <span>
                  Outsourced:{" "}
                  <strong className="text-content-neutral-950 font-semibold tabular-nums">
                    {outsourcedCostsStr}
                  </strong>
                </span>
              </div>
              <Link
                href="/analytics"
                className="text-content-neutral-950 font-medium hover:underline inline-flex items-center gap-1"
              >
                <span>Open Analytics</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        );
      }

      // 14. Payments 5-Stage Sloped Hatched Funnel + Embedded AI Dock
      case "profit-trajectory-chart":
        return (
          <PaymentsFunnelCard
            stages={pipelineStages}
            currency={activeCurrency}
            isCompact={isCompact}
            onOpenInvoices={() => router.push("/invoices")}
            onRemove={isDashboard ? onRemove : undefined}
          />
        );

      // 15. On-Time Collection Rate Gauge — Zentra Visual Gauge + Striped Breakdown
      case "collection-rate-gauge": {
        const radius = 40;
        const circumference = 2 * Math.PI * radius;
        const hasInvoices = filteredInvoices.length > 0;
        const strokeDashoffset = hasInvoices
          ? circumference * (1 - paidRatioPct / 100)
          : circumference;

        return (
          <div className="ui-card p-6 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <h3 className="text-[18px] font-medium tracking-[-0.02em] text-content-neutral-950">
                Collection Efficiency
              </h3>
            </div>

            <div className="my-4 flex items-center gap-5">
              <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
                <svg
                  className="w-full h-full transform -rotate-90"
                  viewBox="0 0 100 100"
                >
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    stroke="var(--ui-subtle)"
                    strokeWidth="10"
                    fill="transparent"
                  />
                  {paidRatioPct > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r={radius}
                      stroke="#16a34a"
                      strokeWidth="10"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      fill="transparent"
                    />
                  )}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[22px] font-medium tracking-[-0.03em] text-content-neutral-950 tabular-nums">
                    {hasInvoices ? `${paidRatioPct}%` : "0%"}
                  </span>
                </div>
              </div>

              <div className="flex-1 space-y-2.5 min-w-0">
                <div>
                  <div className="flex justify-between text-[12px] mb-1">
                    <span className="text-content-neutral-500">Settled</span>
                    <span className="font-semibold text-content-neutral-900 tabular-nums">
                      {paidCount}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-surface-neutral-100 overflow-hidden">
                    <div
                      className="h-full rounded-full zentra-stripe-green"
                      style={{
                        width: `${sharePercent(paidCount, filteredInvoices.length)}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[12px] mb-1">
                    <span className="text-content-neutral-500">Advance Paid</span>
                    <span className="font-semibold text-content-neutral-900 tabular-nums">
                      {advancePaidCount}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-surface-neutral-100 overflow-hidden">
                    <div
                      className="h-full rounded-full zentra-stripe-amber"
                      style={{
                        width: `${sharePercent(advancePaidCount, filteredInvoices.length)}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[12px] mb-1">
                    <span className="text-content-neutral-500">Open Balance</span>
                    <span className="font-semibold text-content-neutral-900 tabular-nums">
                      {pendingCount}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-surface-neutral-100 overflow-hidden">
                    <div
                      className="h-full rounded-full zentra-stripe-blue"
                      style={{
                        width: `${sharePercent(pendingCount, filteredInvoices.length)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2.5 border-t border-line-neutral-100 flex items-center justify-between text-[12px] text-content-neutral-500">
              <span>{overdueInvoices.length} overdue invoices</span>
              <Link
                href="/invoices"
                className="text-content-neutral-950 font-medium hover:underline inline-flex items-center gap-1"
              >
                <span>Open Invoices</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        );
      }

      // 16. Billing Alerts — Poppy Stepped Pinstripe Urgency + Visual Alert Capsules
      case "billing-alerts":
        return (
          <div className="ui-card p-6 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-[18px] font-medium tracking-[-0.02em] text-content-neutral-950">
                    Billing Alerts
                  </h3>
                  <span className="zentra-pill-badge !py-0.5 !px-2.5 !text-[11px]">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        overdueInvoices.length > 0
                          ? "bg-[#ec4899]"
                          : "bg-[#16a34a]"
                      }`}
                    />
                    {overdueInvoices.length} overdue
                  </span>
                </div>
              </div>

              {/* Visual Overdue Amount & Striped Urgency Bar */}
              <div className="mt-3 p-3.5 rounded-[16px] bg-surface-neutral-50 border border-line-neutral-200/70">
                <div className="flex items-baseline justify-between">
                  <span className="text-[12px] text-content-neutral-500">
                    Total Past Due
                  </span>
                  <span className="text-[22px] font-medium tracking-[-0.03em] text-content-neutral-950 tabular-nums">
                    {overdueTotalStr}
                  </span>
                </div>
                <div className="mt-2 w-full h-2 rounded-full bg-surface-neutral-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      overdueInvoices.length > 0
                        ? "zentra-stripe-pink"
                        : "zentra-stripe-green"
                    }`}
                    style={{
                      width:
                        overdueInvoices.length > 0
                          ? `${Math.min(100, overdueInvoices.length * 25 + 20)}%`
                          : "100%",
                    }}
                  />
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {overdueInvoices.length === 0 ? (
                  <div className="py-5 text-center text-[12.5px] text-content-neutral-500">
                    All client accounts are on schedule.
                  </div>
                ) : (
                  overdueInvoices.slice(0, isCompact ? 2 : 3).map((inv) => (
                    <div
                      key={inv.id}
                      onClick={() =>
                        onNavigateToInvoice
                          ? onNavigateToInvoice(inv.id)
                          : router.push(
                              `/invoices?invoice=${encodeURIComponent(inv.id)}`,
                            )
                      }
                      className="flex items-center justify-between p-2.5 rounded-[14px] bg-surface hover:bg-surface-neutral-50 transition-colors cursor-pointer border border-line-neutral-200/80"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-[13px] font-medium text-content-neutral-950 truncate">
                          {inv.clientName || "Client Account"}
                        </div>
                        <div className="text-[11px] text-[#ec4899] font-medium">
                          {inv.code} · Due {formatDateDisplay(inv.dueDate)}
                        </div>
                      </div>
                      <span className="text-[13px] font-semibold tabular-nums text-content-neutral-950 shrink-0">
                        {formatCents(inv.amountCents, inv.currency)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-line-neutral-100 flex items-center justify-between text-[12px] text-content-neutral-500">
              <Link
                href="/invoices?view=overdue-summary"
                className="text-rose-600 dark:text-rose-400 font-medium hover:underline inline-flex items-center gap-1"
              >
                <span>Aging Breakdown</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/invoices"
                className="text-content-neutral-900 font-medium hover:underline inline-flex items-center gap-1"
              >
                <span>Open Invoices</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        );

      // 17. Recent Client Invoices — Poppy Visual Collection Bar + Inline Striped Progress Capsules
      case "recent-invoices":
        return (
          <div className="ui-card p-6 flex flex-col justify-between h-full">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-[18px] font-medium tracking-[-0.02em] text-content-neutral-950">
                    Recent Invoices
                  </h3>
                  <span className="zentra-pill-badge !py-0.5 !px-2.5 !text-[11.5px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" />
                    {paidRatioPct}% collected
                  </span>
                </div>
              </div>

              {/* Visual Collection Split Strip */}
              <div className="mt-4 p-3.5 rounded-[18px] bg-surface-neutral-50 border border-line-neutral-200/70">
                <div className="flex items-center justify-between text-[12px] mb-2">
                  <span className="text-content-neutral-500 font-medium">
                    Collected{" "}
                    <strong className="text-content-neutral-950 font-semibold tabular-nums">
                      {formatCents(paidCents, activeCurrency)}
                    </strong>
                  </span>
                  <span className="text-content-neutral-500 font-medium">
                    Balance{" "}
                    <strong className="text-content-neutral-950 font-semibold tabular-nums">
                      {pendingReceivablesStr}
                    </strong>
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-surface-neutral-200/70 p-[1.5px] flex gap-1 overflow-hidden">
                  <div
                    className="h-full rounded-full zentra-stripe-green transition-all duration-500"
                    style={{ width: `${paidRatioPct}%` }}
                  />
                  <div
                    className="h-full rounded-full zentra-stripe-blue transition-all duration-500"
                    style={{
                      width: `${sharePercent(pendingCents, totalRevenueCents)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Visual Invoice Capsules */}
              <div className="mt-3.5 space-y-2">
                {displayInvoices.length === 0 ? (
                  <div className="py-8 text-center text-[13px] text-content-neutral-400">
                    No invoices generated yet.
                  </div>
                ) : (
                  displayInvoices.map((inv) => {
                    const invPaid =
                      inv.paidCents ??
                      (inv.status === "PAID" ? inv.amountCents : 0);
                    const invPct =
                      inv.amountCents > 0
                        ? Math.min(
                            100,
                            Math.round((invPaid / inv.amountCents) * 100),
                          )
                        : 0;
                    const barClass =
                      inv.status === "PAID"
                        ? "zentra-stripe-green"
                        : inv.status === "ADVANCE_PAID"
                          ? "zentra-stripe-blue"
                          : "zentra-stripe-pink";

                    return (
                      <div
                        key={inv.id}
                        onClick={() =>
                          onNavigateToInvoice
                            ? onNavigateToInvoice(inv.id)
                            : router.push(
                                `/invoices?invoice=${encodeURIComponent(inv.id)}`,
                              )
                        }
                        className="p-3 rounded-[16px] bg-surface hover:bg-surface-neutral-50 transition-all cursor-pointer border border-line-neutral-200/80 shadow-2xs"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-8 h-8 rounded-[10px] bg-surface-neutral-100 border border-line-neutral-200 flex items-center justify-center text-[11px] font-semibold text-content-neutral-800 shrink-0">
                              {(inv.clientName || "C")
                                .slice(0, 2)
                                .toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <div className="text-[13.5px] font-medium text-content-neutral-950 truncate">
                                {inv.clientName}
                              </div>
                              <div className="text-[11px] text-content-neutral-400 font-mono">
                                {inv.code} · {invPct}% paid
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="text-[14px] font-semibold tabular-nums text-content-neutral-950">
                              {formatCents(inv.amountCents, inv.currency)}
                            </div>
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                inv.status === "PAID"
                                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                  : inv.status === "ADVANCE_PAID"
                                    ? "bg-accent/10 text-accent dark:text-accent"
                                    : inv.status === "OVERDUE"
                                      ? "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                                      : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                              }`}
                            >
                              {inv.status.replace("_", " ")}
                            </span>
                          </div>
                        </div>

                        {/* Inline Diagonal-Striped Payment Progress Bar */}
                        <div className="mt-2.5 w-full h-1.5 rounded-full bg-surface-neutral-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${barClass} transition-all duration-300`}
                            style={{ width: `${invPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="mt-3.5 pt-3 border-t border-line-neutral-100 flex items-center justify-between text-[12.5px] text-content-neutral-500">
              <span>{filteredInvoices.length} total invoices in period</span>
              <Link
                href="/invoices"
                className="text-content-neutral-950 font-medium hover:underline inline-flex items-center gap-1"
              >
                <span>Open Invoices</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        );

      // 18. Active Sprint Tasks — Poppy Zentra Visual Sprint Velocity Matrix + Striped Deliverable Capsules
      case "sprint-tasks": {
        const sprintColumns = [
          {
            label: "To do",
            count: taskCounts.todo,
            stripe: "zentra-stripe-amber",
            pct: sharePercent(taskCounts.todo, taskCounts.total),
          },
          {
            label: "In progress",
            count: taskCounts.inProgress,
            stripe: "zentra-stripe-blue",
            pct: sharePercent(taskCounts.inProgress, taskCounts.total),
          },
          {
            label: "Review",
            count: taskCounts.review,
            stripe: "zentra-stripe-pink",
            pct: sharePercent(taskCounts.review, taskCounts.total),
          },
          {
            label: "Done",
            count: taskCounts.done,
            stripe: "zentra-stripe-green",
            pct: sharePercent(taskCounts.done, taskCounts.total),
          },
        ];

        return (
          <div className="ui-card p-6 flex flex-col justify-between h-full">
            <div>
              {/* Top Header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-[18px] font-medium tracking-[-0.02em] text-content-neutral-950">
                    Sprint Tasks & Velocity
                  </h3>
                  <span className="zentra-pill-badge !py-0.5 !px-2.5 !text-[11.5px]">
                    <span>{taskCounts.donePct}% completed</span>
                  </span>
                </div>
              </div>

              {/* Poppy 4-Stage Diagonal-Striped Sprint Matrix */}
              <div className="mt-4 grid grid-cols-4 gap-2 p-3 rounded-[18px] bg-surface-neutral-50 border border-line-neutral-200/70">
                {sprintColumns.map((col) => (
                  <div
                    key={col.label}
                    onClick={() => router.push("/tasks")}
                    className="flex flex-col justify-between cursor-pointer group/col"
                  >
                    <div>
                      <div className="text-[11px] font-medium text-content-neutral-400 truncate">
                        {col.label}
                      </div>
                      <div className="text-[20px] font-medium tracking-[-0.03em] text-content-neutral-950 tabular-nums leading-tight mt-0.5">
                        {col.count}
                      </div>
                    </div>
                    <div className="mt-2.5 w-full h-2.5 rounded-full bg-surface-neutral-200/70 p-[1.5px] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${col.stripe} transition-all duration-500`}
                        style={{ width: `${col.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Active Deliverable Capsules with Progress Bars */}
              <SprintTasksList
                isCompact={isCompact}
                activeTasks={activeTasks}
                onNavigate={() => router.push("/tasks")}
              />
            </div>

            <div className="mt-3.5 pt-3 border-t border-line-neutral-100 flex items-center justify-between text-[12.5px] text-content-neutral-500">
              <span>
                {activeTasks.length} active · {taskCounts.done} completed
              </span>
              <Link
                href="/tasks"
                className="text-content-neutral-950 font-medium hover:underline inline-flex items-center gap-1"
              >
                <span>Open Sprint Board</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        );
      }

      // 19. Active Time Percentiles Chart
      case "latency-percentiles-chart":
        return (
          <div className="ui-card p-6 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-[18px] font-medium tracking-[-0.02em] text-content-neutral-950">
                  Active Time Percentiles
                </h3>
                {!isCompact && (
                  <p className="text-[12.5px] text-content-neutral-500 mt-0.5">
                    Recorded active time of completed tasks, grouped by
                    completion month
                  </p>
                )}
              </div>
            </div>
            <LatencyPercentilesChart />
            <div className="mt-4 pt-3 border-t border-line-neutral-100 flex items-center justify-between text-[12.5px] text-content-neutral-500">
              <span>Completed tasks active hours</span>
              <Link
                href="/tasks"
                className="text-content-neutral-950 font-medium hover:underline inline-flex items-center gap-1"
              >
                <span>Open Sprint Board</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        );

      // 20. Service Line-Item Mix Chart
      case "portfolio-comparison-chart":
        return (
          <div className="ui-card p-6 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-[18px] font-medium tracking-[-0.02em] text-content-neutral-950">
                  Service Line-Item Mix
                </h3>
                {!isCompact && (
                  <p className="text-[12.5px] text-content-neutral-500 mt-0.5">
                    Gross service values, grouped from item descriptions
                  </p>
                )}
              </div>
            </div>
            <PortfolioComparisonChart />
            <div className="mt-4 pt-3 border-t border-line-neutral-100 flex items-center justify-between text-[12.5px] text-content-neutral-500">
              <span>Itemized service catalog breakdown</span>
              <Link
                href="/catalog"
                className="text-content-neutral-950 font-medium hover:underline inline-flex items-center gap-1"
              >
                <span>Open Catalog</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        );

      // 21. Weekly Completed Work Chart
      case "growth-benchmark-chart":
        return (
          <div className="ui-card p-6 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-[18px] font-medium tracking-[-0.02em] text-content-neutral-950">
                  Weekly Completed Work
                </h3>
                {!isCompact && (
                  <p className="text-[12.5px] text-content-neutral-500 mt-0.5">
                    Completed tasks by completion date over the last eight weeks
                  </p>
                )}
              </div>
            </div>
            <GrowthBenchmarkChart />
            <div className="mt-4 pt-3 border-t border-line-neutral-100 flex items-center justify-between text-[12.5px] text-content-neutral-500">
              <span>8-week sprint velocity benchmark</span>
              <Link
                href="/analytics"
                className="text-content-neutral-950 font-medium hover:underline inline-flex items-center gap-1"
              >
                <span>Open Analytics</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        );

      // 22. Collections & Net Cashflow Chart
      case "audience-growth-chart":
        return (
          <div className="ui-card p-6 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-[18px] font-medium tracking-[-0.02em] text-content-neutral-950">
                  Collections & Net Cashflow
                </h3>
                {!isCompact && (
                  <p className="text-[12.5px] text-content-neutral-500 mt-0.5">
                    Recorded payments, contractor payouts and expenses
                  </p>
                )}
              </div>
            </div>
            <AudienceGrowthChart />
            <div className="mt-4 pt-3 border-t border-line-neutral-100 flex items-center justify-between text-[12.5px] text-content-neutral-500">
              <span>Net cashflow & collections ledger</span>
              <Link
                href="/analytics"
                className="text-content-neutral-950 font-medium hover:underline inline-flex items-center gap-1"
              >
                <span>Open Analytics</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        );

      // 23. Service Delivery Trends Line Chart
      case "service-trends-line-chart":
        return (
          <div className="ui-card p-6 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-[18px] font-medium tracking-[-0.02em] text-content-neutral-950">
                  Service Delivery Trends
                </h3>
                {!isCompact && (
                  <p className="text-[12.5px] text-content-neutral-500 mt-0.5">
                    Completed tasks by month and inferred service group
                  </p>
                )}
              </div>
            </div>
            <ServiceTrendsLineChart />
            <div className="mt-4 pt-3 border-t border-line-neutral-100 flex items-center justify-between text-[12.5px] text-content-neutral-500">
              <span>Monthly service category delivery</span>
              <Link
                href="/analytics"
                className="text-content-neutral-950 font-medium hover:underline inline-flex items-center gap-1"
              >
                <span>Open Analytics</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        );

      // 24. Contract Deliverables Volume Bar Chart
      case "itemized-volume-bar-chart":
        return (
          <div className="ui-card p-6 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-[18px] font-medium tracking-[-0.02em] text-content-neutral-950">
                  Contract Deliverables Volume
                </h3>
                {!isCompact && (
                  <p className="text-[12.5px] text-content-neutral-500 mt-0.5">
                    Issued invoice items by month and inferred service group
                  </p>
                )}
              </div>
            </div>
            <ItemizedVolumeBarChart />
            <div className="mt-4 pt-3 border-t border-line-neutral-100 flex items-center justify-between text-[12.5px] text-content-neutral-500">
              <span>Service volume by description category</span>
              <Link
                href="/catalog"
                className="text-content-neutral-950 font-medium hover:underline inline-flex items-center gap-1"
              >
                <span>Open Catalog</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      data-size={isDashboard ? displaySize : undefined}
      draggable={isDraggable}
      onDragStart={(e) => {
        if (!isDraggable) return;
        e.dataTransfer.clearData();
        e.dataTransfer.setData("text/plain", widgetId);
        e.dataTransfer.effectAllowed = "copyMove";
        const emptyCanvas = getTransparentDragCanvas();
        if (emptyCanvas) {
          e.dataTransfer.setDragImage(emptyCanvas, 0, 0);
        }
        startWidgetDrag({
          widgetId,
          source,
          element: e.currentTarget,
          clientX: e.clientX,
          clientY: e.clientY,
        });
      }}
      onDragEnd={() => {
        endWidgetDrag();
      }}
      onContextMenu={(e) => {
        if (onContextMenu) {
          e.preventDefault();
          onContextMenu(e, widgetId);
        }
      }}
      className={`${isDashboard ? "dashboard-widget " : ""}group relative h-full transition-[opacity,box-shadow,translate] duration-200 ${
        isDraggable
          ? "cursor-grab active:cursor-grabbing hover:-translate-y-0.5"
          : ""
      } ${
        isBeingDragged
          ? "opacity-35 scale-[0.985] ring-2 ring-dashed ring-accent/65 rounded-[24px]"
          : ""
      } ${
        isEditing
          ? "ring-2 ring-dashed ring-accent/50 rounded-[24px] bg-accent/[0.04] p-0.5"
          : ""
      }`}
    >
      {isDraggable && !isEditing && (
        <div
          aria-hidden="true"
          className="absolute top-2.5 left-1/2 -translate-x-1/2 z-20 flex items-center justify-center px-3 py-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none"
        >
          <div className="w-9 h-1 rounded-full bg-content-neutral-400/45 dark:bg-white/25" />
        </div>
      )}
      {isDashboard && isEditing && (
        <div className="dashboard-widget-controls absolute top-3 right-3 z-30 flex items-center gap-1 p-1 bg-surface/95 rounded-full border border-line-neutral-200 shadow-md backdrop-blur-xs select-none">
          {isEditing && onMoveLeft && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMoveLeft();
              }}
              title="Move Left / Earlier"
              className="p-1.5 text-content-neutral-500 hover:text-content-neutral-900 rounded-full hover:bg-surface-neutral-100 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}

          {isEditing && onMoveRight && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMoveRight();
              }}
              title="Move Right / Later"
              className="p-1.5 text-content-neutral-500 hover:text-content-neutral-900 rounded-full hover:bg-surface-neutral-100 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}

          {onToggleSize && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSize();
              }}
              title={isCompact ? "Expand to Standard" : "Shrink to Compact"}
              className="p-1.5 text-accent hover:bg-accent-faint rounded-full transition-colors cursor-pointer"
            >
              {isCompact ? (
                <Maximize2 className="w-3.5 h-3.5" />
              ) : (
                <Minimize2 className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          {onRemove && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              title="Remove from Dashboard"
              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {isDraggable && source === "analytics" && !isEditing && (
        <div className="absolute top-3.5 right-3.5 z-20 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-1.5 rounded-full bg-surface/90 shadow-xs border border-line-neutral-200 pointer-events-none">
          <GripVertical className="w-3.5 h-3.5 text-content-neutral-500" />
        </div>
      )}

      {isDashboard &&
      (widgetId === "cash-flow" || widgetId === "collected-revenue") ? (
        <LedgerWidget widgetId={widgetId} compact={isCompact} />
      ) : (
        renderContent()
      )}
    </div>
  );
}

export function WidgetRenderer(props: WidgetRendererProps) {
  return (
    <ReportingGuard>
      <WidgetContent {...props} />
    </ReportingGuard>
  );
}
