"use client";
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Inbox, ChevronLeft, Loader2, ChevronDown, Eye } from "lucide-react";
import useSWR from "swr";
import type { Insight, Severity, InsightType } from "@/lib/types";
import { StatsOverview, type ActionSummary } from "@/components/stats-overview";
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
import { splitLocation } from "@/lib/utils";
import type {
  MorningBriefingData,
  ApprovalRow,
  InsightRow,
  PublishingHealthData,
} from "@/lib/queries/action-center";

/* -------------------------------------------------------
 * Map DB InsightRow → UI Insight
 * Enriches metrics, chart, revenueImpact, and explainability
 * from the structured description text produced by the engine.
 * ------------------------------------------------------- */
const INSIGHT_TYPE_MAP: Record<string, InsightType> = {
  // Engine rule types
  competitor_rate_change:      "competitor_change",
  booking_spike:               "demand_pacing",
  booking_slowdown:            "demand_pacing",
  stale_pricing:               "stale_pricing",
  event_pricing_opportunity:   "event_alert",
  rate_position_risk:          "competitor_change",
  // DB legacy types
  competitor_change:           "competitor_change",
  event_alert:                 "event_alert",
  demand_pacing:               "demand_pacing",
  cancellation_alert:          "cancellation_alert",
  revenue_pacing:              "revenue_pacing",
  pending_approvals:           "pending_approvals",
};

/** Extract a number from a string like "$289" or "289" or "289.5" */
function extractNum(text: string, pattern: RegExp): number | null {
  const m = text.match(pattern);
  return m ? parseFloat(m[1].replace(/,/g, "")) : null;
}

