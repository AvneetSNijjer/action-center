"use client";
import { motion } from "framer-motion";
import {
  Percent,
  DollarSign,
  TrendingUp,
  Wallet,
  AlertOctagon,
  ArrowUpRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { PORTFOLIO_ROLLUP } from "@/lib/portfolio";
import { cn, formatCurrency } from "@/lib/utils";

export function PortfolioKpiStrip() {
  const r = PORTFOLIO_ROLLUP;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <Kpi
        index={0}
        Icon={Percent}
        label="Portfolio Occupancy"
        value={`${r.occupancy.toFixed(1)}%`}
        delta={`+${r.occupancyDeltaLy.toFixed(1)} pts vs LY`}
        accent="bg-emerald-500"
      />
      <Kpi
        index={1}
        Icon={DollarSign}
        label="Portfolio ADR"
        value={formatCurrency(r.adr)}
        delta={`+${formatCurrency(r.adrDeltaLy)} vs LY`}
        accent="bg-brand-500"
      />
      <Kpi
        index={2}
        Icon={TrendingUp}
        label="Portfolio RevPAR"
        value={formatCurrency(r.revpar)}
        delta={`+${r.revparDeltaLy.toFixed(1)}% vs LY`}
        accent="bg-violet-500"
      />
      <Kpi
        index={3}
        Icon={Wallet}
        label="Total Revenue (MTD)"
        value={compactMoney(r.revenueMtd)}
        delta={`+${r.revenueToBudget}% to budget`}
        accent="bg-indigo-500"
      />
      <Kpi
        index={4}
        Icon={AlertOctagon}
        label="Open Actions"
        value={String(r.openActions)}
        delta={`${r.criticalActions} critical`}
        accent={r.criticalActions > 0 ? "bg-red-500" : "bg-amber-500"}
        deltaTone={r.criticalActions > 0 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}
      />
    </div>
  );
}

function compactMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return formatCurrency(n);
}

function Kpi({
  Icon,
  label,
  value,
  delta,
  accent,
  deltaTone,
  index = 0,
}: {
  Icon: any;
  label: string;
  value: string;
  delta: string;
  accent: string;
  deltaTone?: string;
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Card className="relative overflow-hidden p-4 h-full transition-all hover:shadow-md hover:-translate-y-0.5">
        <div className={cn("absolute top-0 inset-x-0 h-0.5", accent)} />
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {label}
            </div>
            <div className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight leading-tight">
              {value}
            </div>
            <div
              className={cn(
                "mt-1 inline-flex items-center gap-1 text-[11px] font-medium",
                deltaTone || "text-emerald-600 dark:text-emerald-400"
              )}
            >
              {!deltaTone && <ArrowUpRight className="h-3 w-3" />}
              {delta}
            </div>
          </div>
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg text-white shrink-0",
              accent
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
