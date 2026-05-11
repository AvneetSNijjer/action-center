"use client";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, AlertOctagon, AlertTriangle, Sparkles, Info, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ResponsiveContainer, AreaChart, Area, Tooltip } from "recharts";
import { ACTION_TREND } from "@/lib/mock-data";
import { cn, formatCurrency } from "@/lib/utils";

interface StatProps {
  label: string;
  value: string | number;
  delta?: string;
  trend?: "up" | "down" | "neutral";
  Icon: React.ComponentType<{ className?: string }>;
  accent: string;
  index?: number;
}

function Stat({ label, value, delta, trend, Icon, accent, index = 0 }: StatProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4, ease: "easeOut" }}
    >
      <Card className="relative overflow-hidden p-5 transition-all hover:shadow-md hover:-translate-y-0.5">
        <div className={cn("absolute inset-x-0 top-0 h-0.5", accent)} />
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {label}
            </div>
            <div className="mt-2 text-3xl font-bold tabular-nums tracking-tight">{value}</div>
            {delta && (
              <div
                className={cn(
                  "mt-2 inline-flex items-center gap-1 text-xs font-medium",
                  trend === "up" && "text-emerald-600 dark:text-emerald-400",
                  trend === "down" && "text-red-600 dark:text-red-400",
                  trend === "neutral" && "text-muted-foreground"
                )}
              >
                {trend === "up" ? <ArrowUpRight className="h-3 w-3" /> : trend === "down" ? <ArrowDownRight className="h-3 w-3" /> : null}
                {delta}
              </div>
            )}
          </div>
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", accent.replace("bg-", "bg-").replace("h-0.5", ""))}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export function StatsOverview({ counts, revenueImpact }: { counts: Record<string, number>; revenueImpact: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Stat
        index={0}
        label="Critical"
        value={counts.critical || 0}
        delta="+1 today"
        trend="down"
        Icon={AlertOctagon}
        accent="bg-red-500"
      />
      <Stat
        index={1}
        label="Warnings"
        value={counts.warning || 0}
        delta="+2 today"
        trend="neutral"
        Icon={AlertTriangle}
        accent="bg-amber-500"
      />
      <Stat
        index={2}
        label="Opportunities"
        value={counts.opportunity || 0}
        delta={`${formatCurrency(revenueImpact)} potential`}
        trend="up"
        Icon={Sparkles}
        accent="bg-emerald-500"
      />
      <Stat
        index={3}
        label="Informational"
        value={counts.info || 0}
        delta="2 queued"
        trend="neutral"
        Icon={Info}
        accent="bg-brand-500"
      />
    </div>
  );
}

export function PacingHeroCard({ revenueImpact, totalCount }: { revenueImpact: number; totalCount: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="relative overflow-hidden border-brand-100 dark:border-brand-900/50">
        <div className="absolute inset-0 bg-mesh opacity-70" />
        <div className="relative flex flex-col md:flex-row md:items-center gap-6 p-6">
          <div className="flex-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/80 dark:bg-card/80 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-brand-700 dark:text-brand-300 ring-1 ring-brand-100 dark:ring-brand-900/50">
              <TrendingUp className="h-3 w-3" /> Today&apos;s revenue opportunity
            </div>
            <h1 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">
              {formatCurrency(revenueImpact)}{" "}
              <span className="text-muted-foreground font-medium">in potential lift</span>
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              {totalCount} active insights detected across competitor moves, demand pacing, and events.
              Take action below to capture revenue and protect margin.
            </p>
          </div>
          <div className="w-full md:w-72 h-24">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ACTION_TREND} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="hero-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0066cc" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#0066cc" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip
                  contentStyle={{
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    background: "hsl(var(--popover))",
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Area type="monotone" dataKey="new" stroke="#0066cc" strokeWidth={2} fill="url(#hero-grad)" />
                <Area type="monotone" dataKey="actioned" stroke="#10b981" strokeWidth={1.5} fillOpacity={0} strokeDasharray="3 3" />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex gap-3 text-[10px] text-muted-foreground mt-1 justify-end">
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-brand-500" />New</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Actioned</span>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