function insightRowToInsight(row: InsightRow, hotelName: string): Insight {
  const score = row.confidenceScore ?? 0;
  const severity: Severity =
    score >= 0.8 ? "critical"
    : score >= 0.6 ? "warning"
    : score >= 0.4 ? "opportunity"
    : "info";

  const affectedDates: string[] = [];
  if (row.dateStart) affectedDates.push(row.dateStart);
  if (row.dateEnd && row.dateEnd !== row.dateStart) affectedDates.push(row.dateEnd);

  const desc   = row.description;
  const title  = row.title;
  const itype  = row.insightType;

  // ── Build metrics from description numbers ──────────────────
  const metrics: import("@/lib/types").Metric[] = [];
  let chart:       Insight["chart"]       = undefined;
  let revenueImpact: number | undefined   = undefined;
  let explainability: Insight["explainability"] = undefined;

  if (itype === "competitor_rate_change") {
    const prev = extractNum(desc, /\$(\d+(?:\.\d+)?) →/);
    const next = extractNum(desc, /→ \$(\d+(?:\.\d+)?)/);
    const pct  = extractNum(title, /(\d+(?:\.\d+)?)%/);
    if (prev) metrics.push({ label: "Previous rate", value: `$${prev}`, trend: "neutral" });
    if (next) metrics.push({ label: "New rate", value: `$${next}`, trend: next > (prev ?? 0) ? "up" : "down", delta: pct ? `${next > (prev ?? 0) ? "+" : "-"}${pct}%` : undefined });
    if (prev && next) {
      chart = {
        kind: "bar",
        data: [
          { name: "Previous", a: prev },
          { name: "Now", a: next },
        ],
        aLabel: "Rate ($)",
      };
      revenueImpact = next < (prev ?? 0) ? Math.round((prev - next) * -5) : undefined;
    }
    const compName = title.split(" cut ")[0] || title.split(" raised ")[0] || "Competitor";
    explainability = {
      narrative: desc,
      drivers: [
        { label: "Competitor price move", contribution: next ? (next - (prev ?? 0)) : 0, direction: next && next > (prev ?? 0) ? "up" : "down" },
        { label: "Market signal strength", contribution: Math.round(score * 20), direction: "up" },
      ],
      compSet: [
        { name: compName, price: next ?? 0, gap: 0 },
      ],
    };
  }

  else if (itype === "booking_spike" || itype === "booking_slowdown") {
    const todayPickup = extractNum(desc, /(\d+) rooms\)? is/);
    const avgPickup   = extractNum(desc, /average of (\d+(?:\.\d+)?) rooms/);
    const otb         = extractNum(desc, /OTB is (\d+) rooms/);
    const otbPct      = extractNum(desc, /\((\d+(?:\.\d+)?)% occ\)/);
    if (todayPickup) metrics.push({ label: "Today's pickup", value: `${todayPickup} rooms`, trend: itype === "booking_spike" ? "up" : "down", delta: avgPickup ? `vs avg ${avgPickup}` : undefined });
    if (otb)         metrics.push({ label: "Tonight OTB",    value: `${otb} rooms` });
    if (otbPct)      metrics.push({ label: "Occupancy",      value: `${otbPct}%`, trend: otbPct > 70 ? "up" : "down" });
    if (avgPickup)   metrics.push({ label: "7-day avg pickup", value: `${avgPickup} rooms/day` });
    if (todayPickup && avgPickup) {
      chart = {
        kind: "bar",
        data: [
          { name: "7d avg", a: avgPickup },
          { name: "Today", a: todayPickup },
        ],
        aLabel: "Rooms picked up",
      };
    }
  }

  else if (itype === "event_pricing_opportunity") {
    const attendance = extractNum(desc, /~([\d,]+) attendees/);
    const spend      = extractNum(desc, /\$([\d,.]+[KMkm]?)\s*predicted/i);
    const myRate     = extractNum(desc, /current rate.*?is \$([\d,.]+)/);
    if (attendance) metrics.push({ label: "Attendees", value: attendance.toLocaleString() });
    if (spend)      metrics.push({ label: "Pred. accommodation spend", value: `$${spend.toLocaleString()}` });
    if (myRate)     metrics.push({ label: "Your current rate", value: `$${myRate}` });
    metrics.push({ label: "Confidence", value: `${(score * 100).toFixed(0)}%`, trend: score >= 0.8 ? "up" : "neutral" });
    if (spend && myRate) {
      revenueImpact = Math.round(spend * 0.02); // rough: 2% of predicted spend
    }
    explainability = {
      narrative: desc,
      drivers: [
        { label: "Event local rank", contribution: Math.round(score * 30), direction: "up" },
        { label: "Predicted accommodation spend", contribution: spend ? Math.round(spend * 0.005) : 0, direction: "up" },
        { label: "Demand uplift signal", contribution: Math.round(score * 15), direction: "up" },
      ],
    };
  }

  else if (itype === "stale_pricing") {
    const count  = extractNum(title, /^(\d+) rate/);
    const hours  = extractNum(title, /in (\d+)h/);
    if (count) metrics.push({ label: "Stale prices", value: `${count} rates`, trend: "down" });
    if (hours) metrics.push({ label: "Hours since update", value: `${hours}h`, trend: hours > 72 ? "down" : "neutral" });
    metrics.push({ label: "Window at risk", value: "Next 7 nights" });
  }

  else if (itype === "rate_position_risk") {
    const myRate   = extractNum(desc, /You're at \$([\d,.]+)/);
    const compRate = extractNum(desc, /at \$([\d,.]+) \(/);
    const otbPct   = extractNum(desc, /OTB is only ([\d.]+)%/);
    const gapPct   = extractNum(desc, /\(([\d.]+)% below/);
    if (myRate)   metrics.push({ label: "Your rate",    value: `$${myRate}`,   trend: "down" });
    if (compRate) metrics.push({ label: "Comp rate",    value: `$${compRate}`, trend: "neutral" });
    if (gapPct)   metrics.push({ label: "Gap",          value: `-${gapPct}%`,  trend: "down", delta: "you're above market" });
    if (otbPct)   metrics.push({ label: "OTB",          value: `${otbPct}%`,   trend: otbPct < 50 ? "down" : "neutral" });
    if (myRate && compRate) {
      chart = {
        kind: "bar",
        data: [
          { name: "Competitor", a: compRate },
          { name: "You", a: myRate },
        ],
        aLabel: "Rate ($)",
      };
      const nightsAtRisk = 1;
      const capacity = 100;
      revenueImpact = myRate && compRate && otbPct
        ? Math.round((myRate - compRate) * (capacity * (1 - otbPct / 100)) * nightsAtRisk * -1)
        : undefined;
    }
    explainability = {
      narrative: desc,
      drivers: [
        { label: "Rate gap vs competitor", contribution: myRate && compRate ? -(myRate - compRate) : 0, direction: "down" },
        { label: "Low OTB risk", contribution: -Math.round(score * 20), direction: "down" },
        { label: "Days to arrival", contribution: Math.round(score * 10), direction: "up" },
      ],
    };
  }

  // Source label per type
  const SOURCE_MAP: Record<string, string> = {
    competitor_rate_change:    "competitor_rates · hotel_comp_set",
    booking_spike:             "daily_inventory · actual_pickup_last_day",
    booking_slowdown:          "daily_inventory · actual_pickup_last_day",
    stale_pricing:             "suggested_prices · updated_at",
    event_pricing_opportunity: "events · daily_hotel_demand",
    rate_position_risk:        "competitor_rates · daily_inventory",
  };

  // ── Per-type action buttons ──────────────────────────────────
  const actions: import("@/lib/types").InsightAction[] = (() => {
    switch (itype) {
      case "competitor_rate_change":
        return [
          { id: "approve", label: "Adjust my rate",   primary: true },
          { id: "snooze",  label: "Snooze 24h" },
          { id: "dismiss", label: "Dismiss" },
        ];
      case "booking_spike":
        return [
          { id: "approve", label: "Approve pricing",  primary: true },
          { id: "dismiss", label: "Dismiss" },
        ];
      case "booking_slowdown":
        return [
          { id: "review",  label: "Review strategy",  primary: true },
          { id: "snooze",  label: "Snooze 24h" },
          { id: "dismiss", label: "Dismiss" },
        ];
      case "event_pricing_opportunity":
        return [
          { id: "approve", label: "Apply event pricing", primary: true },
          { id: "snooze",  label: "Remind tomorrow" },
          { id: "dismiss", label: "Dismiss" },
        ];
      case "stale_pricing":
        return [
          { id: "approve", label: "Refresh prices",   primary: true },
          { id: "dismiss", label: "Dismiss" },
        ];
      case "rate_position_risk":
        return [
          { id: "approve", label: "Adjust rate",      primary: true },
          { id: "snooze",  label: "Snooze 24h" },
          { id: "dismiss", label: "Dismiss" },
        ];
      default:
        return [
          { id: "review",  label: "Review",  primary: true },
          { id: "dismiss", label: "Dismiss" },
        ];
    }
  })();

  return {
    id:        row.id,
    type:      INSIGHT_TYPE_MAP[itype] ?? "demand_pacing",
    severity,
    title:     row.title,
    summary:   row.description,
    body:      row.description,
    hotel:     hotelName,
    affectedDates,
    createdAt: row.createdAt,
    metrics,
    chart,
    revenueImpact,
    explainability,
    actions,
    status: "new",
    source: SOURCE_MAP[itype] ?? "Ampliphi · insights engine",
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

  // ── Action summary (real pending/approved/denied counts) ──────
  const { data: actionSummaryRes } = useSWR<{ ok: boolean; data: ActionSummary }>(
    "/api/actions/summary",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 }
  );
  const liveActionSummary = actionSummaryRes?.ok ? actionSummaryRes.data : null;

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

  const [insightLimit, setInsightLimit] = React.useState(10);

  const propertyLabel    = activeHotel?.name ?? activePropertyId ?? "Property";
  const { city: propertyCity, state: propertyState } = splitLocation(activeHotel?.location ?? "");
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
          Good morning. Here&apos;s what needs your attention at{" "}
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
        actionSummary={liveActionSummary}
      />

      {approvalsLoading && !liveApprovals ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground rounded-xl border border-border bg-card">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading pending approvals…
        </div>
      ) : (
        <PendingApprovalsWidget liveApprovals={liveApprovals} />
      )}

      {/* ── Demo read-only banner ── */}
      <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/50 px-4 py-2.5 text-xs text-amber-800 dark:text-amber-300">
        <Eye className="h-3.5 w-3.5 shrink-0" />
        <span>
          <span className="font-semibold">Demo mode</span> — approve, dismiss and snooze actions affect this session only and are not written to the database.
        </span>
      </div>

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
          {filtered.length > insightLimit && (
            <span className="text-xs text-muted-foreground">
              Showing {Math.min(insightLimit, filtered.length)} of {filtered.length}
            </span>
          )}
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
              {filtered.slice(0, insightLimit).map((insight, i) => (
                <InsightCard
                  key={insight.id}
                  insight={insight}
                  index={i}
                  onClick={() => setActive(insight)}
                  onAction={(a) => handleAction(a, insight)}
                />
              ))}
              {filtered.length > insightLimit && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => setInsightLimit((l) => l + 10)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
                >
                  <ChevronDown className="h-4 w-4" />
                  Show {Math.min(10, filtered.length - insightLimit)} more
                  <span className="text-xs opacity-60">({filtered.length - insightLimit} remaining)</span>
                </motion.button>
              )}
            </div>
          )}
        </AnimatePresence>
      </div>

      <InsightDetailPanel
        insight={active}
        hotelId={activePropertyId}
        onClose={() => setActive(null)}
        onAction={handleAction}
      />

      <ActionToast message={toast || ""} show={!!toast} />
    </div>
  );
}
