"use client";
import * as React from "react";
import useSWR from "swr";
import { motion } from "framer-motion";
import {
  Sparkles,
  MapPin,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  Calendar,
  Tag,
  BarChart3,
  ChevronRight,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetHeader, SheetBody } from "@/components/ui/sheet";
import { cn, formatCurrency } from "@/lib/utils";
import { usePortfolio } from "@/components/portfolio-provider";
import type { UpcomingEventRow } from "@/lib/queries/forecast";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

/* ─── Impact palette ─────────────────────────────────────── */
const impactStyles = {
  high: {
    bg:     "from-red-50/80 to-transparent dark:from-red-950/30",
    border: "border-red-200 dark:border-red-900/50",
    badge:  "critical" as const,
    pill:   "bg-red-500",
    rankBg: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
  medium: {
    bg:     "from-amber-50/80 to-transparent dark:from-amber-950/30",
    border: "border-amber-200 dark:border-amber-900/50",
    badge:  "warning" as const,
    pill:   "bg-amber-500",
    rankBg: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  low: {
    bg:     "from-brand-50/60 to-transparent dark:from-brand-900/20",
    border: "border-brand-200 dark:border-brand-800/60",
    badge:  "info" as const,
    pill:   "bg-brand-500",
    rankBg: "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300",
  },
};

/* ─── Helpers ─────────────────────────────────────────────── */
function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch { return iso.slice(0, 10); }
}

function fmtCategory(raw: string) {
  return raw.split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function PricingRecommendation({ ratio, base, suggested }: {
  ratio: number | null;
  base: number | null;
  suggested: number | null;
}) {
  if (!ratio || !base || !suggested) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-2.5 pt-2.5 border-t border-border/60">
        <Minus className="h-3 w-3 shrink-0" />
        <span>No pricing data for this period</span>
      </div>
    );
  }
  const pct = Math.round((ratio - 1) * 100);
  const isUp   = pct > 2;
  const isDown = pct < -2;

  return (
    <div className={cn(
      "flex items-start gap-1.5 text-[11px] mt-2.5 pt-2.5 border-t border-border/60 rounded-md",
      isUp   && "text-emerald-700 dark:text-emerald-400",
      isDown && "text-red-700 dark:text-red-400",
      !isUp && !isDown && "text-muted-foreground"
    )}>
      {isUp   && <TrendingUp   className="h-3 w-3 mt-0.5 shrink-0" />}
      {isDown && <TrendingDown className="h-3 w-3 mt-0.5 shrink-0" />}
      {!isUp && !isDown && <Minus className="h-3 w-3 mt-0.5 shrink-0" />}
      <span className="font-medium">
        {isUp
          ? `Raise rates +${pct}% · engine suggests ${formatCurrency(suggested)} avg`
          : isDown
          ? `Reduce rates ${pct}% · engine suggests ${formatCurrency(suggested)} avg`
          : `Rates on target · ${formatCurrency(suggested)} avg suggested`}
      </span>
    </div>
  );
}

