"use client";

import React, { Suspense } from "react";
import InvoicesView from "@/components/invoices/InvoicesView";

export default function InvoicesPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-[1280px] mx-auto px-8 py-8 animate-pulse space-y-6">
          <div className="h-10 w-48 bg-surface-neutral-200 rounded-xl" />
          <div className="h-40 bg-surface-neutral-200 rounded-2xl" />
          <div className="h-96 bg-surface-neutral-200 rounded-3xl" />
        </div>
      }
    >
      <InvoicesView />
    </Suspense>
  );
}
