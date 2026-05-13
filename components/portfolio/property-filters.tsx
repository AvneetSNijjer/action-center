"use client";
import { motion } from "framer-motion";
import { ArrowUpDown, AlertOctagon, AlertTriangle, CheckCircle2, LayoutGrid } from "lucide-react";
import type { PropertyStatus } from "@/lib/portfolio";
import { cn } from "@/lib/utils";

export type StatusFilter = "all" | PropertyStatus;
export type PortfolioSort = "priority" | "revpar" | "actions" | "name";

const statusChips: {
  id: StatusFilter;
  label: string;
  Icon: any;
  dot: string;
  active: string;
}[] = [
  { id: "all", label: "All", Icon: LayoutGrid, dot: "", active: "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300" },
  { id: "critical", label: "Critical", Icon: AlertOctagon, dot: "bg-red-500", active: "border-red-500 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300" },
  { id: "needs_review", label: "Needs review", Icon: AlertTriangle, dot: "bg-amber-500", active: "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
  { id: "on_track", label: "On track", Icon: CheckCircle2, dot: "bg-emerald-500", active: "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
];

const sortOptions: { id: PortfolioSort; label: string }[] = [
  { id: "priority", label: "Priority" },
  { id: "revpar", label: "RevPAR" },
  { id: "actions", label: "Open actions" },
  { id: "name", label: "Name" },
];

export function PropertyFilters({
  status,
  setStatus,
  sort,
  setSort,
  counts,
}: {
  status: StatusFilter;
  setStatus: (s: StatusFilter) => void;
  sort: PortfolioSort;
  setSort: (s: PortfolioSort) => void;
  counts: Record<PropertyStatus, number>;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5 flex-wrap">
        {statusChips.map((chip) => {
          const isActive = status === chip.id;
          const count =
            chip.id === "all"
              ? Object.values(counts).reduce((a, b) => a + b, 0)
              : counts[chip.id as PropertyStatus];
          return (
            <motion.button
              key={chip.id}
              whileTap={{ scale: 0.97 }}
              onClick={() => setStatus(chip.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                isActive ? chip.active : "border-border bg-card hover:bg-accent text-muted-foreground"
              )}
            >
              {chip.dot ? (
                <span className={cn("h-1.5 w-1.5 rounded-full", chip.dot)} />
              ) : (
                <chip.Icon className="h-3.5 w-3.5" />
              )}
              {chip.label}
              <span
                className={cn(
                  "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold",
                  isActive ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                )}
              >
                {count}
              </span>
            </motion.button>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ArrowUpDown className="h-3.5 w-3.5" />
          Sort
        </div>
        <div className="flex items-center rounded-md border border-border bg-card p-0.5">
          {sortOptions.map((o) => (
            <button
              key={o.id}
              onClick={() => setSort(o.id)}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                sort === o.id
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
  );
}
