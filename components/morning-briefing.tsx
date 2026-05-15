"use client";
import * as React from "react";
import { motion } from "framer-motion";
import {
  Sunrise,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  BedDouble,
  Sparkles,
  CalendarDays,
  Moon,
  Info,
  Loader2,
} from "lucide-react";
import { ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";
import type { MorningBriefingData } from "@/lib/queries/action-center";
import type { Insight } from "@/lib/types";

interface MorningBriefingProps {
  liveData?: MorningBriefingData | null;
  /** Top insights from the DB — shown in "What to look at today" */
  topInsights?: Insight[];
}

export function MorningBriefing({ liveData, topInsights = [] }: MorningBriefingProps) {
  if (!liveData) {
    return (
      <Card className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading morning briefing…
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <Card className="relative overflow-hidden border-brand-100/80 dark:border-brand-900/40">
        <div className="absolute inset-0 bg-mesh opacity-60 pointer-events-none" />

        <div className="relative p-6 space-y-6">
          {/* ── Header ─────────────────────────────────────────── */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 ring-1 ring-inset ring-amber-200/60 dark:ring-amber-900/60">
              <Sunrise className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Morning briefing
              </div>
              <div className="text-base font-semibold leading-tight">{liveData.date}</div>
            </div>
            <div className="ml-auto hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              Live DB · refreshes every 5 min
            </div>
          </div>

          {/* ── Yesterday KPIs ─────────────────────────────────── */}
          <Section
            label={`Yesterday — vs ${liveData.compLabel}`}
            hint={
              liveData.compLabel === "STLY"
                ? "Same Time Last Year"
                : `No year-ago data · using ${liveData.compLabel}`
            }
            hintIcon={liveData.compLabel !== "STLY" ? <Info className="h-3 w-3" /> : undefined}
          >
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <KpiTile
                label="RevPAR"
                value={formatCurrency(liveData.yesterday.revpar.value)}
                comp={liveData.yesterday.revpar.comp != null ? formatCurrency(liveData.yesterday.revpar.comp) : null}
                deltaPct={pctDelta(liveData.yesterday.revpar.value, liveData.yesterday.revpar.comp)}
              />
              <KpiTile
                label="ADR"
                value={formatCurrency(liveData.yesterday.adr.value)}
                comp={liveData.yesterday.adr.comp != null ? formatCurrency(liveData.yesterday.adr.comp) : null}
                deltaPct={pctDelta(liveData.yesterday.adr.value, liveData.yesterday.adr.comp)}
              />
              <KpiTile
                label="Occupancy"
                value={`${liveData.yesterday.occupancy.value.toFixed(1)}%`}
                comp={liveData.yesterday.occupancy.comp != null ? `${liveData.yesterday.occupancy.comp.toFixed(1)}%` : null}
                deltaPct={occDelta(liveData.yesterday.occupancy.value, liveData.yesterday.occupancy.comp)}
                isPercentagePoints
              />
              <KpiTile
                label="Revenue"
                value={formatCurrency(liveData.yesterday.revenue.value)}
                comp={liveData.yesterday.revenue.comp != null ? formatCurrency(liveData.yesterday.revenue.comp) : null}
                deltaPct={pctDelta(liveData.yesterday.revenue.value, liveData.yesterday.revenue.comp)}
              />
            </div>
          </Section>

          {/* ── Tonight on-the-books ───────────────────────────── */}
          <Section label="Tonight on-the-books" icon={<Moon className="h-3 w-3" />}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <StatTile
                label="Rooms sold"
                value={`${liveData.tonight.roomsSold} / ${liveData.tonight.totalRooms}`}
                Icon={BedDouble}
                accent="text-brand-600 bg-brand-50 dark:bg-brand-900/40 dark:text-brand-300"
              />
              <StatTile
                label="Occupancy"
                value={`${liveData.tonight.occupancy.toFixed(1)}%`}
                Icon={BedDouble}
                accent="text-brand-600 bg-brand-50 dark:bg-brand-900/40 dark:text-brand-300"
              />
              <StatTile
                label="ADR"
                value={formatCurrency(liveData.tonight.adr)}
                Icon={TrendingUp}
                accent="text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400"
              />
              <StatTile
                label="Revenue"
                value={formatCurrency(liveData.tonight.revenue)}
                Icon={TrendingUp}
                accent="text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400"
              />
            </div>
          </Section>

          {/* ── Month-to-date ──────────────────────────────────── */}
          <Section
            label="Month-to-date"
            icon={<CalendarDays className="h-3 w-3" />}
            hint={`Day ${liveData.mtd.daysElapsed} of ${liveData.mtd.daysInMonth} · proj. EOM at current pace`}
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <MtdGauge
                label="MTD RevPAR"
                value={liveData.mtd.revpar}
                projected={liveData.mtd.projectedRevpar}
                daysElapsed={liveData.mtd.daysElapsed}
                daysInMonth={liveData.mtd.daysInMonth}
                format={formatCurrency}
              />
              <MtdGauge
                label="MTD Occupancy"
                value={liveData.mtd.occupancy}
                projected={liveData.mtd.projectedOccupancy}
                daysElapsed={liveData.mtd.daysElapsed}
                daysInMonth={liveData.mtd.daysInMonth}
                format={(v) => `${v.toFixed(1)}%`}
              />
              <MtdGauge
                label="MTD Revenue"
                value={liveData.mtd.revenue}
                projected={liveData.mtd.projectedRevenue}
                daysElapsed={liveData.mtd.daysElapsed}
                daysInMonth={liveData.mtd.daysInMonth}
                format={formatCurrency}
              />
            </div>
          </Section>

          {/* ── Pickup 7d stat ─────────────────────────────────── */}
          {liveData.pickup7d > 0 && (
            <div className="rounded-xl bg-brand-50/60 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-900/40 px-4 py-3 flex items-center gap-3">
              <TrendingUp className="h-4 w-4 text-brand-600 dark:text-brand-300 shrink-0" />
              <span className="text-sm">
                <span className="font-semibold text-brand-700 dark:text-brand-300">
                  {liveData.pickup7d} rate review{liveData.pickup7d !== 1 ? "s" : ""}
                </span>{" "}
                <span className="text-muted-foreground">flagged by auto-publishing in the last 7 days</span>
              </span>
            </div>
          )}

          {/* ── Top insights from DB ────────────────────────────── */}
          {topInsights.length > 0 && (
            <div className="rounded-xl border border-border bg-card/80 backdrop-blur p-4">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                <Sparkles className="h-3 w-3 text-brand-500" />
                Top {topInsights.length} thing{topInsights.length !== 1 ? "s" : ""} to look at today
              </div>
              <ul className="space-y-2">
                {topInsights.map((insight, i) => (
                  <motion.li
                    key={insight.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + i * 0.07 }}
                    className="flex items-start gap-2.5 text-sm leading-relaxed"
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 text-[10px] font-bold">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <span className="font-medium text-foreground">{insight.title}</span>
                      {insight.summary && insight.summary !== insight.title && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                          {insight.summary}
                        </p>
                      )}
                    </div>
                  </motion.li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

/* ── Helpers ──────────────────────────────────────────────────── */

function pctDelta(value: number, base: number | null | undefined): number {
  if (!base) return 0;
  return ((value - base) / base) * 100;
}

function occDelta(value: number, base: number | null | undefined): number {
  return base != null ? value - base : 0;
}

function Section({
  label,
  icon,
  hint,
  hintIcon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  hint?: string;
  hintIcon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {icon}
        <span>{label}</span>
        {hint && (
          <span className="ml-auto flex items-center gap-1 text-[9px] font-normal normal-case text-muted-foreground">
            {hintIcon}
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function KpiTile({
  label,
  value,
  comp,
  deltaPct,
  isPercentagePoints,
}: {
  label: string;
  value: string;
  comp: string | null;
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
      {comp != null ? (
        <div
          className={cn(
            "mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium",
            up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
          )}
        >
          {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {up ? "+" : ""}
          {isPercentagePoints ? `${deltaPct.toFixed(1)} pts` : `${deltaPct.toFixed(1)}%`}
          <span className="ml-1 font-normal text-muted-foreground">vs {comp}</span>
        </div>
      ) : (
        <div className="mt-1.5 text-[11px] text-muted-foreground">No comparison data</div>
      )}
    </div>
  );
}

function StatTile({
  Icon,
  label,
  value,
  accent,
}: {
  Icon: React.ElementType;
  label: string;
  value: string;
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
      </div>
    </div>
  );
}

function MtdGauge({
  label,
  value,
  projected,
  daysElapsed,
  daysInMonth,
  format,
}: {
  label: string;
  value: number;
  projected: number;
  daysElapsed: number;
  daysInMonth: number;
  format: (v: number) => string;
}) {
  const pct = Math.min(100, Math.max(0, (daysElapsed / daysInMonth) * 100));
  const data = [{ name: "x", value: pct, fill: "#6366f1" }];
  return (
    <div className="rounded-xl bg-card/85 backdrop-blur border border-border p-3.5 flex items-center gap-3 transition-all hover:border-brand-200/70 dark:hover:border-brand-800/60">
      <div className="h-16 w-16 shrink-0 relative">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart innerRadius="74%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
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
        <div className="text-[10px] text-muted-foreground">
          proj. EOM{" "}
          <span className="font-semibold text-foreground">{format(projected)}</span>
        </div>
      </div>
    </div>
  );
}
