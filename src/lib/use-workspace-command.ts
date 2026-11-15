"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

// Consume successful commands so the same action can be opened again.
export function useWorkspaceCommand(
  parameter: string,
  run: (value: string) => boolean,
) {
  const value = useSearchParams().get(parameter);
  useEffect(() => {
    if (!value) return;
    const timer = setTimeout(() => {
      const url = new URL(window.location.href);
      if (url.searchParams.get(parameter) !== value || !run(value)) return;
      url.searchParams.delete(parameter);
      window.history.replaceState(null, "", url);
    }, 0);
    return () => clearTimeout(timer);
  }, [parameter, run, value]);
}
