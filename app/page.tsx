"use client";
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Inbox } from "lucide-react";
import { INSIGHTS } from "@/lib/mock-data";
import type { Insight, Severity } from "@/lib/types";
import { StatsOverview, PacingHeroCard } from "@/components/stats-overview";
import { FiltersBar, type Filters } from "@/components/filters-bar";
import { InsightCard } from "@/components/insight-card";
import { InsightDetailPanel } from "@/components/insight-detail-panel";
import { ActionToast } from "@/components/action-toast";

const severityRank: Record<Severity, number> = {
  critical: 0,
  warning: 1,
  opportunity: 2,
  info: 3,
};

export default function ActionCenterPage() {
  const [insights, setInsights] = React.useState<Insight[]>(INSIGHTS);
  const [filters, setFilters] = React.useState<Filters>({
    severity: "all",
    type: "all",
    sort: "priority",
  });
  const [active, setActive] = React.useState<Insight | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  const counts = React.useMemo(() => {
    const c: Record<string, number> = { critical: 0, warning: 0, opportunity: 0, info: 0 };
    insights.forEach((i) => {
      c[i.severity] = (c[i.severity] || 0) + 1;
    });
    return c;
  }, [insights]);

  const totalRevenueImpact = React.useMemo(
    () =>
      insights
        .filter((i) => (i.revenueImpact || 0) > 0)
        .reduce((a, b) => a + (b.revenueImpact || 0), 0),
    [insights]
  );

  const filtered = React.useMemo(() => {
    let list = [...insights];
    if (filters.severity !== "all") list = list.filter((i) => i.severity === filters.severity);
    if (filters.type !== "all") list = list.filter((i) => i.type === filters.type);
    list.sort((a, b) => {
      if (filters.sort === "newest")
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (filters.sort === "impact")
        return Math.abs(b.revenueImpact || 0) - Math.abs(a.revenueImpact || 0);
      // priority: severity first, then revenue impact
      const sd = severityRank[a.severity] - severityRank[b.severity];
      if (sd !== 0) return sd;
      return Math.abs(b.revenueImpact || 0) - Math.abs(a.revenueImpact || 0);
    });
    return list;
  }, [insights, filters]);

  const fireToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const handleAction = (actionId: string, insight: Insight) => {
    switch (actionId) {
      case "dismiss":
        setInsights((prev) => prev.filter((i) => i.id !== insight.id));
        setActive(null);
        fireToast("Insight dismissed");
        break;
      case "snooze":
        setInsights((prev) => prev.filter((i) => i.id !== insight.id));
        setActive(null);
        fireToast("Snoozed — will resurface later");
        break;
      case "approve":
        setInsights((prev) => prev.filter((i) => i.id !== insight.id));
        setActive(null);
        fireToast("Action applied · price queue updated");
        break;
      case "adjust":
      case "review":
      case "view":
      default:
        // open detail panel for review actions if not already open
        if (!active) setActive(insight);
        fireToast("Opening details");
        break;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Action Center</h1>
          <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-semibold ring-1 ring-emerald-200 dark:ring-emerald-900/50">
            LIVE
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Prioritized insights and one-click actions for The Beacon Hotel — Downtown.
        </p>
      </div>

      <PacingHeroCard revenueImpact={totalRevenueImpact} totalCount={insights.length} />

      <StatsOverview counts={counts} revenueImpact={totalRevenueImpact} />

      <div className="rounded-xl border border-border bg-card p-4">
        <FiltersBar filters={filters} setFilters={setFilters} counts={counts} />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {filtered.length} insight{filtered.length === 1 ? "" : "s"}
          </h2>
        </div>

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
              <div className="mt-3 font-medium">You&apos;re all caught up</div>
              <div className="mt-1 text-sm text-muted-foreground">
                No insights match the current filters. Try clearing them.
              </div>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {filtered.map((insight, i) => (
                <InsightCard
                  key={insight.id}
                  insight={insight}
                  index={i}
                  onClick={() => setActive(insight)}
                  onAction={(a) => handleAction(a, insight)}
                />
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>

      <InsightDetailPanel
        insight={active}
        onClose={() => setActive(null)}
        onAction={handleAction}
      />

      <ActionToast message={toast || ""} show={!!toast} />
    </div>
  );
}
