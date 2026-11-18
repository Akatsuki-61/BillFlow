"use client";

import React, { useEffect, useState } from "react";
import { Keyboard } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { MotionPresence } from "@/components/ui/MotionSurface";
import { useProfiles } from "@/context/ProfileContext";

const SHORTCUT_GROUPS = [
  {
    title: "Navigation",
    items: [
      { keys: "Cmd/Ctrl + K", desc: "Open universal search & actions" },
      { keys: "Cmd/Ctrl + 1..8", desc: "Jump directly to any workspace tab" },
      { keys: "Cmd/Ctrl + ,", desc: "Open workspace settings" },
      { keys: "Cmd/Ctrl + /", desc: "Toggle this shortcuts reference" },
    ],
  },
  {
    title: "Quick Creation (Inside Search)",
    items: [
      { keys: "Alt + 1", desc: "New invoice" },
      { keys: "Alt + 2", desc: "New client" },
      { keys: "Alt + 3", desc: "New task" },
      { keys: "Alt + 4..7", desc: "Expense, catalog item, vendor, or work order" },
    ],
  },
  {
    title: "Workspace Actions",
    items: [
      { keys: "Cmd/Ctrl + S", desc: "Save active Settings changes" },
      { keys: "Cmd/Ctrl + Z", desc: "Undo last Dashboard widget change" },
      { keys: "← / →", desc: "Step through Guided Tour cards" },
      { keys: "Esc", desc: "Close open dialog, menu, or tour" },
    ],
  },
] as const;

export function KeyboardShortcutsModal() {
  const { isGateOpen, isLocked } = useProfiles();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const openHandler = () => setIsOpen(true);
    const keyHandler = (e: KeyboardEvent) => {
      if (isGateOpen || isLocked) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("billflow:open-shortcuts", openHandler);
    window.addEventListener("keydown", keyHandler);
    return () => {
      window.removeEventListener("billflow:open-shortcuts", openHandler);
      window.removeEventListener("keydown", keyHandler);
    };
  }, [isGateOpen, isLocked]);

  return (
    <MotionPresence>
      {isOpen && (
        <Dialog onClose={() => setIsOpen(false)} width={600}>
          <div className="app-dialog-header">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-accent-faint text-accent flex items-center justify-center">
                <Keyboard className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-content-neutral-950">
                  Keyboard Shortcuts
                </h2>
                <p className="text-xs text-content-neutral-500">
                  Fast keyboard controls across billing, tasks, and navigation.
                </p>
              </div>
            </div>
          </div>

          <div className="app-dialog-body space-y-5">
            {SHORTCUT_GROUPS.map((group) => (
              <div key={group.title}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-content-neutral-500 mb-2">
                  {group.title}
                </h3>
                <div className="divide-y divide-line-neutral-100 rounded-xl border border-line-neutral-200 overflow-hidden">
                  {group.items.map((item) => (
                    <div
                      key={item.keys}
                      className="px-3.5 py-2.5 flex items-center justify-between gap-4 bg-surface text-[13px]"
                    >
                      <span className="text-content-neutral-800">
                        {item.desc}
                      </span>
                      <kbd className="px-2 py-0.5 rounded-md bg-surface-neutral-100 border border-line-neutral-200 text-[11px] font-mono text-content-neutral-700 shrink-0">
                        {item.keys}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Dialog>
      )}
    </MotionPresence>
  );
}
