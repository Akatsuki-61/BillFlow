"use client";

import React, { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  SPRING_MENU_POPOVER,
  EXIT_MENU_POPOVER,
  POPOVER_INITIAL_SCALE,
  listRowTransition,
} from "@/lib/motion";

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
  const reducedMotion = useReducedMotion();

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

  // Keep menu within screen boundaries
  const menuWidth = 210;
  const menuHeight = items.length * 36 + 16;
  const nearRightEdge =
    typeof window !== "undefined" && x + menuWidth > window.innerWidth;
  const nearBottomEdge =
    typeof window !== "undefined" && y + menuHeight > window.innerHeight;
  const adjustedX = nearRightEdge
    ? Math.max(10, window.innerWidth - menuWidth - 12)
    : x;
  const adjustedY = nearBottomEdge
    ? Math.max(10, window.innerHeight - menuHeight - 12)
    : y;
  const originX = nearRightEdge ? "right" : "left";
  const originY = nearBottomEdge ? "bottom" : "top";

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 pointer-events-auto"
          onContextMenu={(e) => {
            e.preventDefault();
            onClose();
          }}
        >
          <motion.div
            ref={menuRef}
            initial={
              reducedMotion
                ? { opacity: 0 }
                : {
                    opacity: 0,
                    scale: POPOVER_INITIAL_SCALE,
                    y: originY === "bottom" ? 6 : -6,
                  }
            }
            animate={
              reducedMotion
                ? { opacity: 1, transition: { duration: 0 } }
                : {
                    opacity: 1,
                    scale: 1,
                    y: 0,
                    transition: SPRING_MENU_POPOVER,
                  }
            }
            exit={
              reducedMotion
                ? { opacity: 0, transition: { duration: 0 } }
                : {
                    opacity: 0,
                    scale: POPOVER_INITIAL_SCALE,
                    y: originY === "bottom" ? 6 : -6,
                    transition: EXIT_MENU_POPOVER,
                  }
            }
            style={{
              top: `${adjustedY}px`,
              left: `${adjustedX}px`,
              transformOrigin: `${originY} ${originX}`,
            }}
            className="fixed z-50 min-w-[200px] bg-surface/95 backdrop-blur-md rounded-xl p-1.5 shadow-[0px_4px_20px_rgba(0,0,0,0.14),0px_0px_0px_1px_rgba(0,0,0,0.08)] border border-line-neutral-200/70 select-none"
          >
            <div className="flex flex-col gap-0.5">
              {items.map((item, index) => (
                <motion.button
                  key={index}
                  type="button"
                  initial={reducedMotion ? false : { opacity: 0, y: -3 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={listRowTransition(index, Boolean(reducedMotion))}
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
                </motion.button>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
