"use client";
import { usePortfolio } from "@/components/portfolio-provider";
import { GroupStrategy } from "@/components/strategy/group-strategy";
import { PropertyStrategy } from "@/components/strategy/property-strategy";
import { LoadingPage } from "@/components/loading-page";

export default function StrategyPage() {
  const { scope, hydrated } = usePortfolio();
  if (!hydrated) return <LoadingPage />;
  return scope === "group" ? <GroupStrategy /> : <PropertyStrategy />;
}
