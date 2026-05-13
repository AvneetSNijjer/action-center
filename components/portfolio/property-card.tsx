"use client";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowUpRight, ArrowDownRight, AlertOctagon, MapPin } from "lucide-react";
import { ResponsiveContainer, LineChart, Line } from "recharts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePortfolio } from "@/components/portfolio-provider";
import { getMode } from "@/lib/strategy";
import { STATUS_META, type Property } from "@/lib/portfolio";
import { cn, formatCurrency } from "@/lib/utils";

export function PropertyCard({ property, index = 0 }: { property: Property; index?: number }) {
  const router = useRouter();
  const { setActiveProperty } = usePortfolio();
  const status = STATUS_META[property.status];
  const mode = getMode(property.strategyMode);
  const ModeIcon = mode.icon;
  const paceUp = property.kpis.paceVsStly >= 0;

  const handleDrillDown = () => {
    setActiveProperty(property.id, { switchToProperty: true });
    router.push("/");
  };

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      whileHover={{ y: -3 }}
      onClick={handleDrillDown}
      className="text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-xl"
    >
      <Card className="relative overflow-hidden h-full transition-shadow hover:shadow-lg">
        {/* Top status stripe */}
        <div className={cn("absolute top-0 left-0 right-0 h-1", status.stripe)} />

        <div className="p-5 pt-6 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold leading-tight tracking-tight group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors">
                {property.name}
              </h3>
              <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {property.city}, {property.state} · {property.rooms} rooms
                </span>
              </div>
            </div>
            <Badge variant={status.badge} className="text-[10px] shrink-0">
              {status.label}
            </Badge>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-3 gap-3">
            <Kpi label="OCC" value={`${property.kpis.occupancy}%`} />
            <Kpi label="ADR" value={formatCurrency(property.kpis.adr)} />
            <Kpi label="REVPAR" value={formatCurrency(property.kpis.revpar)} />
          </div>

          {/* Occupancy bar */}
          <div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${property.kpis.occupancy}%` }}
                transition={{ duration: 0.6, delay: 0.15 + index * 0.04, ease: "easeOut" }}
                className={cn("h-full rounded-full", status.stripe)}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 font-medium",
                  paceUp ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                )}
              >
                {paceUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {paceUp ? "+" : ""}
                {property.kpis.paceVsStly.toFixed(1)}% vs STLY
              </span>
              <span className="text-muted-foreground">
                {formatCurrency(property.kpis.revenueMtd)} MTD
              </span>
            </div>
          </div>

          {/* Sparkline + strategy mode */}
          <div className="flex items-center gap-3 pt-3 border-t border-border">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-md shrink-0",
                  mode.accent.bg,
                  mode.accent.text
                )}
              >
                <ModeIcon className="h-3 w-3" />
              </span>
              <span className="text-[10px] text-muted-foreground truncate">{mode.label}</span>
            </div>
            <div className="h-7 w-20 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={property.revparTrend.map((v, i) => ({ i, v }))}>
                  <Line
                    type="monotone"
                    dataKey="v"
                    stroke={
                      property.status === "critical"
                        ? "#ef4444"
                        : property.status === "needs_review"
                        ? "#f59e0b"
                        : "#10b981"
                    }
                    strokeWidth={1.75}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Open actions footer */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
              <span className="font-medium">
                {property.openActions} open action{property.openActions === 1 ? "" : "s"}
              </span>
              {property.criticalActions > 0 && (
                <span className="inline-flex items-center gap-0.5 ml-1 text-red-600 dark:text-red-400 font-semibold">
                  <AlertOctagon className="h-3 w-3" />
                  {property.criticalActions} critical
                </span>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors">
              Drill in →
            </span>
          </div>
        </div>
      </Card>
    </motion.button>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground">
        {label}
      </div>
      <div className="text-lg font-bold tabular-nums leading-tight">{value}</div>
    </div>
  );
}
