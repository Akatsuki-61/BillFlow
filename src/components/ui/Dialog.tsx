"use client";

import { useEffect, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { MotionSurface } from "./MotionSurface";

let openDialogs = 0;
let previousOverflow = "";

/** Shared desktop dialog frame. Forms keep their own submit and draft behavior. */
export function Dialog({
  children,
  onClose,
  width = 620,
  compact = false,
}: {
  children: ReactNode;
  onClose: () => void;
  width?: number;
  compact?: boolean;
}) {
  useEffect(() => {
    if (openDialogs++ === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    return () => {
      if (--openDialogs === 0) document.body.style.overflow = previousOverflow;
    };
  }, []);

  if (typeof document === "undefined") return null;
  return createPortal(
    <MotionSurface
      kind="dialog"
      className="app-dialog-backdrop app-no-drag"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <MotionSurface
        kind="panel"
        onDismiss={onClose}
        className={`app-dialog app-no-drag${compact ? " app-dialog--compact" : ""}`}
        style={{ width }}
      >
        {children}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
          }}
          aria-label="Close dialog"
          className="ui-button ui-button--ghost ui-button--icon app-dialog-close app-no-drag"
          style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
        >
          <X className="w-4 h-4 pointer-events-none" />
        </button>
      </MotionSurface>
    </MotionSurface>,
    document.body,
  );
}
