"use client";
import { motion } from "framer-motion";
import { Filter, ArrowUpDown, Sparkles, AlertOctagon, AlertTriangle, Info, Inbox } from "lucide-react";
import type { Severity, InsightType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface Filters {
  severity: Severity | "all";
  type: InsightType | "all";
  sort: "priority" | "newest" | "impact";
}

const severityChips: { id: Filters["severity"]; label: string; Icon: any; accent: string }[] = [
  { id: "all", label: "All", Icon: Inbox, accent: "" },
  { id: "critical", label: "Critical", Icon: AlertOctagon, accent: "text-red-600" },
  { id: "warning", label: "Warning", Icon: AlertTriangle, accent: "text-amber-600" },
  { id: "opportunity", label: "Opportunity", Icon: Sparkles, accent: "text-emerald-600" },
  { id: "info", label: "Info", Icon: Info, accent: "text-brand-600" },
];

const typeOptions: { id: Filters["type"]; label: string }[] = [
  { id: "all", label: "All types" },
  { id: "competitor_change", label: "Competitor" },
  { id: "event_alert", label: "Events" },
  { id: "demand_pacing", label: "Demand" },
  { id: "cancellation_alert", label: "Cancellations" },
  { id: "revenue_pacing", label: "Revenue" },
  { id: "pending_approvals", label: "Approvals" },
  { id: "stale_pricing", label: "Freshness" },
];

const sortOptions: { id: Filters["sort"]; label: string }[] = [
  { id: "priority", label: "Priority" },
  { id: "newest", label: "Newest" },
  { id: "impact", label: "Highest impact" },
];

export function FiltersBar({
  filters,
  setFilters,
  counts,
}: {
  filters: Filters;
  setFilters: (f: Filters) => void;
  counts: Record<string, number>;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {severityChips.map(({ id, label, Icon, accent }) => {
          const active = filters.severity === id;
          const count = id === "all" ? Object.values(counts).reduce((a, b) => a + b, 0) : counts[id] || 0;
          return (
            <motion.button
              key={id}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setFilters({ ...filters, severity: id })}
              className={cn(
                "relative inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                active
                  ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 shadow-sm"
                  : "border-border bg-card hover:bg-accent"
              )}
            >
              <Icon className={cn("h-3.5 w-3.5", !active && accent)} />
              {label}
              <span
                className={cn(
                  "ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold",
                  active ? "bg-brand-500 text-white" : "bg-muted text-muted-foreground"
                )}
              >
                {count}
              </span>
            </motion.button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          Type:
        </div>
        <div className="flex flex-wrap gap-1">
          {typeOptions.map((o) => (
            <button
              key={o.id}
              onClick={() => setFilters({ ...filters, type: o.id })}
              className={cn(
                "rounded-md px-2 py-1 text-xs transition-colors",
                filters.type === o.id
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-accent"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ArrowUpDown className="h-3.5 w-3.5" />
            Sort:
          </div>
          <div className="flex items-center rounded-md border border-border bg-card p-0.5">
            {sortOptions.map((o) => (
              <button
                key={o.id}
                onClick={() => setFilters({ ...filters, sort: o.id })}
                className={cn(
                  "rounded px-2 py-1 text-xs transition-colors",
                  filters.sort === o.id
                    ? "bg-brand-500 text-white"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
