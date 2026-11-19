"use client";

import { useEffect } from "react";

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("BillFlow workspace route error:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <section
        role="alert"
        className="ui-card max-w-md w-full p-6 space-y-4 text-left"
      >
        <div className="space-y-1.5">
          <h2 className="text-base font-semibold text-content-neutral-900">
            Something went wrong in this view
          </h2>
          <p className="text-xs text-content-neutral-500 leading-relaxed">
            Your local workspace data is safe. Retry rendering this screen or
            reload the workspace to recover.
          </p>
          {error.message && (
            <p className="text-[11px] font-mono text-content-rose-600 bg-surface-rose-50 border border-line-rose-200 rounded-lg px-2.5 py-2 break-words">
              {error.message}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={reset}
            className="ui-button ui-button--primary"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="ui-button ui-button--secondary"
          >
            Reload workspace
          </button>
        </div>
      </section>
    </div>
  );
}
