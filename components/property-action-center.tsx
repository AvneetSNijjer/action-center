"use client";
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Inbox, ChevronLeft, Loader2 } from "lucide-react";
import useSWR from "swr";
import type { Insight, Severity, InsightType } from "@/lib/types";
import { StatsOverview } from "@/components/stats-overview";
import { MorningBriefing } from "@/components/morning-briefing";
import { StrategyIndicator } from "@/components/strategy-indicator";
import { PendingApprovalsWidget } from "@/components/pending-approvals";
import { PublishingHealth } from "@/components/publishing-health";
import { FiltersBar, type Filters } from "@/components/filters-bar";
import { InsightCard } from "@/components/insight-card";
import { InsightDetailPanel } from "@/components/insight-detail-panel";
import { ActionToast } from "@/components/action-toast";
import { usePortfolio } from "@/components/portfolio-provider";
import { cn } from "@/lib/utils";
import type {
  MorningBriefingData,
  ApprovalRow,
  InsightRow,
  PublishingHealthData,
} from "@/lib/queries/action-center";

/* -------------------------------------------------------
 * Map DB InsightRow → UI Insight (no fake data added)
 * ------------------------------------------------------- */
const INSIGHT_TYPE_MAP: Record<string, InsightType> = {
  competitor_change:  "competitor_change",
  event_alert:        "event_alert",
  demand_pacing:      "demand_pacing",
  cancellation_alert: "cancellation_alert",
  revenue_pacing:     "revenue_pacing",
  pending_approvals:  "pending_approvals",
  stale_pricing:      "stale_pricing",
};

function insightRowToInsight(row: InsightRow, hotelName: string): Insight {
  // Derive severity from confidence score
  const score = row.confidenceScore ?? 0;
  const severity: Severity =
    score >= 0.8 ? "critical"
    : score >= 0.6 ? "warning"
    : score >= 0.4 ? "opportunity"
    : "info";

  // Collect affected dates from date range
  const affectedDates: string[] = [];
  if (row.dateStart) affectedDates.push(row.dateStart);
  if (row.dateEnd && row.dateEnd !== row.dateStart) affectedDates.push(row.dateEnd);

  return {
    id:            row.id,
    type:          INSIGHT_TYPE_MAP[row.insightType] ?? "demand_pacing",
    severity,
    title:         row.title,
    summary:       row.description,
    body:          row.description,
    hotel:         hotelName,
    affectedDates,
    createdAt:     row.createdAt,
    metrics:       [],   // DB doesn't store structured metrics
    actions: [
      { id: "review",  label: "Review",  primary: true },
      { id: "dismiss", label: "Dismiss" },
    ],
    status: "new",
    source: "Ampliphi · insights engine",
  };
}

