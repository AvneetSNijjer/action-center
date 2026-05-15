"use client";
import * as React from "react";
import useSWR from "swr";
import { motion } from "framer-motion";
import { ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";
import { AlertTriangle, CheckCircle2, Loader2, Info } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useStrategy } from "@/components/strategy-provider";
import { usePortfolio } from "@/components/portfolio-provider";
import { cn, formatCurrency } from "@/lib/utils";
import type { HotelRow } from "@/lib/queries/hotels";
import type { StrategyPerformanceRow, PricingConfigRow } from "@/lib/queries/strategy";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export function StrategyPerformance({
  liveKpis,
  pricingConfig,
}: {
  /** Live hotel KPIs from DB. Used as fallback for MTD occupancy/ADR. */
  liveKpis?: HotelRow | null;
  /** Live pricing config from DB. When provided, overrides ADR floor/ceiling from strategy goals. */
  pricingConfig?: PricingConfigRow | null;
}) {
  const { config } = useStrategy();
  const { activePropertyId } = usePortfolio();

  const { data: perfRes, isLoading } = useSWR<{
    ok: boolean;
    data: StrategyPerformanceRow;
  }>(
    activePropertyId ? `/api/hotels/${activePropertyId}/strategy/performance` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 }
  );

  const livePerf = perfRes?.ok ? perfRes.data : null;

  // Use live performance data, falling back to liveKpis (hotel-level) where available
  const mtdRevenue        = livePerf?.mtdRevenue ?? 0;
  const mtdOccupancy      = livePerf?.mtdOccupancy ?? (liveKpis?.occupancy ?? 0);
  const currentAdr        = livePerf?.currentAdr ?? (liveKpis?.adr ?? 0);
  const daysIntoMonth     = livePerf?.daysIntoMonth ?? 1;
  const daysInMonth       = livePerf?.daysInMonth ?? 30;
  const eomProjection     = livePerf?.forecastEomRevenue ?? 0;
  const directShare       = livePerf?.directBookingShare; // may be null
  const samples           = livePerf?.samples ?? 0;

  const g = config.goals;

  // Prefer real DB-configured floor/ceiling (truth), fall back to user strategy goals
  const adrFloor   = pricingConfig?.floorPrice   ?? g.adrFloor;
  const adrCeiling = pricingConfig?.ceilingPrice ?? g.adrCeiling;

  const revenuePct = g.monthlyRevenueTarget > 0
    ? Math.min(100, (eomProjection / g.monthlyRevenueTarget) * 100)
    : 0;
  const occPct = g.targetOccupancy > 0
    ? Math.min(100, (mtdOccupancy / g.targetOccupancy) * 100)
    : 0;
  const directPct = directShare != null && g.directBookingTarget > 0
    ? Math.min(100, (directShare / g.directBookingTarget) * 100)
    : null;
  const adrInRange = currentAdr >= adrFloor && currentAdr <= adrCeiling;
  const adrPosition = adrCeiling > adrFloor
    ? ((currentAdr - adrFloor) / (adrCeiling - adrFloor)) * 100
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Strategy Performance</CardTitle>
        <CardDescription>
          Live MTD progress toward your goals. Green = on track · Amber = close behind · Red = behind.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && !livePerf ? (
          <div className="flex h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading live performance data…
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Gauge
                label="Revenue target"
                primary={formatCurrency(eomProjection)}
                secondary={`of ${formatCurrency(g.monthlyRevenueTarget)} target`}
                pct={revenuePct}
                footnote={`MTD: ${formatCurrency(mtdRevenue)} (day ${daysIntoMonth}/${daysInMonth})`}
              />
              <Gauge
                label="Occupancy"
                primary={`${mtdOccupancy.toFixed(1)}%`}
                secondary={`of ${g.targetOccupancy}% target`}
                pct={occPct}
                footnote={`MTD running average · ${samples} nights`}
              />
              <AdrRange
                currentAdr={currentAdr}
                floor={adrFloor}
                ceiling={adrCeiling}
                position={adrPosition}
                inRange={adrInRange}
              />
              {directPct !== null ? (
                <Gauge
                  label="Direct booking"
                  primary={`${(directShare ?? 0).toFixed(1)}%`}
                  secondary={`of ${g.directBookingTarget}% target`}
                  pct={directPct}
                  footnote="Last 30-day share"
                />
              ) : (
                <DirectShareUnavailable target={g.directBookingTarget} />
              )}
            </div>
            <div className="mt-3 text-[10px] text-muted-foreground">
              Source: <code className="font-mono">daily_inventory</code> joined to{" "}
              <code className="font-mono">suggested_prices</code> · revenue = sold × rate · live DB
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function gaugeColor(pct: number) {
  if (pct >= 95) return { fill: "#10b981", label: "On track", Icon: CheckCircle2, tone: "text-emerald-600 dark:text-emerald-400" };
  if (pct >= 85) return { fill: "#f59e0b", label: "Close behind", Icon: AlertTriangle, tone: "text-amber-600 dark:text-amber-400" };
  return { fill: "#ef4444", label: "Behind", Icon: AlertTriangle, tone: "text-red-600 dark:text-red-400" };
}

function Gauge({
  label,
  primary,
  secondary,
  pct,
  footnote,
}: {
  label: string;
  primary: string;
  secondary: string;
  pct: number;
  footnote: string;
}) {
  const { fill, label: statusLabel, Icon, tone } = gaugeColor(pct);
  const data = [{ name: "x", value: pct, fill }];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-xl border border-border bg-card p-4"
    >
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        {label}
      </div>
      <div className="mt-3 flex items-center gap-4">
        <div className="h-20 w-20 shrink-0 relative">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              innerRadius="74%"
              outerRadius="100%"
              data={data}
              startAngle={90}
              endAngle={-270}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar dataKey="value" cornerRadius={6} background={{ fill: "hsl(var(--muted))" }} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center font-bold tabular-nums text-sm">
            {pct.toFixed(0)}%
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xl font-bold tabular-nums leading-tight">{primary}</div>
          <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">{secondary}</div>
          <div className={cn("inline-flex items-center gap-1 mt-2 text-[10px] font-medium", tone)}>
            <Icon className="h-3 w-3" />
            {statusLabel}
          </div>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-border text-[10px] text-muted-foreground">
        {footnote}
      </div>
    </motion.div>
  );
}

