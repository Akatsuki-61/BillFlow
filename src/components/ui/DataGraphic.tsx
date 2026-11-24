function compactDisplay(value: string) {
  const match = value.match(/\d[\d,]*(?:\.\d+)?/);
  if (!match) return value;
  const amount = Number(match[0].replaceAll(",", ""));
  const sign = value.startsWith("-") ? "-" : "";
  return (
    sign +
    new Intl.NumberFormat("en-US", {
      notation: amount >= 1000 ? "compact" : "standard",
      maximumFractionDigits: amount >= 1000 ? 1 : 2,
    }).format(amount)
  );
}

import { sharePercent } from "@/lib/visual-metrics";

export function DataBreakdown({
  rows,
  total,
  label,
}: {
  rows: { label: string; value: number; display: string; tone?: string }[];
  total: number;
  label: string;
}) {
  return (
    <div className="data-breakdown" role="group" aria-label={label}>
      {rows.map((row) => (
        <div key={row.label}>
          <div className="data-breakdown-label">
            <span>{row.label}</span>
            <strong>{row.display}</strong>
          </div>
          <div
            className="data-track"
            role="meter"
            aria-label={row.label}
            aria-valuenow={Math.round(sharePercent(row.value, total))}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={`${row.display}, ${Math.round(sharePercent(row.value, total))}%`}
          >
            <div
              className={`data-fill zentra-stripe-${row.tone || "blue"}`}
              style={{ width: `${sharePercent(row.value, total)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Signed bars share one scale; zero has no mark. Values remain available without hover. */
export function MonthlyBars({
  points,
  label,
  formatValue,
  tone = "pink",
}: {
  points: { key: string; label: string; value: number }[];
  label: string;
  formatValue: (value: number) => string;
  tone?: string;
}) {
  const hasNegative = points.some((point) => point.value < 0);
  const max = Math.max(...points.map((point) => Math.abs(point.value)), 1);
  return (
    <figure className="data-months" aria-label={label}>
      <figcaption>{label}</figcaption>
      <div className="data-months-grid">
        {points.map((point) => (
          <div
            key={point.key}
            className="data-month"
            title={`${point.label}: ${formatValue(point.value)}`}
          >
            <span
              className="data-month-value"
              aria-label={formatValue(point.value)}
            >
              {compactDisplay(formatValue(point.value))}
            </span>
            <div className="data-month-column">
              {hasNegative && <span className="data-zero-line" />}
              <div
                className={`data-month-bar zentra-stripe-${point.value < 0 ? "pink" : tone}`}
                style={{
                  height: `${(Math.abs(point.value) / max) * (hasNegative ? 50 : 100)}%`,
                  ...(hasNegative
                    ? {
                        position: "absolute",
                        bottom: point.value < 0 ? undefined : "50%",
                        top: point.value < 0 ? "50%" : undefined,
                      }
                    : {}),
                }}
              />
            </div>
            <span>{point.label}</span>
          </div>
        ))}
      </div>
    </figure>
  );
}

export function DataDots({
  points,
  label,
  noun,
  tone = "accent",
}: {
  points: { key: string; label: string; value: number }[];
  label: string;
  noun: string;
  tone?: "accent" | "green";
}) {
  const maxVal = Math.max(0, ...points.map((point) => point.value));
  const unit = Math.max(1, Math.ceil(maxVal / 8));
  return (
    <figure className={`data-dots data-dots--${tone}`} aria-label={label}>
      <div className="data-dots-grid">
        {points.map((point) => {
          const isPeak = maxVal > 0 && point.value === maxVal;
          return (
            <div
              key={point.key}
              className="data-dots-column"
              title={`${point.label}: ${point.value} ${noun}`}
            >
              <div>
                {Array.from(
                  { length: Math.ceil(point.value / unit) },
                  (_, index) => (
                    <span
                      key={index}
                      data-peak={isPeak ? "true" : "false"}
                    />
                  ),
                )}
              </div>
              <small>{point.label}</small>
            </div>
          );
        })}
      </div>
      <figcaption>
        {label} ·{" "}
        {unit === 1
          ? `one dot = one ${noun.replace(/s$/, "")}`
          : `one dot ≈ ${unit} ${noun}`}
      </figcaption>
    </figure>
  );
}
