"use client";

import React, { useEffect, useLayoutEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

export function NavProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  useLayoutEffect(() => {
    document
      .querySelector<HTMLElement>(".workspace-scroll")
      ?.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

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
