"use client";
import * as React from "react";
import useSWR from "swr";
import { motion } from "framer-motion";
import { Sparkles, Users, MapPin, DollarSign, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";
import { usePortfolio } from "@/components/portfolio-provider";
import type { UpcomingEventRow } from "@/lib/queries/forecast";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

const impactStyles = {
  high: {
    bg: "from-red-50 to-transparent dark:from-red-950/30",
    border: "border-red-200 dark:border-red-900/50",
    badge: "critical" as const,
    pill: "bg-red-500",
  },
  medium: {
    bg: "from-amber-50 to-transparent dark:from-amber-950/30",
    border: "border-amber-200 dark:border-amber-900/50",
    badge: "warning" as const,
    pill: "bg-amber-500",
  },
  low: {
    bg: "from-brand-50 to-transparent dark:from-brand-900/30",
    border: "border-brand-200 dark:border-brand-800/60",
    badge: "info" as const,
    pill: "bg-brand-500",
  },
};

function formatEventDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function formatCategory(raw: string) {
  return raw
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function UpcomingEvents() {
  const { activePropertyId } = usePortfolio();

  const { data: resp, isLoading, error } = useSWR<{
    ok: boolean;
    data: UpcomingEventRow[];
  }>(
    `/api/hotels/${activePropertyId}/forecast/events`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 }
  );

  const events: UpcomingEventRow[] = resp?.ok ? resp.data : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-500" />
          Upcoming events — next 30 days
        </CardTitle>
        <CardDescription>
          High-impact events that should drive your pricing decisions. Sourced from PredictHQ.
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
            No events found within 30 days for this property.
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {events.map((e, i) => {
              const s = impactStyles[e.impact];
              const startLabel = formatEventDate(e.startDate);
              const endLabel = formatEventDate(e.endDate);
              return (
                <motion.div
                  key={e.eventId}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ y: -2 }}
                  className={cn(
                    "shrink-0 w-72 rounded-xl border bg-gradient-to-br p-4 transition-shadow hover:shadow-md",
                    s.bg,
                    s.border
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <Badge variant={s.badge} className="text-[10px]">
                      <span className={cn("h-1.5 w-1.5 rounded-full mr-1", s.pill)} />
                      {e.impact} impact
                    </Badge>
                    {e.localRank > 0 && (
                      <span className="text-[10px] font-semibold text-muted-foreground">
                        Rank {e.localRank}
                      </span>
                    )}
                    {e.demandFlag && (
                      <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                        ⚡ Price flag
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold leading-snug line-clamp-2 min-h-[40px]">
                    {e.title}
                  </h3>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {startLabel}
                    {startLabel !== endLabel ? ` – ${endLabel}` : ""} ·{" "}
                    {formatCategory(e.category)}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                    {e.phqAttendance > 0 && (
                      <Stat
                        Icon={Users}
                        label="Attendance"
                        value={e.phqAttendance.toLocaleString()}
                      />
                    )}
                    {e.distanceKm > 0 && (
                      <Stat
                        Icon={MapPin}
                        label="Distance"
                        value={`${e.distanceKm.toFixed(1)} km`}
                      />
                    )}
                    {e.predictedSpend > 0 && (
                      <Stat
                        Icon={DollarSign}
                        label="Predicted spend"
                        value={formatCurrency(e.predictedSpend)}
                      />
                    )}
                    {e.impactTotal !== null && e.impactTotal > 0 && (
                      <Stat
                        Icon={Sparkles}
                        label="Impact score"
                        value={`${e.impactTotal}`}
                      />
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        <div className="mt-3 text-[10px] text-muted-foreground">
          Live · events + daily_hotel_demand · PredictHQ enrichment
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ Icon, label, value }: { Icon: React.ElementType; label: string; value: string }) {
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
