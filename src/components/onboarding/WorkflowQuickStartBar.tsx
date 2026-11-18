"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, Compass, X } from "lucide-react";
import { useData } from "@/lib/data/DataProvider";
import { useProfiles } from "@/context/ProfileContext";
import {
  dismissQuickStart,
  getQuickStartProgress,
  isQuickStartDismissed,
} from "@/lib/onboarding-tour";

export function WorkflowQuickStartBar() {
  const { settings, clients, catalogItems, invoices, tasks, isLoading } =
    useData();
  const { activeProfile } = useProfiles();
  const [dismissedForProfile, setDismissedForProfile] = useState<string | null>(
    null,
  );

  if (isLoading) return null;

  const isDismissed =
    dismissedForProfile === activeProfile.id ||
    isQuickStartDismissed(activeProfile.id);

  if (isDismissed) return null;

  const progress = getQuickStartProgress({
    businessName: settings?.businessName,
    clientsCount: clients.length,
    catalogCount: catalogItems.length,
    invoicesCount: invoices.length,
    tasksCount: tasks.length,
  });

  if (progress.isComplete) return null;

  return (
    <section
      aria-label="Workspace Quick Start"
      className="ui-card px-5 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
    >
      <div className="flex flex-col gap-1 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[13.5px] font-semibold text-content-neutral-950">
            Workspace Setup
          </span>
          <span className="zentra-pill-badge !py-0.5 !px-2 !text-[11px] tabular-nums">
            {progress.completedCount}/{progress.totalCount} complete
          </span>
        </div>
        <p className="text-[12px] text-content-neutral-500">
          Complete these four steps to connect billing, Kanban tasks, and profit tracking.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 flex-1">
        {progress.steps.map((step) => (
          <Link
            key={step.id}
            href={step.href}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors ${
              step.done
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                : "bg-surface-neutral-50 border-line-neutral-200 text-content-neutral-800 hover:border-accent/50 hover:bg-accent-faint/50"
            }`}
          >
            {step.done ? (
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <Circle className="w-3.5 h-3.5 text-content-neutral-400 shrink-0" />
            )}
            <span>{step.label}</span>
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(new CustomEvent("billflow:start-tour"))
          }
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1c1c1f] text-white dark:bg-white dark:text-[#111115] text-[12px] font-semibold hover:opacity-90 transition-opacity cursor-pointer"
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Take 60s Tour</span>
        </button>
        <button
          type="button"
          aria-label="Dismiss quick start"
          onClick={() => {
            dismissQuickStart(activeProfile.id);
            setDismissedForProfile(activeProfile.id);
          }}
          className="p-1.5 rounded-full text-content-neutral-400 hover:text-content-neutral-800 hover:bg-surface-neutral-100 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </section>
  );
}
