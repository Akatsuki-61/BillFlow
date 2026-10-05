"use client";

import React, { useEffect, useRef } from "react";
import { MotionPresence } from "@/components/ui/MotionSurface";

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  tone?: "default" | "danger";
}

interface ContextMenuProps {
  isOpen: boolean;
  x: number;
  y: number;
  onClose: () => void;
  items: ContextMenuItem[];
}

export function ContextMenu({
  isOpen,
  x,
  y,
  onClose,
  items,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", onClose, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Keep menu within screen boundaries
  const menuWidth = 210;
  const menuHeight = items.length * 36 + 16;
  const adjustedX =
    typeof window !== "undefined" && x + menuWidth > window.innerWidth
      ? Math.max(10, window.innerWidth - menuWidth - 12)
      : x;
  const adjustedY =
    typeof window !== "undefined" && y + menuHeight > window.innerHeight
      ? Math.max(10, window.innerHeight - menuHeight - 12)
      : y;

  return (
    <MotionPresence>
      <div
        className="fixed inset-0 z-50 pointer-events-auto"
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      >
        <div
          ref={menuRef}
          style={{ top: `${adjustedY}px`, left: `${adjustedX}px` }}
          className="fixed z-50 min-w-[200px] bg-surface/95 backdrop-blur-md rounded-xl p-1.5 shadow-[0px_4px_20px_rgba(0,0,0,0.14),0px_0px_0px_1px_rgba(0,0,0,0.08)] border border-line-neutral-200/70 select-none animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="flex flex-col gap-0.5">
            {items.map((item, index) => (
              <button
                key={index}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  item.onClick();
                  onClose();
                }}
                className={`flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-left transition-colors cursor-pointer outline-none ${
                  item.tone === "danger"
                    ? "text-content-rose-600 hover:bg-surface-rose-50 hover:text-content-rose-700"
                    : "text-content-neutral-700 hover:bg-surface-neutral-100 hover:text-content-neutral-900"
                }`}
              >
                {item.icon && (
                  <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0 text-current">
                    {item.icon}
                  </span>
                )}
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </MotionPresence>
  );
}
