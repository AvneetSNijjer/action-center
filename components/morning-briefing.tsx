"use client";
import * as React from "react";
import { motion } from "framer-motion";
import {
  Sunrise,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  LogIn,
  LogOut,
  BedDouble,
  XCircle,
  Sparkles,
  Target,
} from "lucide-react";
import { ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { MORNING_BRIEFING } from "@/lib/mock-data";
import { cn, formatCurrency } from "@/lib/utils";
import type { MorningBriefingData } from "@/lib/queries/action-center";

export function MorningBriefing({ liveData }: { liveData?: MorningBriefingData | null }) {
  // Use live data if available, otherwise fall back to mock
  const b = liveData
    ? {
        date: liveData.date,
        yesterday: {
          revpar: liveData.yesterday.revpar,
          adr: liveData.yesterday.adr,
          occupancy: liveData.yesterday.occupancy,
          revenue: liveData.yesterday.revenue,
        },
        today: {
          arrivals: MORNING_BRIEFING.today.arrivals,
          departures: MORNING_BRIEFING.today.departures,
          inHouse: MORNING_BRIEFING.today.inHouse,
          pickupLast24h: liveData.pickup7d,
          pickupVsExpected: MORNING_BRIEFING.today.pickupVsExpected,
          cancellationsLast24h: MORNING_BRIEFING.today.cancellationsLast24h,
        },
        mtd: MORNING_BRIEFING.mtd,
        topActions: MORNING_BRIEFING.topActions,
      }
    : MORNING_BRIEFING;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <Card className="relative overflow-hidden border-brand-100/80 dark:border-brand-900/40">
        {/* Subtle mesh background */}
        <div className="absolute inset-0 bg-mesh opacity-60 pointer-events-none" />

        <div className="relative p-6 space-y-6">
          {/* ---- Header ---- */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 ring-1 ring-inset ring-amber-200/60 dark:ring-amber-900/60">
              <Sunrise className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Morning briefing
              </div>
              <div className="text-base font-semibold leading-tight">{b.date}</div>
            </div>
            <div className="ml-auto hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              Generated 7:00 AM · Auto-emailed to GM
            </div>
          </div>

          {/* ---- Yesterday vs STLY ---- */}
          <Section label="Yesterday — vs Same Time Last Year">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <KpiTile
                label="RevPAR"
                value={formatCurrency(b.yesterday.revpar.value)}
                stly={formatCurrency(b.yesterday.revpar.stly)}
                deltaPct={pctDelta(b.yesterday.revpar.value, b.yesterday.revpar.stly)}
              />
              <KpiTile
                label="ADR"
                value={formatCurrency(b.yesterday.adr.value)}
                stly={formatCurrency(b.yesterday.adr.stly)}
                deltaPct={pctDelta(b.yesterday.adr.value, b.yesterday.adr.stly)}
              />
              <KpiTile
                label="Occupancy"
                value={`${b.yesterday.occupancy.value.toFixed(1)}%`}
                stly={`${b.yesterday.occupancy.stly.toFixed(1)}%`}
                deltaPct={b.yesterday.occupancy.value - b.yesterday.occupancy.stly}
                isPercentagePoints
              />
              <KpiTile
                label="Revenue"
                value={formatCurrency(b.yesterday.revenue.value)}
                stly={formatCurrency(b.yesterday.revenue.stly)}
                deltaPct={pctDelta(b.yesterday.revenue.value, b.yesterday.revenue.stly)}
              />
            </div>
          </Section>

          {/* ---- Today's operations ---- */}
          <Section label="Today's operations">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              <OpsTile
                Icon={LogIn}
                label="Arrivals"
                value={b.today.arrivals}
                accent="text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400"
              />
              <OpsTile
                Icon={LogOut}
                label="Departures"
                value={b.today.departures}
                accent="text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400"
              />
              <OpsTile
                Icon={BedDouble}
                label="In-house"
                value={b.today.inHouse}
                accent="text-brand-600 bg-brand-50 dark:bg-brand-900/40 dark:text-brand-300"
              />
              <OpsTile
                Icon={TrendingUp}
                label="Pickup 24h"
                value={`+${b.today.pickupLast24h}`}
                sub={`+${b.today.pickupVsExpected.toFixed(1)}% vs fcst`}
                accent="text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400"
              />
              <OpsTile
                Icon={XCircle}
                label="Cancellations"
                value={b.today.cancellationsLast24h}
                accent="text-red-600 bg-red-50 dark:bg-red-950/40 dark:text-red-400"
              />
            </div>
          </Section>

          {/* ---- MTD vs Target ---- */}
          <Section
            label="Month-to-date vs target"
            icon={<Target className="h-3 w-3" />}
            hint="Source: revpar_forecast_history"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <MtdGauge
                label="MTD RevPAR"
                value={b.mtd.revpar.value}
                target={b.mtd.revpar.target}
                format={formatCurrency}
              />
              <MtdGauge
                label="MTD Occupancy"
                value={b.mtd.occupancy.value}
                target={b.mtd.occupancy.target}
                format={(v) => `${v.toFixed(1)}%`}
              />
              <MtdGauge
                label="MTD ADR"
                value={b.mtd.adr.value}
                target={b.mtd.adr.target}
                format={formatCurrency}
              />
            </div>
          </Section>

          {/* ---- Top 3 things to look at ---- */}
          <div className="rounded-xl border border-border bg-card/80 backdrop-blur p-4">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              <Sparkles className="h-3 w-3 text-brand-500" />
              Top 3 things to look at today
            </div>
            <ul className="space-y-2">
              {b.topActions.map((a, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + i * 0.07 }}
                  className="flex items-start gap-2.5 text-sm leading-relaxed"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 text-[10px] font-bold">
                    {i + 1}
                  </span>
                  <span className="text-foreground">{a}</span>
                </motion.li>
              ))}
            </ul>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

/* ---------- helpers ---------- */

function Section({
  label,
  icon,
  hint,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {icon}
        <span>{label}</span>
        {hint && (
          <span className="ml-auto text-[9px] font-normal normal-case text-muted-foreground">
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function pctDelta(value: number, base: number) {
  if (!base) return 0;
  return ((value - base) / base) * 100;
}

function KpiTile({
  label,
  value,
  stly,
  deltaPct,
  isPercentagePoints,
}: {
  label: string;
  value: string;
  stly: string;
  deltaPct: number;
  isPercentagePoints?: boolean;
}) {
  const up = deltaPct >= 0;
  return (
    <div className="rounded-xl bg-card/85 backdrop-blur border border-border p-3.5 transition-all hover:border-brand-200/70 dark:hover:border-brand-800/60">
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums tracking-tight leading-tight">
        {value}
      </div>
      <div
        className={cn(
          "mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium",
          up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
        )}
      >
        {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
        {up ? "+" : ""}
        {isPercentagePoints ? `${deltaPct.toFixed(1)} pts` : `${deltaPct.toFixed(1)}%`}
        <span className="ml-1 font-normal text-muted-foreground">vs {stly}</span>
      </div>
    </div>
  );
}

function OpsTile({
  Icon,
  label,
  value,
  sub,
  accent,
}: {
  Icon: any;
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl bg-card/85 backdrop-blur border border-border p-3 flex items-center gap-2.5 transition-all hover:border-brand-200/70 dark:hover:border-brand-800/60">
      <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg shrink-0", accent)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium leading-tight">
          {label}
        </div>
        <div className="text-base font-semibold tabular-nums leading-tight">{value}</div>
        {sub && <div className="text-[10px] text-emerald-600 dark:text-emerald-400 leading-tight">{sub}</div>}
      </div>
    </div>
  );
}

function MtdGauge({
  label,
  value,
  target,
  format,
}: {
  label: string;
  value: number;
  target: number;
  format: (v: number) => string;
}) {
  const pct = Math.min(100, Math.max(0, (value / target) * 100));
  const onTrack = pct >= 95;
  const closeBehind = pct >= 85 && pct < 95;
  const color = onTrack ? "#10b981" : closeBehind ? "#f59e0b" : "#ef4444";
  const data = [{ name: "x", value: pct, fill: color }];
  return (
    <div className="rounded-xl bg-card/85 backdrop-blur border border-border p-3.5 flex items-center gap-3 transition-all hover:border-brand-200/70 dark:hover:border-brand-800/60">
      <div className="h-16 w-16 shrink-0 relative">
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
        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums">
          {pct.toFixed(0)}%
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium leading-tight">
          {label}
        </div>
        <div className="text-lg font-semibold tabular-nums leading-tight">{format(value)}</div>
        <div
          className={cn(
            "text-[10px] font-medium",
            onTrack
              ? "text-emerald-600 dark:text-emerald-400"
              : closeBehind
              ? "text-amber-600 dark:text-amber-400"
              : "text-red-600 dark:text-red-400"
          )}
        >
          of {format(target)} target
        </div>
      </div>
    </div>
  );
}
