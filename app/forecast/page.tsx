"use client";
import { usePortfolio } from "@/components/portfolio-provider";
import { GroupForecast } from "@/components/forecast/group-forecast";
import { PropertyForecast } from "@/components/forecast/property-forecast";
import { LoadingPage } from "@/components/loading-page";

export default function ForecastPage() {
  const { scope, hydrated } = usePortfolio();
  if (!hydrated) return <LoadingPage />;
  return scope === "group" ? <GroupForecast /> : <PropertyForecast />;
}
