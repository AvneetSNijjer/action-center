"use client";
import * as React from "react";
import { motion } from "framer-motion";
import { Download, FileText, Calendar, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ActionToast } from "@/components/action-toast";
import { ANALYTICS_HEADLINE, KPI_SERIES } from "@/lib/analytics-data";
import { cn, formatCurrency } from "@/lib/utils";

type Range = "30d" | "90d" | "365d";

const rangeLabels: Record<Range, string> = {
  "30d": "Apr 11 – May 11, 2026 (last 30 days)",
  "90d": "Feb 11 – May 11, 2026 (last 90 days)",
  "365d": "May 12, 2025 – May 11, 2026 (last 12 months)",
};

interface Props {
  range: Range;
  setRange: (r: Range) => void;
  comparison: boolean;
  setComparison: (v: boolean) => void;
}

export function AnalyticsHeader({ range, setRange, comparison, setComparison }: Props) {
  const [toast, setToast] = React.useState<string | null>(null);

  const h = ANALYTICS_HEADLINE;
  const deltas = {
    revpar: pct(h.current.revpar, h.stly.revpar),
    adr: pct(h.current.adr, h.stly.adr),
    occupancy: h.current.occupancy - h.stly.occupancy, // pp
    revenue: pct(h.current.revenue, h.stly.revenue),
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const exportCsv = () => {
    const header = "date,revpar,adr,occupancy,stly_revpar,stly_adr,stly_occupancy";
    const rows = KPI_SERIES.map((r) =>
      [r.date, r.revpar, r.adr, r.occupancy, r.stlyRevpar, r.stlyAdr, r.stlyOccupancy].join(",")
    );
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${range}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast("CSV downloaded");
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="relative overflow-hidden border-brand-100/80 dark:border-brand-900/40">
          <div className="absolute inset-0 bg-mesh opacity-50 pointer-events-none" />
          <div className="relative p-6 space-y-5">
            {/* Top row: title + actions */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {rangeLabels[range]}
                </div>
                <h2 className="mt-1 text-xl font-semibold tracking-tight">
                  {h.hotel}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Comp set: {h.compSetSize} hotels · Comparison vs Same Period Last Year
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* Range toggle */}
                <div className="flex items-center rounded-md border border-border bg-card p-0.5">
                  {(["30d", "90d", "365d"] as Range[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => setRange(r)}
                      className={cn(
                        "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                        range === r
                          ? "bg-brand-500 text-white"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {r === "30d" ? "30 days" : r === "90d" ? "90 days" : "12 months"}
                    </button>
                  ))}
                </div>

                {/* STLY toggle */}
                <button
                  onClick={() => setComparison(!comparison)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                    comparison
                      ? "border-brand-200 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 dark:border-brand-800/60"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      comparison ? "bg-brand-500" : "bg-muted-foreground/40"
                    )}
                  />
                  Show STLY
                </button>

                <Button variant="outline" size="sm" onClick={exportCsv}>
                  <Download className="h-3.5 w-3.5" />
                  Export CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => showToast("PDF export coming soon")}>
                  <FileText className="h-3.5 w-3.5" />
                  Export PDF
                </Button>
              </div>
            </div>

            {/* TODO: Re-enable when we have real RevPAR/ADR/Occupancy data wired up.
                Commented out per UI feedback — duplicates Morning Briefing on the home page.
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <HeadlineKpi
                label="RevPAR"
                value={formatCurrency(h.current.revpar)}
                deltaPct={deltas.revpar}
                stly={formatCurrency(h.stly.revpar)}
                show={comparison}
              />
              <HeadlineKpi
                label="ADR"
                value={formatCurrency(h.current.adr)}
                deltaPct={deltas.adr}
                stly={formatCurrency(h.stly.adr)}
                show={comparison}
              />
              <HeadlineKpi
                label="Occupancy"
                value={`${h.current.occupancy.toFixed(1)}%`}
                deltaPct={deltas.occupancy}
                stly={`${h.stly.occupancy.toFixed(1)}%`}
                isPp
                show={comparison}
              />
              <HeadlineKpi
                label="Total revenue"
                value={formatCurrency(h.current.revenue)}
                deltaPct={deltas.revenue}
                stly={formatCurrency(h.stly.revenue)}
                show={comparison}
              />
            </div>
            */}
          </div>
        </Card>
      </motion.div>
      <ActionToast message={toast || ""} show={!!toast} />
    </>
  );
}

function pct(a: number, b: number) {
  if (!b) return 0;
  return ((a - b) / b) * 100;
}

function HeadlineKpi({
  label,
  value,
  deltaPct,
  stly,
  isPp,
  show,
}: {
  label: string;
  value: string;
  deltaPct: number;
  stly: string;
  isPp?: boolean;
  show: boolean;
}) {
  const up = deltaPct >= 0;
  return (
    <div className="rounded-xl bg-card/85 backdrop-blur border border-border p-3.5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums tracking-tight leading-tight">
        {value}
      </div>
      {show && (
        <div
          className={cn(
            "mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium",
            up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
          )}
        >
          {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {up ? "+" : ""}
          {isPp ? `${deltaPct.toFixed(1)} pts` : `${deltaPct.toFixed(1)}%`}
          <span className="ml-1 font-normal text-muted-foreground">vs {stly}</span>
        </div>
      )}
    </div>
  );
}
