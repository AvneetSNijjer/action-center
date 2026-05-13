"use client";
import { usePortfolio } from "@/components/portfolio-provider";
import { GroupAnalytics } from "@/components/analytics/group-analytics";
import { PropertyAnalytics } from "@/components/analytics/property-analytics";
import { LoadingPage } from "@/components/loading-page";

export default function AnalyticsPage() {
  const { scope, hydrated } = usePortfolio();
  if (!hydrated) return <LoadingPage />;
  return scope === "group" ? <GroupAnalytics /> : <PropertyAnalytics />;
}
