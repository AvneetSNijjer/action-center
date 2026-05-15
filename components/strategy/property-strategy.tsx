"use client";
import useSWR from "swr";
import { motion } from "framer-motion";
import { Compass } from "lucide-react";
import { StrategyModeCard } from "@/components/strategy-mode-card";
import { StrategyGoals } from "@/components/strategy-goals";
import { StrategyPerformance } from "@/components/strategy-performance";
import { StrategyImpactExplainer } from "@/components/strategy-impact-explainer";
import { DaySimulator } from "@/components/strategy/day-simulator";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { usePortfolio } from "@/components/portfolio-provider";
import type { PricingConfigRow, StrategyProfileRow } from "@/lib/queries/strategy";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

interface StrategyApiResponse {
  ok: boolean;
  data: {
    config: PricingConfigRow | null;
    profiles: StrategyProfileRow[];
  };
}

export function PropertyStrategy() {
  const { activePropertyId, activeHotel } = usePortfolio();

  const { data: strategyRes } = useSWR<StrategyApiResponse>(
    activePropertyId ? `/api/hotels/${activePropertyId}/strategy` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 }
  );

  const pricingConfig = strategyRes?.ok ? strategyRes.data.config : null;
  const strategyProfiles = strategyRes?.ok ? strategyRes.data.profiles : [];

  const property = activeHotel
    ? { name: activeHotel.name, city: activeHotel.city, state: activeHotel.state }
    : activePropertyId
    ? { name: activePropertyId, city: "", state: "" }
    : null;

  return (
    <div className="space-y-6">
      <PageBreadcrumb />
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between gap-3 flex-wrap"
      >
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Pricing Strategy</h1>
            <span className="rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 px-2 py-0.5 text-[10px] font-semibold ring-1 ring-brand-200 dark:ring-brand-800/60 inline-flex items-center gap-1">
              <Compass className="h-3 w-3" />
              ENGINE ACTIVE
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Strategy and goals for{" "}
            {property ? (
              <span className="font-medium text-foreground">{property.name}</span>
            ) : (
              "this property"
            )}
            . The pricing engine reads these every cycle.
            {pricingConfig && (
              <span className="text-muted-foreground">
                {" "}
                · Floor{" "}
                <span className="font-medium text-foreground">
                  ${pricingConfig.floorPrice.toFixed(0)}
                </span>{" "}
                / Ceiling{" "}
                <span className="font-medium text-foreground">
                  ${pricingConfig.ceilingPrice.toFixed(0)}
                </span>
              </span>
            )}
          </p>
        </div>
      </motion.div>

      <StrategyModeCard />
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <StrategyGoals pricingConfig={pricingConfig} />
        </div>
        <div className="lg:col-span-2">
          <StrategyImpactExplainer />
        </div>
      </div>
      <StrategyPerformance liveKpis={activeHotel} pricingConfig={pricingConfig} />
      <DaySimulator />
    </div>
  );
}