/* ─── Detail Sheet ────────────────────────────────────────── */
function EventDetailSheet({ event, onClose }: { event: UpcomingEventRow; onClose: () => void }) {
  const s = impactStyles[event.impact];
  const startLabel = fmtDate(event.startDate);
  const endLabel   = fmtDate(event.endDate);
  const pct        = event.pricingRatio ? Math.round((event.pricingRatio - 1) * 100) : null;

  return (
    <Sheet open onClose={onClose}>
      <SheetHeader onClose={onClose}>
        <div className="flex items-start gap-2">
          <Badge variant={s.badge} className="text-[10px] mt-0.5 shrink-0">
            <span className={cn("h-1.5 w-1.5 rounded-full mr-1", s.pill)} />
            {event.impact} impact
          </Badge>
        </div>
        <h2 className="mt-1.5 text-base font-semibold leading-snug">{event.title}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {startLabel}{startLabel !== endLabel ? ` – ${endLabel}` : ""} ·{" "}
          {event.durationDays === 1 ? "1 day" : `${event.durationDays} days`}
        </p>
      </SheetHeader>

      <SheetBody>
        {/* Event details grid */}
        <div className="grid grid-cols-2 gap-3">
          <DetailTile
            Icon={Tag}
            label="Category"
            value={fmtCategory(event.category)}
          />
          <DetailTile
            Icon={MapPin}
            label="Distance"
            value={event.distanceKm > 0 ? `${event.distanceKm.toFixed(1)} km away` : "N/A"}
          />
          <DetailTile
            Icon={BarChart3}
            label="Local demand rank"
            value={
              <span className={cn("text-sm font-bold", s.rankBg, "px-1.5 py-0.5 rounded")}>
                {event.localRank}/100
              </span>
            }
          />
          <DetailTile
            Icon={Clock}
            label="Duration"
            value={event.durationDays === 1 ? "Single day" : `${event.durationDays} nights`}
          />
          <DetailTile
            Icon={Calendar}
            label="Dates"
            value={startLabel === endLabel ? startLabel : `${startLabel} – ${endLabel}`}
          />
          <DetailTile
            Icon={Sparkles}
            label="Global rank"
            value={`${event.rank}/100`}
          />
        </div>

        {/* Labels */}
        {event.phqLabels.length > 0 && (
          <div className="mt-4">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
              Event tags
            </div>
            <div className="flex flex-wrap gap-1.5">
              {event.phqLabels.map((l) => (
                <span
                  key={l}
                  className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground capitalize"
                >
                  {l}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Pricing context */}
        <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3.5 space-y-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Pricing recommendation
          </div>

          {event.avgBaseRate && event.avgSuggestedPrice ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-background border border-border p-2.5">
                  <div className="text-[9px] uppercase tracking-wide text-muted-foreground font-medium">Base rate avg</div>
                  <div className="text-lg font-bold tabular-nums mt-0.5">
                    {formatCurrency(event.avgBaseRate)}
                  </div>
                </div>
                <div className="rounded-lg bg-background border border-border p-2.5">
                  <div className="text-[9px] uppercase tracking-wide text-muted-foreground font-medium">Engine suggests</div>
                  <div className={cn(
                    "text-lg font-bold tabular-nums mt-0.5",
                    pct && pct > 2  && "text-emerald-600 dark:text-emerald-400",
                    pct && pct < -2 && "text-red-600 dark:text-red-400",
                  )}>
                    {formatCurrency(event.avgSuggestedPrice)}
                    {pct !== null && (
                      <span className="ml-1 text-sm font-semibold">
                        ({pct > 0 ? "+" : ""}{pct}%)
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {pct !== null && pct > 10
                  ? `Strong demand signal — the pricing engine recommends increasing rates by ${pct}% for the event period.`
                  : pct !== null && pct > 2
                  ? `Mild uplift opportunity — engine suggests a ${pct}% rate increase for this period.`
                  : pct !== null && pct < -2
                  ? `Soft demand — engine recommends lowering rates by ${Math.abs(pct)}% to stimulate pickup.`
                  : "Rates are already well-calibrated for this period — no significant adjustment needed."}
                {event.localRank >= 70 && event.distanceKm <= 10
                  ? " High local rank + proximity means accommodation demand impact is likely."
                  : ""}
              </p>
            </>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              No pricing data available for {startLabel}{startLabel !== endLabel ? ` – ${endLabel}` : ""}.
              Check the pricing engine has rates configured for this period.
            </p>
          )}
        </div>

        {/* Demand signal explanation */}
        <div className="mt-3 rounded-xl border border-border bg-muted/20 p-3 text-[11px] text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground">What is local rank?</span>{" "}
          PredictHQ's local rank (0–100) measures how significant this event is relative to other
          events in the same market. A score above 70 typically drives measurable accommodation
          demand uplift within a 15km radius.
        </div>
      </SheetBody>
    </Sheet>
  );
}

function DetailTile({
  Icon,
  label,
  value,
}: {
  Icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-2.5">
      <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
        <Icon className="h-3 w-3 shrink-0" />
        {label}
      </div>
      {typeof value === "string" ? (
        <div className="text-sm font-semibold leading-tight">{value}</div>
      ) : (
        value
      )}
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────── */
export function UpcomingEvents() {
  const { activePropertyId } = usePortfolio();
  const [selectedEvent, setSelectedEvent] = React.useState<UpcomingEventRow | null>(null);

  const { data: resp, isLoading, error } = useSWR<{
    ok: boolean;
    data: UpcomingEventRow[];
  }>(
    activePropertyId ? `/api/hotels/${activePropertyId}/forecast/events` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 }
  );

  const events: UpcomingEventRow[] = resp?.ok ? resp.data : [];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-500" />
            Upcoming events — next 30 days
          </CardTitle>
          <CardDescription>
            Local events ranked by demand impact · click any card for pricing recommendation
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading upcoming events…
            </div>
          ) : error ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              Could not load events data.
            </div>
          ) : events.length === 0 ? (
            <div className="flex h-40 items-center justify-center flex-col gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-6 w-6 opacity-40" />
              <span>No events found in the next 30 days for this property.</span>
              <span className="text-[11px] text-muted-foreground/70">
                Events are sourced from PredictHQ based on hotel location.
              </span>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
              {events.map((e, i) => {
                const s = impactStyles[e.impact];
                const startLabel = fmtDate(e.startDate);
                const endLabel   = fmtDate(e.endDate);

                return (
                  <motion.button
                    key={e.eventId}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    whileHover={{ y: -2 }}
                    onClick={() => setSelectedEvent(e)}
                    className={cn(
                      "shrink-0 w-72 rounded-xl border bg-gradient-to-br p-4 text-left",
                      "transition-shadow hover:shadow-md cursor-pointer",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
                      s.bg,
                      s.border
                    )}
                  >
                    {/* Header row */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <Badge variant={s.badge} className="text-[10px]">
                        <span className={cn("h-1.5 w-1.5 rounded-full mr-1", s.pill)} />
                        {e.impact} impact
                      </Badge>
                      <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", s.rankBg)}>
                        Local {e.localRank}/100
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="font-semibold leading-snug line-clamp-2 min-h-[40px] text-sm">
                      {e.title}
                    </h3>

                    {/* Date + category */}
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {startLabel}{startLabel !== endLabel ? ` – ${endLabel}` : ""}{" "}
                      · {fmtCategory(e.category)}
                    </div>

                    {/* Key metrics row */}
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                      <MiniStat
                        Icon={MapPin}
                        label="Distance"
                        value={e.distanceKm > 0 ? `${e.distanceKm.toFixed(1)} km` : "–"}
                      />
                      <MiniStat
                        Icon={Clock}
                        label="Duration"
                        value={e.durationDays === 1 ? "1 day" : `${e.durationDays} days`}
                      />
                    </div>

                    {/* Labels */}
                    {e.phqLabels.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {e.phqLabels.slice(0, 3).map((l) => (
                          <span
                            key={l}
                            className="rounded-full bg-background/60 border border-border px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground capitalize"
                          >
                            {l}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Pricing recommendation */}
                    <PricingRecommendation
                      ratio={e.pricingRatio}
                      base={e.avgBaseRate}
                      suggested={e.avgSuggestedPrice}
                    />

                    {/* Click hint */}
                    <div className="flex items-center justify-end gap-1 mt-2 text-[10px] text-muted-foreground/70">
                      <span>Full detail</span>
                      <ChevronRight className="h-3 w-3" />
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}

          <div className="mt-3 text-[10px] text-muted-foreground">
            Source: PredictHQ events · local rank = local demand significance (0–100) ·
            pricing from <code className="font-mono">suggested_prices</code> engine
          </div>
        </CardContent>
      </Card>

      {/* Detail Sheet */}
      {selectedEvent && (
        <EventDetailSheet
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </>
  );
}

function MiniStat({ Icon, label, value }: { Icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-1.5">
      <Icon className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <div className="text-[9px] uppercase tracking-wide text-muted-foreground font-medium leading-tight">
          {label}
        </div>
        <div className="font-semibold tabular-nums leading-tight truncate">{value}</div>
      </div>
    </div>
  );
}
