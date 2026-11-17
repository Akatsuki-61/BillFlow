"use client";
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
    reload();
    const cleanup = window.billflow?.workspace?.onActivityChanged?.(reload);
    return () => {
      active = false;
      cleanup?.();
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
      className="ui-card p-4 my-4"
      open={exportsOnly && problems.length > 0}
    >
      <summary className="cursor-pointer text-sm font-medium">
        {exportsOnly
          ? `PDF export status (${pending.length} queued, ${problems.length} failed)`
          : "Local activity history"}
      </summary>
      {!exportsOnly && (
        <p className="text-xs text-text-secondary mt-2">
          Message entries record a draft request, not delivery confirmation.
          This history stays in this profile.
        </p>
      )}
      {exportsOnly && (
        <a href="/settings" className="text-xs underline">
          Change export folder in Settings
        </a>
      )}
      {error && (
        <p role="alert" className="text-sm mt-2">
          {error}
        </p>
      )}
      <ul className="space-y-3 mt-3">
        {rows.map((entry) => (
          <li
            key={entry.id}
            className="text-xs flex flex-wrap items-center justify-between gap-2"
          >
            <div>
              <strong>{entry.label}</strong> · {entry.detail}
              <br />
              <time dateTime={entry.createdAt} className="text-text-secondary">
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
                    await window.billflow?.invoices.exportPdf(entry.recordId);
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
      {!rows.length && (
        <p className="text-xs mt-2">No activity recorded yet.</p>
      )}
    </details>
  );
}