const severityRank: Record<Severity, number> = {
  critical:    0,
  warning:     1,
  opportunity: 2,
  info:        3,
};

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export function PropertyActionCenter() {
  const { activePropertyId, activeHotel, switchToGroup } = usePortfolio();

  // ── Live morning briefing ─────────────────────────────────────
  const { data: briefingRes, isLoading: briefingLoading } = useSWR<{
    ok: boolean;
    data: MorningBriefingData;
  }>(
    activePropertyId ? `/api/hotels/${activePropertyId}/morning-briefing` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 }
  );
  const liveBriefing = briefingRes?.ok ? briefingRes.data : null;

  // ── Live pending approvals ────────────────────────────────────
  const { data: approvalsRes, isLoading: approvalsLoading } = useSWR<{
    ok: boolean;
    data: ApprovalRow[];
  }>(
    activePropertyId ? `/api/hotels/${activePropertyId}/approvals` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );
  const liveApprovals = approvalsRes?.ok ? approvalsRes.data : null;

  // ── Live insights ─────────────────────────────────────────────
  const { data: insightsRes, isLoading: insightsLoading } = useSWR<{
    ok: boolean;
    data: InsightRow[];
  }>(
    activePropertyId ? `/api/hotels/${activePropertyId}/insights` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 }
  );

  // ── Live publishing health ────────────────────────────────────
  const { data: pubHealthRes } = useSWR<{
    ok: boolean;
    data: PublishingHealthData;
  }>(
    activePropertyId ? `/api/hotels/${activePropertyId}/publishing-health` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );
  const livePublishingHealth = pubHealthRes?.ok ? pubHealthRes.data : null;

  // ── Map DB InsightRows → UI Insights ─────────────────────────
  const hotelName = activeHotel?.name ?? activePropertyId ?? "Property";
  const dbInsights: Insight[] = React.useMemo(() => {
    if (!insightsRes?.ok || !insightsRes.data.length) return [];
    return insightsRes.data.map((r) => insightRowToInsight(r, hotelName));
  }, [insightsRes, hotelName]);

  // ── Local insight state (dismiss / snooze) ───────────────────
  const [insights, setInsights] = React.useState<Insight[]>([]);
  React.useEffect(() => {
    setInsights(dbInsights);
  }, [dbInsights]);

  const [filters, setFilters] = React.useState<Filters>({
    severity: "all",
    type: "all",
    sort: "priority",
  });
  const [active, setActive] = React.useState<Insight | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  const counts = React.useMemo(() => {
    const c: Record<string, number> = { critical: 0, warning: 0, opportunity: 0, info: 0 };
    insights.forEach((i) => { c[i.severity] = (c[i.severity] || 0) + 1; });
    return c;
  }, [insights]);

  const totalRevenueImpact = React.useMemo(
    () => insights.filter((i) => (i.revenueImpact || 0) > 0).reduce((a, b) => a + (b.revenueImpact || 0), 0),
    [insights]
  );

  const filtered = React.useMemo(() => {
    let list = [...insights];
    if (filters.severity !== "all") list = list.filter((i) => i.severity === filters.severity);
    if (filters.type    !== "all") list = list.filter((i) => i.type     === filters.type);
    list.sort((a, b) => {
      if (filters.sort === "newest")
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (filters.sort === "impact")
        return Math.abs(b.revenueImpact || 0) - Math.abs(a.revenueImpact || 0);
      const sd = severityRank[a.severity] - severityRank[b.severity];
      return sd !== 0 ? sd : Math.abs(b.revenueImpact || 0) - Math.abs(a.revenueImpact || 0);
    });
    return list;
  }, [insights, filters]);

  // Top 3 insights for morning briefing "what to look at today"
  const topInsights = React.useMemo(
    () =>
      [...insights]
        .sort((a, b) => {
          const sd = severityRank[a.severity] - severityRank[b.severity];
          return sd !== 0 ? sd : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        })
        .slice(0, 3),
    [insights]
  );

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
      default:
        if (!active) setActive(insight);
        fireToast("Opening details");
    }
  };

  const propertyLabel    = activeHotel?.name  ?? activePropertyId ?? "Property";
  const propertyCity     = activeHotel?.city  ?? "";
  const propertyState    = activeHotel?.state ?? "";
  const propertyLocation = propertyCity
    ? `${propertyCity}${propertyState ? `, ${propertyState}` : ""}`
    : "";

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <motion.button
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ x: -2 }}
        onClick={switchToGroup}
        className={cn(
          "group inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors -mb-2"
        )}
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        <span>All Properties</span>
        <span className="text-muted-foreground/60">/</span>
        <span className="text-foreground font-semibold">{propertyLabel}</span>
      </motion.button>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-semibold tracking-tight">Action Center</h1>
          <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-semibold ring-1 ring-emerald-200 dark:ring-emerald-900/50">
            LIVE
          </span>
          <StrategyIndicator />
        </div>
        <p className="text-sm text-muted-foreground">
          Good morning, Avneet. Here&apos;s what needs your attention at{" "}
          <span className="font-medium text-foreground">{propertyLabel}</span>
          {propertyLocation && (
            <span className="text-muted-foreground"> · {propertyLocation}</span>
          )}
          .
        </p>
      </div>

      {briefingLoading && !liveBriefing ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground rounded-xl border border-border bg-card">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading morning briefing…
        </div>
      ) : (
        <MorningBriefing liveData={liveBriefing} topInsights={topInsights} />
      )}

      <PublishingHealth liveData={livePublishingHealth} />

      <StatsOverview
        counts={counts}
        revenueImpact={totalRevenueImpact}
        pendingApprovals={liveApprovals?.length ?? activeHotel?.pendingApprovals}
      />

      {approvalsLoading && !liveApprovals ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground rounded-xl border border-border bg-card">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading pending approvals…
        </div>
      ) : (
        <PendingApprovalsWidget liveApprovals={liveApprovals} />
      )}

      <div className="rounded-xl border border-border bg-card p-4">
        <FiltersBar filters={filters} setFilters={setFilters} counts={counts} />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {insightsLoading && !insights.length
              ? "Loading insights…"
              : `${filtered.length} insight${filtered.length === 1 ? "" : "s"}`}
          </h2>
        </div>

        <AnimatePresence mode="popLayout">
          {insightsLoading && !insights.length ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground rounded-xl border border-border bg-card/40"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              Fetching insights from DB…
            </motion.div>
          ) : filtered.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-xl border border-dashed border-border bg-card/40 p-12 text-center"
            >
              <Inbox className="mx-auto h-10 w-10 text-muted-foreground" />
              <div className="mt-3 font-medium">
                {insights.length === 0 ? "No insights in the last 30 days" : "You're all caught up"}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {insights.length === 0
                  ? "Insights appear here as the engine detects pricing opportunities."
                  : "No insights match the current filters. Try clearing them."}
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
