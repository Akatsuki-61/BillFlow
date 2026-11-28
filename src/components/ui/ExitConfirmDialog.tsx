"use client";

import React, { useCallback, useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { MotionPresence } from "@/components/ui/MotionSurface";
import { Button } from "@/components/ui/Workspace";

/**
 * Global in-app exit confirmation dialog.
 * Triggered by the main process via `window:confirm-close` IPC push,
 * and responds via `window:close-response` IPC invoke.
 */
export function ExitConfirmDialog() {
  const [isOpen, setIsOpen] = useState(false);

  // Respond to main process and optionally exit
  const respond = useCallback((confirmed: boolean) => {
    setIsOpen(false);
    window.billflow?.window?.closeResponse(confirmed);
  }, []);

  useEffect(() => {
    const cleanup = window.billflow?.window?.onConfirmClose(() => {
      setIsOpen(true);
    });
    return () => cleanup?.();
  }, []);

  return (
    <MotionPresence>
      {isOpen && (
        <Dialog onClose={() => respond(false)} width={420} compact>
          <div className="app-dialog-header">
            <div className="flex items-start gap-3.5 min-w-0">
              {/* Icon badge */}
              <div
                className="w-10 h-10 flex items-center justify-center shrink-0 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400"
                aria-hidden="true"
              >
                <LogOut className="w-5 h-5" />
              </div>

              <div className="min-w-0">
                <h2 className="!text-[18px] !font-semibold !leading-tight">
                  Exit BillFlow?
                </h2>
                <p className="!mt-1 text-[13px] text-content-neutral-500">
                  Any unsaved changes will be lost.
                </p>
              </div>
            </div>
          </div>

          <div className="app-dialog-footer !justify-end gap-2.5">
            <Button
              id="exit-confirm-no"
              type="button"
              variant="secondary"
              size="small"
              onClick={() => respond(false)}
            >
              <span>Stay</span>
            </Button>

            <Button
              id="exit-confirm-yes"
              type="button"
              variant="danger"
              size="small"
              onClick={() => respond(true)}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Exit</span>
            </Button>
          </div>
        </Dialog>
      )}
    </MotionPresence>
  );
}
