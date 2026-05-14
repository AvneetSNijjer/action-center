"use client";
import * as React from "react";
import { motion } from "framer-motion";
import { Download, FileText, Calendar, ArrowUpRight, ArrowDownRight, Loader2 } from "lucide-react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ActionToast } from "@/components/action-toast";
import { cn, formatCurrency } from "@/lib/utils";
import { usePortfolio } from "@/components/portfolio-provider";
import type { AnalyticsHeadlineData } from "@/lib/queries/analytics";

type Range = "30d" | "90d" | "365d";

const fetcher = (url: string) =>
  fetch(url).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });

interface Props {
  range: Range;
  setRange: (r: Range) => void;
  comparison: boolean;
  setComparison: (v: boolean) => void;
}

export function AnalyticsHeader({ range, setRange, comparison, setComparison }: Props) {
  const [toast, setToast] = React.useState<string | null>(null);
  const { activePropertyId, activeHotel } = usePortfolio();

  const days = range === "30d" ? 30 : range === "365d" ? 365 : 90;
  const hotelName = activeHotel?.name ?? activePropertyId ?? "Property";

  const { data: res, isLoading } = useSWR<{ ok: boolean; data: AnalyticsHeadlineData }>(
    activePropertyId
      ? `/api/hotels/${activePropertyId}/analytics/headline?days=${days}&name=${encodeURIComponent(hotelName)}`
      : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 }
  );

  const h: AnalyticsHeadlineData | null = res?.ok ? res.data : null;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
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
            {/* Top row */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {isLoading ? "Loading…" : h?.rangeLabel ?? `Last ${days} days`}
                </div>
                <h2 className="mt-1 text-xl font-semibold tracking-tight">{hotelName}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {h ? `Comparison vs ${h.compLabel}` : "Live analytics · daily_inventory"}
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
                  title="STLY not available — dataset starts Dec 2025"
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                    comparison
                      ? "border-brand-200 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 dark:border-brand-800/60"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", comparison ? "bg-brand-500" : "bg-muted-foreground/40")} />
                  Show STLY
                </button>

                <Button variant="outline" size="sm" onClick={() => showToast("PDF export coming soon")}>
                  <FileText className="h-3.5 w-3.5" />
                  Export PDF
                </Button>
              </div>
            </div>

            {/* Live headline KPIs */}
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading KPIs…
              </div>
            ) : h ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                <HeadlineKpi
                  label="RevPAR"
                  value={h.current.revpar > 0 ? formatCurrency(h.current.revpar) : "—"}
                  comp={h.comp.revpar !== null ? formatCurrency(h.comp.revpar) : null}
                  deltaPct={h.comp.revpar ? pct(h.current.revpar, h.comp.revpar) : null}
                  compLabel={h.compLabel}
                  show={comparison}
                />
                <HeadlineKpi
                  label="ADR"
                  value={h.current.adr > 0 ? formatCurrency(h.current.adr) : "—"}
                  comp={h.comp.adr !== null ? formatCurrency(h.comp.adr) : null}
                  deltaPct={h.comp.adr ? pct(h.current.adr, h.comp.adr) : null}
                  compLabel={h.compLabel}
                  show={comparison}
                />
                <HeadlineKpi
                  label="Occupancy"
                  value={h.current.occupancy > 0 ? `${h.current.occupancy.toFixed(1)}%` : "—"}
                  comp={h.comp.occupancy !== null ? `${h.comp.occupancy.toFixed(1)}%` : null}
                  deltaPct={h.comp.occupancy !== null ? h.current.occupancy - h.comp.occupancy : null}
                  compLabel={h.compLabel}
                  isPp
                  show={comparison}
                />
                <HeadlineKpi
                  label="Total revenue"
                  value={h.current.revenue > 0 ? formatCurrency(h.current.revenue) : "—"}
                  comp={h.comp.revenue !== null ? formatCurrency(h.comp.revenue) : null}
                  deltaPct={h.comp.revenue ? pct(h.current.revenue, h.comp.revenue) : null}
                  compLabel={h.compLabel}
                  show={comparison}
                />
              </div>
            ) : null}
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
  label, value, comp, deltaPct, compLabel, isPp, show,
}: {
  label: string;
  value: string;
  comp: string | null;
  deltaPct: number | null;
  compLabel: string;
  isPp?: boolean;
  show: boolean;
}) {
  const up = (deltaPct ?? 0) >= 0;
  return (
    <div className="rounded-xl bg-card/85 backdrop-blur border border-border p-3.5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums tracking-tight leading-tight">{value}</div>
      {show && deltaPct !== null && comp !== null ? (
        <div className={cn(
          "mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium",
          up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
        )}>
          {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {up ? "+" : ""}
          {isPp ? `${deltaPct.toFixed(1)} pts` : `${deltaPct.toFixed(1)}%`}
          <span className="ml-1 font-normal text-muted-foreground">vs {comp} ({compLabel})</span>
        </div>
      ) : show ? (
        <div className="mt-1.5 text-[10px] text-muted-foreground">No prior period data</div>
      ) : null}
    </div>
  );
}
