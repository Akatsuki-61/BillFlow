"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

export function NavProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined" || !window.billflow?.onNavigate) return;
    const unsubscribe = window.billflow.onNavigate((route) => {
      router.push(route);
    });
    return () => {
      unsubscribe();
    };
  }, [router]);

  return <>{children}</>;
}
