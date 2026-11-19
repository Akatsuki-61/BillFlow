"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("BillFlow global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif",
          backgroundColor: "#f8fafc",
          color: "#0f172a",
        }}
      >
        <section
          role="alert"
          style={{
            maxWidth: "420px",
            width: "100%",
            backgroundColor: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
          }}
        >
          <h2 style={{ margin: "0 0 8px", fontSize: "17px", fontWeight: 600 }}>
            BillFlow ran into a display error
          </h2>
          <p
            style={{
              margin: "0 0 14px",
              fontSize: "13px",
              lineHeight: 1.5,
              color: "#475569",
            }}
          >
            Your saved invoices, tasks, and backups are untouched on disk. Retry
            now or reload the application window.
          </p>
          {error.message && (
            <p
              style={{
                margin: "0 0 16px",
                fontSize: "12px",
                fontFamily: "monospace",
                color: "#9f1239",
                backgroundColor: "#fff1f2",
                border: "1px solid #fecdd3",
                borderRadius: "8px",
                padding: "8px 10px",
                wordBreak: "break-word",
              }}
            >
              {error.message}
            </p>
          )}
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              onClick={reset}
              style={{
                padding: "8px 14px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: "#0f172a",
                color: "#ffffff",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: "8px 14px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                backgroundColor: "#ffffff",
                color: "#0f172a",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Reload BillFlow
            </button>
          </div>
        </section>
      </body>
    </html>
  );
}
