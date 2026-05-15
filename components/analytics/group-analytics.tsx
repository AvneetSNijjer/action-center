"use client";
import * as React from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { BarChart3, ArrowUpRight, ArrowDownRight, ChevronRight, Layers, Trophy, AlertTriangle } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { STATUS_META, type Property } from "@/lib/portfolio";
import { CHANNEL_MIX } from "@/lib/analytics-data";
import { usePortfolio, hotelRowToProperty } from "@/components/portfolio-provider";
import { cn, formatCurrency } from "@/lib/utils";

const channels = [
  { key: "direct", label: "Direct", color: "#0066cc" },
  { key: "bookingcom", label: "Booking.com", color: "#6366f1" },
  { key: "expedia", label: "Expedia", color: "#8b5cf6" },
  { key: "walkin", label: "Walk-in", color: "#64748b" },
  { key: "other", label: "Other OTAs", color: "#94a3b8" },
] as const;

type SortKey = "name" | "occupancy" | "adr" | "revpar" | "revenue" | "pace" | "accuracy";

export function GroupAnalytics() {
  const router = useRouter();
  const { hotels: dbHotels, setActiveProperty } = usePortfolio();
  const [sortKey, setSortKey] = React.useState<SortKey>("revpar");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");

  // Convert DB hotels to Property objects for display
  const properties: Property[] = React.useMemo(
    () => dbHotels.map((h) => hotelRowToProperty(h)),
    [dbHotels]
  );

  const sorted = React.useMemo(() => {
    const list = [...properties];
    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      const va = pick(a, sortKey);
      const vb = pick(b, sortKey);
      if (typeof va === "string") return va.localeCompare(vb as string) * dir;
      return ((va as number) - (vb as number)) * dir;
    });
    return list;
  }, [properties, sortKey, sortDir]);

  const best  = [...properties].sort((a, b) => (b.kpis.revpar ?? 0) - (a.kpis.revpar ?? 0))[0];
  const worst = [...properties].sort((a, b) => (a.kpis.occupancy ?? 0) - (b.kpis.occupancy ?? 0))[0];

  const toggle = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  };

  const drillIn = (id: string) => {
    setActiveProperty(id, { switchToProperty: true });
    router.push("/analytics");
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <span className="rounded-full bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 px-2 py-0.5 text-[10px] font-semibold ring-1 ring-violet-200 dark:ring-violet-900/50 inline-flex items-center gap-1">
            <Layers className="h-3 w-3" />
            GROUP ANALYTICS
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Portfolio-level performance for ownership reporting. Drill into any property for its
          full analytics suite.
        </p>
      </motion.div>

      {/* TODO: Re-enable portfolio rollup KPI hero once real data is wired.
          Commented out per UI feedback — duplicates the Action Center Morning Briefing.
      <Card className="relative overflow-hidden border-brand-100/80 dark:border-brand-900/40">
        <div className="absolute inset-0 bg-mesh opacity-50 pointer-events-none" />
        <div className="relative p-6 space-y-5">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {HOTEL_GROUP.name}
            </div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">
              {HOTEL_GROUP.properties.length} properties · {PORTFOLIO_ROLLUP.totalRooms.toLocaleString()} rooms
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Feb 11 – May 11, 2026 (last 90 days) · vs Same Period Last Year
            </p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <PortfolioKpi label="RevPAR" value={formatCurrency(PORTFOLIO_ROLLUP.revpar)} delta={`+${PORTFOLIO_ROLLUP.revparDeltaLy.toFixed(1)}%`} up />
            <PortfolioKpi label="ADR" value={formatCurrency(PORTFOLIO_ROLLUP.adr)} delta={`+${formatCurrency(PORTFOLIO_ROLLUP.adrDeltaLy)}`} up />
            <PortfolioKpi label="Occupancy" value={`${PORTFOLIO_ROLLUP.occupancy.toFixed(1)}%`} delta={`+${PORTFOLIO_ROLLUP.occupancyDeltaLy.toFixed(1)} pts`} up />
            <PortfolioKpi label="Revenue MTD" value={compactMoney(PORTFOLIO_ROLLUP.revenueMtd)} delta={`+${PORTFOLIO_ROLLUP.revenueToBudget}% to budget`} up />
          </div>
        </div>
      </Card>
      */}

      {/* TODO: Re-enable Portfolio Performance vs Comp Set (RGI/ARI/MPI) once we have
          a clearer explanation of what they show. Commented out per UI feedback.
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-brand-500" />
            Portfolio performance vs comp set
          </CardTitle>
          <CardDescription>
            Weighted-average indices across all {HOTEL_GROUP.properties.length} properties. 100 = parity with market.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {(["rgi", "ari", "mpi"] as const).map((k) => {
              const kpi = PERFORMANCE_INDICES[k];
              const label = k === "rgi" ? "RGI" : k === "ari" ? "ARI" : "MPI";
              const fullName =
                k === "rgi" ? "Revenue Generation Index" : k === "ari" ? "Average Rate Index" : "Market Penetration Index";
              const beating = kpi.value >= 100;
              return (
                <div key={k} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold text-brand-700 dark:text-brand-300">{label}</span>
                    <span className="text-[11px] text-muted-foreground">{fullName}</span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-bold tabular-nums">{kpi.value.toFixed(1)}</span>
                    <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold", kpi.delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                      {kpi.delta >= 0 ? "+" : ""}{kpi.delta.toFixed(1)}
                    </span>
                  </div>
                  <div className={cn("mt-1 text-[10px] font-medium", beating ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                    {beating ? "Beating market" : "Trailing market"}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      */}

      {/* Cross-property comparison table */}
      <Card>
        <CardHeader>
          <CardTitle>Cross-property comparison</CardTitle>
          <CardDescription>
            Side-by-side metrics for every hotel. Click any column header to sort.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <SortHead label="Property" active={sortKey === "name"} dir={sortDir} onClick={() => toggle("name")} />
                  <SortHead label="OCC" align="right" active={sortKey === "occupancy"} dir={sortDir} onClick={() => toggle("occupancy")} />
                  <SortHead label="ADR" align="right" active={sortKey === "adr"} dir={sortDir} onClick={() => toggle("adr")} />
                  <SortHead label="RevPAR" align="right" active={sortKey === "revpar"} dir={sortDir} onClick={() => toggle("revpar")} />
                  <SortHead label="Revenue MTD" align="right" active={sortKey === "revenue"} dir={sortDir} onClick={() => toggle("revenue")} />
                  <SortHead label="Pace vs STLY" align="right" active={sortKey === "pace"} dir={sortDir} onClick={() => toggle("pace")} />
                  <SortHead label="Fcst accuracy" align="right" active={sortKey === "accuracy"} dir={sortDir} onClick={() => toggle("accuracy")} />
                  <th className="px-3" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((p, i) => (
                  <ComparisonRow key={p.id} property={p} index={i} onDrillIn={drillIn} />
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Best / Worst */}
      {best && worst && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Highlight
            Icon={Trophy}
            tone="emerald"
            label="Top performer (by RevPAR)"
            property={best}
            metric={best.kpis.revpar ? `RevPAR ${formatCurrency(best.kpis.revpar)}` : "No RevPAR data"}
            onDrillIn={drillIn}
          />
          <Highlight
            Icon={AlertTriangle}
            tone="red"
            label="Lowest occupancy"
            property={worst}
            metric={worst.kpis.occupancy ? `${worst.kpis.occupancy.toFixed(1)}% occupancy (30d)` : "No occupancy data"}
            onDrillIn={drillIn}
          />
        </div>
      )}

      {/* Portfolio channel mix — fallback notice (booking_source unavailable) */}
      <Card>
        <CardHeader>
          <CardTitle>Portfolio channel mix over time</CardTitle>
          <CardDescription>
            Revenue share by booking source across the portfolio.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-56 items-center justify-center flex-col gap-3 rounded-lg border border-dashed border-amber-200 dark:border-amber-800/50 bg-amber-50/40 dark:bg-amber-950/15 p-6 text-center">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
              <Layers className="h-4 w-4 text-amber-700 dark:text-amber-300" />
            </div>
            <div className="max-w-md">
              <div className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                Channel data unavailable
              </div>
              <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                No <code className="font-mono">booking_source</code> column is present in the
                PMS feed for these properties — direct / OTA breakdown cannot be computed.
                Surfaces once channel data is wired in.
              </p>
            </div>
          </div>
          <div className="mt-2 text-[10px] text-muted-foreground">
            Source would be <code className="font-mono">reservations.booking_source</code> (not in this feed)
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function pick(p: Property, k: SortKey) {
  switch (k) {
    case "name": return p.name;
    case "occupancy": return p.kpis.occupancy;
    case "adr": return p.kpis.adr;
    case "revpar": return p.kpis.revpar;
    case "revenue": return p.kpis.revenueMtd;
    case "pace": return p.kpis.paceVsStly;
    case "accuracy": return p.kpis.forecastAccuracy;
  }
}

function compactMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return formatCurrency(n);
}

