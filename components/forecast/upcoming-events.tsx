"use client";
import { motion } from "framer-motion";
import { Sparkles, Users, MapPin, DollarSign, BedDouble } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UPCOMING_EVENTS } from "@/lib/forecast-data";
import { cn, formatCurrency } from "@/lib/utils";

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

export function UpcomingEvents() {
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
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
          {UPCOMING_EVENTS.map((e, i) => {
            const s = impactStyles[e.impact];
            return (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -2 }}
                className={cn(
                  "shrink-0 w-72 rounded-xl border bg-gradient-to-br p-4 transition-shadow hover:shadow-md cursor-pointer",
                  s.bg,
                  s.border
                )}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <Badge variant={s.badge} className="text-[10px]">
                    <span className={cn("h-1.5 w-1.5 rounded-full mr-1", s.pill)} />
                    {e.impact} impact
                  </Badge>
                  <span className="text-[10px] font-semibold text-muted-foreground">
                    Rank {e.localRank}
                  </span>
                </div>
                <h3 className="font-semibold leading-snug line-clamp-2 min-h-[40px]">{e.title}</h3>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {e.startDate}
                  {e.startDate !== e.endDate ? ` – ${e.endDate}` : ""} · {e.category}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                  <Stat Icon={Users} label="Attendance" value={e.attendance.toLocaleString()} />
                  <Stat Icon={MapPin} label="Distance" value={`${e.distanceKm} km`} />
                  <Stat
                    Icon={DollarSign}
                    label="Predicted spend"
                    value={formatCurrency(e.predictedSpend)}
                  />
                  <Stat
                    Icon={BedDouble}
                    label="Unsold inventory"
                    value={`${e.unsoldRoomsPct}%`}
                  />
                </div>
                <div className="mt-3 pt-3 border-t border-border/60 text-[11px] text-muted-foreground">
                  {e.venue}
                </div>
              </motion.div>
            );
          })}
        </div>
        <div className="mt-3 text-[10px] text-muted-foreground">
          Source: events · daily_hotel_demand · PredictHQ enrichment
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ Icon, label, value }: { Icon: any; label: string; value: string }) {
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
