"use client";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import type { WorkspaceActivity } from "@/types/activity";
export function WorkspaceActivityPanel({
  exportsOnly = false,
}: {
  exportsOnly?: boolean;
}) {
  const [entries, setEntries] = useState<WorkspaceActivity[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const reload = () => {
      void window.billflow?.workspace
        ?.activity?.()
        .then((rows) => {
          if (active) setEntries(rows);
        })
        .catch(() => {});
    };
    const handleProfileSwitch = () => {
      if (!active) return;
      setEntries([]);
      setError("");
      reload();
    };
    const handleWorkspaceLocked = () => {
      if (!active) return;
      setEntries([]);
      setError("");
    };
    reload();
    const cleanup = window.billflow?.workspace?.onActivityChanged?.(reload);
    window.addEventListener("billflow:profile-switched", handleProfileSwitch);
    window.addEventListener("billflow:workspace-locked", handleWorkspaceLocked);
    return () => {
      active = false;
      cleanup?.();
      window.removeEventListener(
        "billflow:profile-switched",
        handleProfileSwitch,
      );
      window.removeEventListener(
        "billflow:workspace-locked",
        handleWorkspaceLocked,
      );
    };
  }, []);
  const latest = new Map<string, WorkspaceActivity>();
  for (const entry of entries)
    if (entry.kind.startsWith("pdf-") && !latest.has(entry.recordId))
      latest.set(entry.recordId, entry);
  const problems = [...latest.values()].filter(
    (entry) => entry.kind === "pdf-failed",
  );
  const pending = [...latest.values()].filter(
    (entry) => entry.kind === "pdf-pending",
  );
  if (exportsOnly && !latest.size) return null;
  const rows = exportsOnly
    ? [...latest.values()].slice(0, 10)
    : entries.slice(0, 50);
  return (
    <details
      className="ui-card group/activity p-5"
      open={exportsOnly && problems.length > 0}
    >
      <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-md text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
        <ChevronDown
          size={16}
          aria-hidden="true"
          className="shrink-0 -rotate-90 text-content-neutral-500 group-open/activity:rotate-0 motion-safe:transition-transform rtl:rotate-90"
        />
        {exportsOnly
          ? `PDF export status (${pending.length} queued, ${problems.length} failed)`
          : "Local activity history"}
      </summary>
      <div className="mt-2 space-y-3 border-t border-line-neutral-200 pt-3">
        {!exportsOnly && (
          <p className="text-xs text-content-neutral-600">
            This profile’s history includes draft requests for messages and
            local PDF activity.
          </p>
        )}
        {exportsOnly && (
          <Link href="/settings?tab=invoices" className="text-xs underline">
            Change export folder in Settings
          </Link>
        )}
        {error && (
          <p role="alert" className="text-sm mt-2">
            {error}
          </p>
        )}
        {rows.length > 0 ? (
          <ul className="divide-y divide-line-neutral-200">
            {rows.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs"
              >
                <div>
                  <strong className="font-semibold">{entry.label}</strong>
                  <p className="mt-0.5 text-content-neutral-700">
                    {entry.detail}
                  </p>
                  <time
                    dateTime={entry.createdAt}
                    className="mt-1 block text-content-neutral-600"
                  >
                    {new Date(entry.createdAt).toLocaleString()}
                  </time>
                </div>
                {exportsOnly && entry.kind !== "pdf-saved" && (
                  <button
                    className="ui-button ui-button--secondary"
                    type="button"
                    onClick={async () => {
                      setError("");
                      try {
                        await window.billflow?.invoices.exportPdf(
                          entry.recordId,
                        );
                      } catch (failure) {
                        setError(
                          failure instanceof Error
                            ? failure.message
                            : "Export failed. Check the export folder and retry.",
                        );
                      }
                    }}
                  >
                    Retry export
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-content-neutral-600">
            No activity recorded yet.
          </p>
        )}
      </div>
    </details>
  );
}
