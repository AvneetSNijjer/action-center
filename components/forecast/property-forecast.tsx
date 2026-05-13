"use client";
import { motion } from "framer-motion";
import { LineChart as LineChartIcon } from "lucide-react";
import { DemandHeatmap } from "@/components/forecast/demand-heatmap";
import { PickupCurve } from "@/components/forecast/pickup-curve";
import { CompSetLadder } from "@/components/forecast/comp-set-ladder";
import { UpcomingEvents } from "@/components/forecast/upcoming-events";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { usePortfolio } from "@/components/portfolio-provider";
import { getProperty } from "@/lib/portfolio";

export function PropertyForecast() {
  const { activePropertyId } = usePortfolio();
  const property = getProperty(activePropertyId);
  return (
    <div className="space-y-6">
      <PageBreadcrumb />
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-end justify-between gap-3 flex-wrap"
      >
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Forecast & Demand</h1>
            <span className="rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 px-2 py-0.5 text-[10px] font-semibold ring-1 ring-brand-200 dark:ring-brand-800/60 inline-flex items-center gap-1">
              <LineChartIcon className="h-3 w-3" />
              WEEKLY PACING
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            The four views every revenue manager opens daily for{" "}
            {property ? (
              <span className="font-medium text-foreground">{property.name}</span>
            ) : (
              "this property"
            )}
            : demand heatmap, pickup pacing, comp position, and upcoming events.
          </p>
        </div>
      </motion.div>

      <DemandHeatmap />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <PickupCurve />
        <CompSetLadder />
      </div>
      <UpcomingEvents />
    </div>
  );
}
