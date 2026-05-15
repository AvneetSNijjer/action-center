"use client";
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutGrid, Inbox } from "lucide-react";
import { Card } from "@/components/ui/card";
import { type Property, type PropertyStatus } from "@/lib/portfolio";
import { CriticalBanner } from "@/components/portfolio/critical-banner";
import { PortfolioKpiStrip } from "@/components/portfolio/kpi-strip";
import { PropertyFilters, type StatusFilter, type PortfolioSort } from "@/components/portfolio/property-filters";
import { PropertyCard } from "@/components/portfolio/property-card";
import { usePortfolio, hotelRowToProperty } from "@/components/portfolio-provider";

const STATUS_RANK: Record<PropertyStatus, number> = {
  critical: 0,
  needs_review: 1,
  on_track: 2,
};

export function PortfolioCommandCenter() {
  const { hotels: dbHotels } = usePortfolio();
  const [status, setStatus] = React.useState<StatusFilter>("all");
  const [sort, setSort] = React.useState<PortfolioSort>("priority");

  // Convert live DB hotels to Property objects
  const properties: Property[] = React.useMemo(
    () => dbHotels.map((h) => hotelRowToProperty(h)),
    [dbHotels]
  );

  const counts = React.useMemo(() => {
    return {
      critical:     properties.filter((p) => p.status === "critical").length,
      needs_review: properties.filter((p) => p.status === "needs_review").length,
      on_track:     properties.filter((p) => p.status === "on_track").length,
    };
  }, [properties]);

  const filtered = React.useMemo(() => {
    let list: Property[] = [...properties];
    if (status !== "all") list = list.filter((p) => p.status === status);

    list.sort((a, b) => {
      if (sort === "revpar") return (b.kpis.revpar ?? 0) - (a.kpis.revpar ?? 0);
      if (sort === "actions") return b.openActions - a.openActions;
      if (sort === "name") return a.name.localeCompare(b.name);
      // priority: status first, then critical actions, then open actions
      const rd = STATUS_RANK[a.status] - STATUS_RANK[b.status];
      if (rd !== 0) return rd;
      const cd = b.criticalActions - a.criticalActions;
      if (cd !== 0) return cd;
      return b.openActions - a.openActions;
    });
    return list;
  }, [properties, status, sort]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-semibold tracking-tight">Portfolio Command Center</h1>
          <span className="rounded-full bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 px-2 py-0.5 text-[10px] font-semibold ring-1 ring-violet-200 dark:ring-violet-900/50 inline-flex items-center gap-1">
            <LayoutGrid className="h-3 w-3" />
            GROUP VIEW
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Good morning, Avneet. {counts.critical > 0 ? "You have properties that need attention today." : "All systems look healthy across the portfolio."}
        </p>
      </motion.div>

      {/* Critical banner — only renders if there are critical properties */}
      <CriticalBanner />

      {/* Portfolio KPI strip */}
      <PortfolioKpiStrip />

      {/* Properties section */}
      <div className="space-y-3">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Properties</h2>
            <p className="text-xs text-muted-foreground">
              Click any property to drill into its full Action Center.
            </p>
          </div>
        </div>

        <Card className="p-3">
          <PropertyFilters
            status={status}
            setStatus={setStatus}
            sort={sort}
            setSort={setSort}
            counts={counts}
          />
        </Card>

        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-xl border border-dashed border-border bg-card/40 p-12 text-center"
            >
              <Inbox className="mx-auto h-10 w-10 text-muted-foreground" />
              <div className="mt-3 font-medium">No properties match the current filter</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Try clearing the status filter.
              </div>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((p, i) => (
                <PropertyCard key={p.id} property={p} index={i} />
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
