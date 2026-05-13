"use client";
import * as React from "react";
import { motion } from "framer-motion";
import { BarChart3 } from "lucide-react";
import { AnalyticsHeader } from "@/components/analytics/analytics-header";
// import { PerformanceIndices } from "@/components/analytics/performance-indices"; // TODO: re-enable when comp-set indices are clearly explained
import { KpiTrend } from "@/components/analytics/kpi-trend";
// import { ForecastAccuracy } from "@/components/analytics/forecast-accuracy"; // TODO: re-enable when forecast data is wired
import { ChannelMix } from "@/components/analytics/channel-mix";
import { SegmentMix } from "@/components/analytics/segment-mix";
import { PickupRetrospective } from "@/components/analytics/pickup-retrospective";
// import { Distributions } from "@/components/analytics/distributions"; // TODO: re-enable when lead-time/LOS data is in the DB
import { PricingAuditTrail } from "@/components/analytics/pricing-audit-trail";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { usePortfolio } from "@/components/portfolio-provider";

export function PropertyAnalytics() {
  const [range, setRange] = React.useState<"30d" | "90d" | "365d">("90d");
  const [showStly, setShowStly] = React.useState(true);
  const { activePropertyId, activeHotel } = usePortfolio();
  const property = activeHotel
    ? { name: activeHotel.name, city: activeHotel.city, state: activeHotel.state }
    : { name: activePropertyId ?? "Property", city: "", state: "" };

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
            <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
            <span className="rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 px-2 py-0.5 text-[10px] font-semibold ring-1 ring-brand-200 dark:ring-brand-800/60 inline-flex items-center gap-1">
              <BarChart3 className="h-3 w-3" />
              MONTHLY REVIEW
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Strategic performance for{" "}
            {property ? (
              <span className="font-medium text-foreground">{property.name}</span>
            ) : (
              "this property"
            )}
            . Use this for monthly ownership reporting.
          </p>
        </div>
      </motion.div>

      <AnalyticsHeader range={range} setRange={setRange} comparison={showStly} setComparison={setShowStly} />
      {/* TODO: <PerformanceIndices /> — re-enable once we explain comp-set indices clearly */}
      <KpiTrend showStly={showStly} />
      {/* TODO: <ForecastAccuracy /> — re-enable when forecast data is wired */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChannelMix />
        <SegmentMix />
      </div>
      <PickupRetrospective />
      {/* TODO: <Distributions /> — re-enable when lead-time/LOS distribution data is in the DB */}
      <PricingAuditTrail />
    </div>
  );
}
