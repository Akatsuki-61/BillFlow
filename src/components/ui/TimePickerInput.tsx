"use client";

import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Clock } from "lucide-react";

interface TimeChangeEvent {
  target: { value: string };
  currentTarget: { value: string };
}

export interface TimePickerInputProps {
  id?: string;
  value: string;
  onChange: (event: TimeChangeEvent) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  "aria-label"?: string;
  title?: string;
  placeholder?: string;
}

interface ParsedTime {
  hour12: number; // 1..12
  minute: number; // 0..59
  period: "AM" | "PM";
}

const HOURS_12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES_60 = Array.from({ length: 60 }, (_, i) => i);

function parseTime24(value: string): ParsedTime | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour24 = Number(match[1]);
  const minute = Number(match[2]);
  if (
    Number.isNaN(hour24) ||
    Number.isNaN(minute) ||
    hour24 < 0 ||
    hour24 > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }
  const period: "AM" | "PM" = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour12, minute, period };
}

function formatTime24(hour12: number, minute: number, period: "AM" | "PM"): string {
  const hour24 =
    period === "AM"
      ? hour12 === 12
        ? 0
        : hour12
      : hour12 === 12
        ? 12
        : hour12 + 12;
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatDisplay12(parsed: ParsedTime | null, placeholder = "--:-- --"): string {
  if (!parsed) return placeholder;
  return `${String(parsed.hour12).padStart(2, "0")}:${String(parsed.minute).padStart(2, "0")} ${parsed.period}`;
}

function centerItemInContainer(container: HTMLElement | null, item: HTMLElement | null) {
  if (!container || !item) return;
  const targetTop = item.offsetTop - container.clientHeight / 2 + item.clientHeight / 2;
  container.scrollTop = Math.max(0, targetTop);
}

export function TimePickerInput({
  id,
  value,
  onChange,
  disabled = false,
  required = false,
  className = "",
  "aria-label": ariaLabel,
  title,
  placeholder = "--:-- --",
}: TimePickerInputProps) {
  const popoverId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const hourListRef = useRef<HTMLDivElement | null>(null);
  const minuteListRef = useRef<HTMLDivElement | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 224,
  });

  const parsed = useMemo(() => parseTime24(value), [value]);
  const activeHour = parsed?.hour12 ?? 9;
  const activeMinute = parsed?.minute ?? 0;
  const activePeriod: "AM" | "PM" = parsed?.period ?? "AM";

  const emitChange = useCallback(
    (nextValue: string) => {
      onChange({
        target: { value: nextValue },
        currentTarget: { value: nextValue },
      });
    },
    [onChange],
  );

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const popoverWidth = Math.max(224, Math.min(248, rect.width + 64));
    const popoverHeight = 264;
    const margin = 8;

    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const openAbove = spaceBelow < popoverHeight && rect.top > popoverHeight + margin;

    const top = openAbove
      ? Math.max(margin, rect.top - popoverHeight - 6)
      : Math.min(window.innerHeight - popoverHeight - margin, rect.bottom + 6);

    const left = Math.max(
      margin,
      Math.min(rect.left, window.innerWidth - popoverWidth - margin),
    );

    setCoords({ top, left, width: popoverWidth });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();

    // Scroll active hour and minute cleanly inside their own scroll containers only.
    const raf = requestAnimationFrame(() => {
      const hourBtn = hourListRef.current?.querySelector<HTMLElement>(
        `[data-hour="${activeHour}"]`,
      );
      const minBtn = minuteListRef.current?.querySelector<HTMLElement>(
        `[data-minute="${activeMinute}"]`,
      );
      centerItemInContainer(hourListRef.current, hourBtn ?? null);
      centerItemInContainer(minuteListRef.current, minBtn ?? null);
    });

    return () => cancelAnimationFrame(raf);
    // Run only when opening so clicking options does not jump the scroll list away from the cursor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (
        triggerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    const handleReposition = () => updatePosition();

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [isOpen, updatePosition]);

  const handleToggle = () => {
    if (disabled) return;
    setIsOpen((prev) => !prev);
  };

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? popoverId : undefined}
        aria-label={ariaLabel}
        title={title}
        disabled={disabled}
        onClick={handleToggle}
        className={`flex items-center justify-between gap-2 text-left select-none ${
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
        } ${className}`}
      >
        <span
          className={`tabular-nums truncate ${
            parsed ? "text-content-neutral-900" : "text-content-neutral-400"
          }`}
        >
          {formatDisplay12(parsed, placeholder)}
        </span>
        <Clock className="w-3.5 h-3.5 text-content-neutral-500 shrink-0 pointer-events-none" />
      </button>

      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popoverRef}
            id={popoverId}
            role="dialog"
            aria-label={ariaLabel ? `${ariaLabel} selector` : "Time selector"}
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: coords.width,
            }}
            className="app-no-drag z-[200] rounded-xl bg-surface border border-line-neutral-200 shadow-2xl overflow-hidden text-content-neutral-900 select-none"
          >
            <div className="grid grid-cols-[1fr_1fr_auto] divide-x divide-line-neutral-100 bg-surface">
              {/* Hours (01 - 12) */}
              <div className="flex flex-col">
                <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-content-neutral-500 bg-surface-neutral-50 text-center border-b border-line-neutral-100">
                  Hr
                </div>
                <div
                  ref={hourListRef}
                  className="h-44 overflow-y-auto custom-scrollbar p-1 space-y-0.5 bg-surface"
                >
                  {HOURS_12.map((h) => {
                    const isSelected = parsed?.hour12 === h;
                    return (
                      <button
                        key={h}
                        type="button"
                        data-hour={h}
                        onClick={() => emitChange(formatTime24(h, activeMinute, activePeriod))}
                        className={`w-full h-8 rounded-lg text-xs tabular-nums flex items-center justify-center transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-accent-solid text-white font-semibold"
                            : "bg-surface text-content-neutral-900 hover:bg-surface-neutral-100"
                        }`}
                      >
                        {String(h).padStart(2, "0")}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Minutes (00 - 59) */}
              <div className="flex flex-col">
                <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-content-neutral-500 bg-surface-neutral-50 text-center border-b border-line-neutral-100">
                  Min
                </div>
                <div
                  ref={minuteListRef}
                  className="h-44 overflow-y-auto custom-scrollbar p-1 space-y-0.5 bg-surface"
                >
                  {MINUTES_60.map((m) => {
                    const isSelected = parsed?.minute === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        data-minute={m}
                        onClick={() => emitChange(formatTime24(activeHour, m, activePeriod))}
                        className={`w-full h-8 rounded-lg text-xs tabular-nums flex items-center justify-center transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-accent-solid text-white font-semibold"
                            : "bg-surface text-content-neutral-900 hover:bg-surface-neutral-100"
                        }`}
                      >
                        {String(m).padStart(2, "0")}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* AM / PM */}
              <div className="flex flex-col w-14">
                <div className="px-1.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-content-neutral-500 bg-surface-neutral-50 text-center border-b border-line-neutral-100">
                  AM/PM
                </div>
                <div className="flex flex-col gap-1 p-1.5 bg-surface">
                  {(["AM", "PM"] as const).map((period) => {
                    const isSelected = activePeriod === period && parsed !== null;
                    return (
                      <button
                        key={period}
                        type="button"
                        onClick={() => emitChange(formatTime24(activeHour, activeMinute, period))}
                        className={`w-full h-9 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-accent-solid text-white"
                            : "bg-surface text-content-neutral-900 hover:bg-surface-neutral-100"
                        }`}
                      >
                        {period}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between px-2.5 py-1.5 border-t border-line-neutral-100 bg-surface-neutral-50">
              {!required && parsed ? (
                <button
                  type="button"
                  onClick={() => {
                    emitChange("");
                    setIsOpen(false);
                  }}
                  className="text-[11px] font-medium text-content-neutral-500 hover:text-content-neutral-900 cursor-pointer"
                >
                  Clear
                </button>
              ) : (
                <span className="text-[11px] font-medium text-content-neutral-500 tabular-nums">
                  {formatDisplay12(parsed ?? { hour12: activeHour, minute: activeMinute, period: activePeriod })}
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  if (!parsed) {
                    emitChange(formatTime24(activeHour, activeMinute, activePeriod));
                  }
                  setIsOpen(false);
                }}
                className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-accent-solid text-white hover:opacity-90 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