function PortfolioKpi({
  label,
  value,
  delta,
  up,
}: {
  label: string;
  value: string;
  delta: string;
  up: boolean;
}) {
  return (
    <div className="rounded-xl bg-card/85 backdrop-blur border border-border p-3.5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
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
        {delta}
      </div>
    </div>
  );
}

function SortHead({
  label,
  align,
  active,
  dir,
  onClick,
}: {
  label: string;
  align?: "left" | "right";
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <th
      className={cn(
        "font-medium py-2.5 px-3 cursor-pointer select-none hover:text-foreground transition-colors",
        align === "right" ? "text-right" : "text-left",
        active && "text-foreground"
      )}
      onClick={onClick}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && <span className="text-[8px]">{dir === "asc" ? "▲" : "▼"}</span>}
      </span>
    </th>
  );
}

function ComparisonRow({
  property,
  index,
  onDrillIn,
}: {
  property: Property;
  index: number;
  onDrillIn: (id: string) => void;
}) {
  const status = STATUS_META[property.status];
  const paceUp = property.kpis.paceVsStly >= 0;
  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.03 }}
      className="border-t border-border hover:bg-accent/30 transition-colors cursor-pointer"
      onClick={() => onDrillIn(property.id)}
    >
      <td className="py-2.5 px-3">
        <div className="flex items-center gap-2">
          <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
          <div>
            <div className="font-semibold">{property.name}</div>
            <div className="text-[10px] text-muted-foreground">{property.city}, {property.state}</div>
          </div>
        </div>
      </td>
      <td className="text-right px-3 font-mono tabular-nums">{property.kpis.occupancy}%</td>
      <td className="text-right px-3 font-mono tabular-nums">{formatCurrency(property.kpis.adr)}</td>
      <td className="text-right px-3 font-mono tabular-nums font-semibold">{formatCurrency(property.kpis.revpar)}</td>
      <td className="text-right px-3 font-mono tabular-nums text-muted-foreground">{compactMoney(property.kpis.revenueMtd)}</td>
      <td className="text-right px-3">
        <Badge variant={paceUp ? "opportunity" : "critical"} className="font-mono text-[10px]">
          {paceUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {paceUp ? "+" : ""}
          {property.kpis.paceVsStly.toFixed(1)}%
        </Badge>
      </td>
      <td className="text-right px-3 font-mono tabular-nums text-muted-foreground">
        {property.kpis.forecastAccuracy.toFixed(1)}%
      </td>
      <td className="text-right px-3 text-muted-foreground">
        <ChevronRight className="h-4 w-4 ml-auto" />
      </td>
    </motion.tr>
  );
}

