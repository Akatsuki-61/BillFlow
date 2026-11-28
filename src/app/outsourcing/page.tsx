import OutsourcingView from "@/components/outsourcing/OutsourcingView";
import { Metadata } from "next";
import { Suspense } from "react";

// Route metadata for SEO and browser tab title
export const metadata: Metadata = {
  title: "Outsourcing | BillFlow Operations Hub",
  description: "Vendor directory, balances, and payout tracking",
};

// Dedicated /outsourcing route page
export default function OutsourcingPage() {
  return (
    <Suspense fallback={<div className="workspace-page" />}>
      <OutsourcingView />
    </Suspense>
  );
}