function AdrRange({
  currentAdr,
  floor,
  ceiling,
  position,
  inRange,
}: {
  currentAdr: number;
  floor: number;
  ceiling: number;
  position: number;
  inRange: boolean;
}) {
  const clampedPosition = Math.max(0, Math.min(100, position));
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1 }}
      className="rounded-xl border border-border bg-card p-4"
    >
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        ADR within range
      </div>
      <div className="mt-3">
        <div className="text-xl font-bold tabular-nums leading-tight">{formatCurrency(currentAdr)}</div>
        <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
          Floor {formatCurrency(floor)} → Ceiling {formatCurrency(ceiling)}
        </div>
      </div>
      <div className="mt-4">
        <div className="relative h-2 rounded-full bg-muted overflow-visible">
          <div className="absolute inset-y-0 left-0 right-0 rounded-full bg-gradient-to-r from-amber-200 via-emerald-300 to-amber-200 dark:from-amber-900/40 dark:via-emerald-800/40 dark:to-amber-900/40 opacity-60" />
          <motion.div
            initial={{ left: "50%" }}
            animate={{ left: `${clampedPosition}%` }}
            transition={{ type: "spring", stiffness: 200, damping: 22 }}
            className="absolute -top-1 h-4 w-4 -translate-x-1/2 rounded-full bg-foreground ring-2 ring-background shadow"
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[9px] text-muted-foreground font-mono">
          <span>{formatCurrency(floor)}</span>
          <span>{formatCurrency(ceiling)}</span>
        </div>
      </div>
      <div
        className={cn(
          "mt-3 pt-3 border-t border-border inline-flex items-center gap-1 text-[10px] font-medium",
          inRange ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
        )}
      >
        {inRange ? (
          <>
            <CheckCircle2 className="h-3 w-3" />
            Within configured range
          </>
        ) : (
          <>
            <AlertTriangle className="h-3 w-3" />
            Outside configured range
          </>
        )}
      </div>
    </motion.div>
  );
}

function DirectShareUnavailable({ target }: { target: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.15 }}
      className="rounded-xl border border-dashed border-amber-300 dark:border-amber-800/60 bg-amber-50/40 dark:bg-amber-950/15 p-4"
    >
      <div className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
        Direct booking
      </div>
      <div className="mt-3 flex items-start gap-2">
        <Info className="h-4 w-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
        <div className="min-w-0">
          <div className="text-sm font-semibold leading-tight text-amber-900 dark:text-amber-200">
            Not reported by PMS
          </div>
          <div className="text-[11px] text-amber-700 dark:text-amber-400 leading-snug mt-1">
            Booking source (direct vs OTA) is not present in this hotel&apos;s feed.
            Target was set to {target}%. Surfaces once channel data is wired in.
          </div>
        </div>
      </div>
    </motion.div>
  );
}