function Highlight({
  Icon,
  tone,
  label,
  property,
  metric,
  onDrillIn,
}: {
  Icon: any;
  tone: "emerald" | "red";
  label: string;
  property: Property;
  metric: string;
  onDrillIn: (id: string) => void;
}) {
  const toneClasses =
    tone === "emerald"
      ? {
          bg: "bg-gradient-to-br from-emerald-50 to-transparent dark:from-emerald-950/30",
          border: "border-emerald-200 dark:border-emerald-900/50",
          icon: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400",
          metric: "text-emerald-700 dark:text-emerald-300",
        }
      : {
          bg: "bg-gradient-to-br from-red-50 to-transparent dark:from-red-950/30",
          border: "border-red-200 dark:border-red-900/50",
          icon: "bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400",
          metric: "text-red-700 dark:text-red-300",
        };
  return (
    <Card className={cn("overflow-hidden", toneClasses.border, toneClasses.bg)}>
      <div className="p-4 flex items-center gap-3">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg shrink-0", toneClasses.icon)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className="text-base font-semibold leading-tight truncate">{property.name}</div>
          <div className={cn("text-xs font-semibold", toneClasses.metric)}>{metric}</div>
        </div>
        <Button variant="outline" size="sm" onClick={() => onDrillIn(property.id)} className="shrink-0">
          Drill in
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </Card>
  );
}
