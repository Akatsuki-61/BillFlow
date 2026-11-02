"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "./Workspace";
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
    <MotionSurface kind="dialog" className="app-dialog-backdrop">
      <MotionSurface
        kind="panel"
        onDismiss={onClose}
        className={`app-dialog${compact ? " app-dialog--compact" : ""}`}
        style={{ width }}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close dialog"
          className="app-dialog-close"
        >
          <X className="w-4 h-4" />
        </Button>
        {children}
      </MotionSurface>
    </MotionSurface>,
    document.body,
  );
}
