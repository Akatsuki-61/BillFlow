import type { Metadata } from "next";
import AnalyticsView from "@/components/analytics/AnalyticsView";

export const metadata: Metadata = {
  title: "Analytics | BillFlow",
  description: "Financial performance, revenue vs expenses, collection rates, and billing alerts.",
};

export default function AnalyticsPage() {
  return <AnalyticsView />;
}
