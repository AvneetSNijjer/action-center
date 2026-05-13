"use client";
import { usePortfolio } from "@/components/portfolio-provider";
import { PortfolioCommandCenter } from "@/components/portfolio/command-center";
import { PropertyActionCenter } from "@/components/property-action-center";

export default function HomePage() {
  const { scope, hydrated } = usePortfolio();

  // Hold render until localStorage hydration completes — avoids flashing
  // the wrong view (defaults to group, then switches to property after mount).
  if (!hydrated) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-64 rounded bg-muted" />
        <div className="h-32 rounded-xl bg-muted/60" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-muted/40" />
          ))}
        </div>
      </div>
    );
  }

  return scope === "group" ? <PortfolioCommandCenter /> : <PropertyActionCenter />;
}
