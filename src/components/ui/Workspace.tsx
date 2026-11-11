"use client";

import { useId, type ButtonHTMLAttributes, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { SPRING_NAV_GLIDE } from "@/lib/motion";

export function Button({
  variant = "secondary",
  size = "default",
  className = "",
  type = "button",
  title,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "menu";
  size?: "default" | "small" | "icon";
}) {
  return (
    <button
      {...props}
      type={type}
      title={title}
      aria-label={props["aria-label"] ?? (size === "icon" ? title : undefined)}
      className={`ui-button ui-button--${variant} ui-button--${size} ${className}`}
    />
  );
}

export function PageHeader({
  title,
  description,
  badge,
  children,
}: {
  title: string;
  description?: string;
  badge?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="workspace-header">
      <div className="workspace-heading">
        <div className="workspace-heading-row">
          <h1>{title}</h1>
          {badge}
        </div>
        {description && <p>{description}</p>}
      </div>
      {children && <div className="workspace-actions">{children}</div>}
    </header>
  );
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: ReactNode }[];
  label: string;
}) {
  const segmentGroupId = useId();
  const reducedMotion = useReducedMotion();

  return (
    <div className="ui-segmented" role="group" aria-label={label}>
      {options.map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            data-has-pill="true"
            onClick={() => onChange(option.value)}
          >
            {isActive && (
              <motion.span
                layoutId={`segmented-pill-${segmentGroupId}`}
                className="ui-segmented-pill"
                transition={reducedMotion ? { duration: 0 } : SPRING_NAV_GLIDE}
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  footer,
  action,
  tone = "default",
  className = "",
  compact = false,
}: {
  label: string;
  value: ReactNode;
  footer?: ReactNode;
  action?: ReactNode;
  tone?: "default" | "accent" | "warning" | "success";
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`ui-card ui-metric ui-metric--${tone} ${
        compact ? "ui-metric--compact" : ""
      } ${className}`}
    >
      <div className="ui-metric-heading">
        <span>{label}</span>
        {action}
      </div>
      <div className="ui-metric-value">{value}</div>
      <div className="mt-1 flex items-center justify-between gap-3">
        {footer && <div className="ui-metric-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="ui-switch"
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  children,
  compact = false,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  children?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`ui-empty ${compact ? "ui-empty--compact" : ""}`}>
      {icon && <div className="ui-empty-icon">{icon}</div>}
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {children}
    </div>
  );
}
