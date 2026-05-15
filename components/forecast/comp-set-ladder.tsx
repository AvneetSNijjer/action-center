"use client";
import * as React from "react";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp, Loader2, AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";
import { usePortfolio } from "@/components/portfolio-provider";
import type { CompSetRow } from "@/lib/queries/forecast";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

/* ── colour helpers ── */
function gapVariant(gap: number | null): "critical" | "warning" | "opportunity" | "secondary" {
  if (gap === null) return "secondary";
  if (gap > 15)  return "warning";     // you're expensive
  if (gap < -15) return "opportunity"; // you're a steal
  if (gap > 8)   return "warning";
  return "secondary";
}

function positionBarColor(rank: number, total: number) {
  const pct = rank / total;
  if (pct <= 0.25) return "bg-emerald-500";   // cheapest tier — green
  if (pct <= 0.5)  return "bg-emerald-400";
  if (pct <= 0.75) return "bg-amber-400";
  return "bg-red-500";                         // most expensive tier
}

function gapTextColor(gap: number | null) {
  if (gap === null) return "";
  if (gap > 10)  return "text-amber-600 dark:text-amber-400";
  if (gap < -10) return "text-emerald-600 dark:text-emerald-400";
  return "text-foreground";
}

export function CompSetLadder() {
  const { activePropertyId } = usePortfolio();
  const [expandedDate, setExpandedDate] = React.useState<string | null>(null);

  const { data: resp, isLoading, error } = useSWR<{ ok: boolean; data: CompSetRow[] }>(
    `/api/hotels/${activePropertyId}/forecast/comp-set`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 }
  );

  const rows: CompSetRow[] = resp?.ok ? resp.data : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comp-set rate ladder · next 7 nights</CardTitle>
        <CardDescription>
          Your position vs the comp set. Tap any night to see all competitors.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading comp-set rates…
          </div>
        ) : error ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            Could not load comp-set data.
          </div>
        ) : rows.length === 0 ? (
          <div className="flex h-48 items-center justify-center flex-col gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-5 w-5 opacity-40" />
            No competitor rate data for this property.
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((row, i) => {
              const allRates = row.competitors
                .filter((c) => c.rate !== null)
                .map((c) => c.rate as number)
                .sort((a, b) => a - b);

              const minRate = allRates[0] ?? 0;
              const maxRate = allRates[allRates.length - 1] ?? 0;
              const range   = maxRate - minRate || 1;

              // Find my rank among ALL (including me)
              const myRank = row.myRate !== null
                ? allRates.filter((r) => r <= row.myRate!).length
                : null;

              const isExpanded = expandedDate === row.date;
              const outlier    = row.gap !== null && Math.abs(row.gap) > 10;
              const isAbove    = (row.gap ?? 0) > 0;

              const dateLabel = new Date(row.date + "T00:00:00Z").toLocaleDateString("en-US", {
                month: "short", day: "numeric", timeZone: "UTC",
              });

              return (
                <motion.div
                  key={row.date}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={cn(
                    "rounded-xl border border-border bg-card overflow-hidden transition-shadow",
                    outlier && isAbove   && "border-amber-300 dark:border-amber-800/60",
                    outlier && !isAbove  && "border-emerald-300 dark:border-emerald-800/60",
                    isExpanded           && "shadow-md"
                  )}
                >
                  {/* ── Summary row (always visible) ── */}
                  <button
                    onClick={() => setExpandedDate(isExpanded ? null : row.date)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center gap-3 px-4 py-3">
                      {/* Date */}
                      <div className="w-16 shrink-0">
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {row.dow}
                        </div>
                        <div className="text-sm font-bold leading-tight">{dateLabel}</div>
                      </div>

                      {/* Your rate */}
                      <div className="w-20 shrink-0">
                        <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                          Your rate
                        </div>
                        <div className="text-base font-bold tabular-nums font-mono">
                          {row.myRate !== null ? formatCurrency(row.myRate) : "—"}
                        </div>
                      </div>

                      {/* Position bar */}
                      <div className="flex-1 min-w-0">
                        <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>{formatCurrency(minRate)}</span>
                          <span className="font-medium">
                            {myRank !== null ? `#${myRank} of ${allRates.length}` : ""}
                          </span>
                          <span>{formatCurrency(maxRate)}</span>
                        </div>
                        <div className="relative h-2 rounded-full bg-muted overflow-visible">
                          {/* comp dots */}
                          {row.competitors
                            .filter((c) => !c.isMyHotel && c.rate !== null)
                            .map((c) => (
                              <div
                                key={c.name}
                                className="absolute top-0 h-2 w-2 -translate-x-1/2 rounded-full bg-muted-foreground/40"
                                style={{ left: `${((c.rate! - minRate) / range) * 100}%` }}
                                title={`${c.name}: ${formatCurrency(c.rate!)}`}
                              />
                            ))}
                          {/* my position dot */}
                          {row.myRate !== null && (
                            <div
                              className={cn(
                                "absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white dark:ring-card shadow-sm",
                                myRank !== null
                                  ? positionBarColor(myRank, allRates.length)
                                  : "bg-brand-500"
                              )}
                              style={{ left: `${((row.myRate - minRate) / range) * 100}%` }}
                              title={`You: ${formatCurrency(row.myRate)}`}
                            />
                          )}
                        </div>
                      </div>

                      {/* Gap badge */}
                      <div className="w-24 shrink-0 flex flex-col items-end gap-1">
                        {row.gap !== null ? (
                          <Badge
                            variant={gapVariant(row.gap)}
                            className="font-mono text-[10px] tabular-nums"
                          >
                            {isAbove ? (
                              <TrendingUp className="h-3 w-3 mr-0.5" />
                            ) : (
                              <TrendingDown className="h-3 w-3 mr-0.5" />
                            )}
                            {row.gap > 0 ? "+" : ""}
                            {row.gap.toFixed(1)}% median
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">no data</span>
                        )}
                        {row.median !== null && (
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            med. {formatCurrency(row.median)}
                          </span>
                        )}
                      </div>

                      {/* Expand chevron */}
                      <div className="text-muted-foreground shrink-0 ml-1">
                        {isExpanded
                          ? <ChevronUp className="h-4 w-4" />
                          : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </div>
                  </button>

                  {/* ── Expanded competitor detail ── */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        key="detail"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-border px-4 pb-3 pt-2 space-y-1.5">
                          {[...row.competitors]
                            .sort((a, b) => (a.rate ?? 9999) - (b.rate ?? 9999))
                            .map((c) => {
                              const compGap =
                                c.rate !== null && row.median !== null
                                  ? ((c.rate - row.median) / row.median) * 100
                                  : null;
                              const isMe = c.isMyHotel;
                              return (
                                <div
                                  key={c.name}
                                  className={cn(
                                    "flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm",
                                    isMe
                                      ? "bg-brand-50 dark:bg-brand-900/20 ring-1 ring-brand-200 dark:ring-brand-800/40"
                                      : "bg-muted/30"
                                  )}
                                >
                                  {/* color bar */}
                                  <div
                                    className="h-3 w-1.5 rounded-full shrink-0"
                                    style={{
                                      background: c.rate !== null
                                        ? `hsl(${
                                            120 - Math.min(120, ((c.rate - minRate) / range) * 120)
                                          } 65% 45%)`
                                        : "hsl(var(--muted-foreground))",
                                    }}
                                  />

                                  <span className={cn("flex-1 truncate text-[12px]", isMe && "font-semibold")}>
                                    {c.name}
                                    {isMe && (
                                      <span className="ml-1.5 text-[10px] text-brand-600 dark:text-brand-400 font-normal">
                                        (you)
                                      </span>
                                    )}
                                  </span>

                                  {c.hotelClass && (
                                    <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:block">
                                      {c.hotelClass}
                                    </span>
                                  )}

                                  <span className="font-mono font-semibold tabular-nums text-[13px] shrink-0">
                                    {c.rate !== null ? formatCurrency(c.rate) : "—"}
                                  </span>

                                  {compGap !== null && !isMe && (
                                    <span
                                      className={cn(
                                        "text-[10px] tabular-nums w-14 text-right shrink-0",
                                        gapTextColor(compGap)
                                      )}
                                    >
                                      {compGap > 0 ? "+" : ""}
                                      {compGap.toFixed(1)}%
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-emerald-500" /> Cheapest position
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-amber-400" /> Mid-range
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-500" /> Most expensive
          </span>
          <span className="ml-auto">Live · competitor_rates · hotel_comp_set</span>
        </div>
      </CardContent>
    </Card>
  );
}
