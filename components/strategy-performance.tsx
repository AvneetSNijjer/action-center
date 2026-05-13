"use client";
import { motion } from "framer-motion";
import { ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";
import { TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useStrategy } from "@/components/strategy-provider";
import { STRATEGY_ACTUALS } from "@/lib/strategy";
import { cn, formatCurrency } from "@/lib/utils";
import type { HotelRow } from "@/lib/queries/hotels";

export function StrategyPerformance({
  liveKpis,
}: {
  /** Live hotel KPIs from DB. When provided, occupancy and ADR are sourced from DB. */
  liveKpis?: HotelRow | null;
}) {
  const { config } = useStrategy();
  const a = {
    ...STRATEGY_ACTUALS,
    // Override with live data if available
    mtdOccupancy: liveKpis?.occupancy ?? STRATEGY_ACTUALS.mtdOccupancy,
    currentAdr: liveKpis?.adr ?? STRATEGY_ACTUALS.currentAdr,
  };
  const g = config.goals;

  // Project end-of-month revenue at current pace
  const dailyRunRate = a.mtdRevenue / a.daysIntoMonth;
  const eomProjection = dailyRunRate * a.daysInMonth;
  const revenuePct = Math.min(100, (eomProjection / g.monthlyRevenueTarget) * 100);
  const occPct = Math.min(100, (a.mtdOccupancy / g.targetOccupancy) * 100);
  const directPct = Math.min(100, (a.directBookingShare / g.directBookingTarget) * 100);
  const adrInRange = a.currentAdr >= g.adrFloor && a.currentAdr <= g.adrCeiling;
  const adrPosition = ((a.currentAdr - g.adrFloor) / (g.adrCeiling - g.adrFloor)) * 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Strategy Performance</CardTitle>
        <CardDescription>
          Live progress toward your goals. Green = on track · Amber = close behind · Red = behind.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Gauge
            label="Revenue target"
            primary={formatCurrency(eomProjection)}
            secondary={`of ${formatCurrency(g.monthlyRevenueTarget)} target`}
            pct={revenuePct}
            footnote={`MTD: ${formatCurrency(a.mtdRevenue)} (day ${a.daysIntoMonth}/${a.daysInMonth})`}
          />
          <Gauge
            label="Occupancy"
            primary={`${a.mtdOccupancy.toFixed(1)}%`}
            secondary={`of ${g.targetOccupancy}% target`}
            pct={occPct}
            footnote="MTD running average"
          />
          <AdrRange
            currentAdr={a.currentAdr}
            floor={g.adrFloor}
            ceiling={g.adrCeiling}
            position={adrPosition}
            inRange={adrInRange}
          />
          <Gauge
            label="Direct booking"
            primary={`${a.directBookingShare.toFixed(1)}%`}
            secondary={`of ${g.directBookingTarget}% target`}
            pct={directPct}
            footnote="Last 30-day share"
          />
        </div>
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
