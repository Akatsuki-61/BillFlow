import type { ButtonHTMLAttributes, ReactNode } from "react";

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
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <header className="workspace-header">
      <div className="workspace-heading">
        <h1>{title}</h1>
        <p>{description}</p>
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
  return (
    <div className="ui-segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
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
}: {
  label: string;
  value: ReactNode;
  footer?: ReactNode;
  action?: ReactNode;
  tone?: "default" | "accent" | "warning" | "success";
  className?: string;
}) {
  return (
    <div className={`ui-card ui-metric ui-metric--${tone} ${className}`}>
      <div className="ui-metric-heading">
        <span>{label}</span>
        {action}
      </div>
      <div className="ui-metric-value">{value}</div>
      {footer && <div className="ui-metric-footer">{footer}</div>}
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
