"use client";
import * as React from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  TrendingDown,
  LineChart as LineChartIcon,
  Calendar,
  ChevronRight,
} from "lucide-react";
import { ResponsiveContainer, LineChart, Line } from "recharts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HOTEL_GROUP, STATUS_META, type Property } from "@/lib/portfolio";
import { UpcomingEvents } from "@/components/forecast/upcoming-events";
import { usePortfolio } from "@/components/portfolio-provider";
import { cn, formatCurrency } from "@/lib/utils";

export function GroupForecast() {
  const router = useRouter();
  const { setActiveProperty } = usePortfolio();

  // Sort properties by pace ascending — worst pace at top (most urgent)
  const sortedByPace = React.useMemo(
    () => [...HOTEL_GROUP.properties].sort((a, b) => a.kpis.paceVsStly - b.kpis.paceVsStly),
    []
  );

  const ahead = sortedByPace.filter((p) => p.kpis.paceVsStly > 0).length;
  const behind = sortedByPace.filter((p) => p.kpis.paceVsStly < 0).length;
  const avgPace = sortedByPace.reduce((a, p) => a + p.kpis.paceVsStly, 0) / sortedByPace.length;
  const avgForecastAccuracy =
    sortedByPace.reduce((a, p) => a + p.kpis.forecastAccuracy, 0) / sortedByPace.length;

  const drillIn = (id: string) => {
    setActiveProperty(id, { switchToProperty: true });
    router.push("/forecast");
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-semibold tracking-tight">Forecast & Demand</h1>
          <span className="rounded-full bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 px-2 py-0.5 text-[10px] font-semibold ring-1 ring-violet-200 dark:ring-violet-900/50 inline-flex items-center gap-1">
            <LineChartIcon className="h-3 w-3" />
            GROUP VIEW
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          How is the portfolio pacing? Where are demand and competitor pressure concentrated?
          Drill into any property for the full forecast suite.
        </p>
      </motion.div>

      {/* Portfolio pacing KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <PacingKpi
          index={0}
          label="Avg pace vs STLY"
          value={`${avgPace > 0 ? "+" : ""}${avgPace.toFixed(1)}%`}
          tone={avgPace >= 0 ? "up" : "down"}
        />
        <PacingKpi
          index={1}
          label="Properties ahead"
          value={`${ahead} of ${sortedByPace.length}`}
          tone="up"
        />
        <PacingKpi
          index={2}
          label="Properties behind"
          value={`${behind} of ${sortedByPace.length}`}
          tone={behind > 0 ? "down" : "neutral"}
        />
        <PacingKpi
          index={3}
          label="Forecast accuracy"
          value={`${avgForecastAccuracy.toFixed(1)}%`}
          tone={avgForecastAccuracy >= 92 ? "up" : "down"}
        />
      </div>

      {/* Pacing leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle>Pacing leaderboard</CardTitle>
          <CardDescription>
            Properties ranked by pace vs Same Time Last Year. Behind-pace properties surface first
            so you can focus where it matters.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left font-medium py-2.5 px-3">Property</th>
                  <th className="text-right font-medium py-2.5 px-3">OCC</th>
                  <th className="text-right font-medium py-2.5 px-3">RevPAR</th>
                  <th className="text-right font-medium py-2.5 px-3">Pace vs STLY</th>
                  <th className="text-right font-medium py-2.5 px-3">Fcst accuracy</th>
                  <th className="text-center font-medium py-2.5 px-3">14d RevPAR</th>
                  <th className="text-right font-medium py-2.5 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {sortedByPace.map((p, i) => (
                  <PacingRow key={p.id} property={p} index={i} onDrillIn={drillIn} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-[10px] text-muted-foreground">
            Source: expected_booking_curves · historical_occupancy_raw · revpar_forecast_history
          </div>
        </CardContent>
      </Card>

      {/* Cross-property RevPAR sparkline grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-brand-500" />
            14-day RevPAR momentum across portfolio
          </CardTitle>
          <CardDescription>
            One glance · who's climbing, who's slipping. Click a card to drill into that property's
            forecast.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {HOTEL_GROUP.properties.map((p, i) => {
              const status = STATUS_META[p.status];
              const trend = p.revparTrend;
              const first = trend[0];
              const last = trend[trend.length - 1];
              const delta = ((last - first) / first) * 100;
              const up = delta >= 0;
              return (
                <motion.button
                  key={p.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.05 }}
                  whileHover={{ y: -2 }}
                  onClick={() => drillIn(p.id)}
                  className="text-left rounded-xl border border-border bg-card p-3 transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
                        <span className="text-sm font-semibold truncate">{p.name}</span>
                      </div>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-lg font-bold tabular-nums">
                          {formatCurrency(p.kpis.revpar)}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] font-semibold inline-flex items-center gap-0.5",
                            up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                          )}
                        >
                          {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {up ? "+" : ""}
                          {delta.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="h-10 w-20 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trend.map((v, idx) => ({ idx, v }))}>
                          <Line
                            type="monotone"
                            dataKey="v"
                            stroke={
                              p.status === "critical"
                                ? "#ef4444"
                                : p.status === "needs_review"
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
                  <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      {p.city}, {p.state}
                    </span>
                    <span>{p.rooms} rooms</span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming events — reusable from existing component */}
      <UpcomingEvents />

      {/* Footer hint */}
      <Card className="bg-card/40">
        <div className="p-4 flex items-center gap-3 flex-wrap">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-300 shrink-0">
            <Calendar className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">Need a deeper look?</div>
            <div className="text-[11px] text-muted-foreground">
              Drill into any property to see its full demand heatmap, pickup curve, and comp-set
              rate ladder.
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => drillIn(HOTEL_GROUP.properties[0].id)}
          >
            Open property view
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </Card>
    </div>
  );
}

function PacingKpi({
  label,
  value,
  tone,
  index = 0,
}: {
  label: string;
  value: string;
  tone: "up" | "down" | "neutral";
  index?: number;
}) {
  const toneClass =
    tone === "up"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "down"
      ? "text-red-600 dark:text-red-400"
      : "text-muted-foreground";
  const Icon = tone === "up" ? TrendingUp : tone === "down" ? TrendingDown : null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.05 }}
    >
      <Card className="p-4">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="mt-1.5 flex items-baseline gap-1.5">
          <span className="text-2xl font-bold tabular-nums">{value}</span>
          {Icon && <Icon className={cn("h-4 w-4", toneClass)} />}
        </div>
      </Card>
    </motion.div>
  );
}

function PacingRow({
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
      className="border-t border-border hover:bg-accent/40 transition-colors cursor-pointer"
      onClick={() => onDrillIn(property.id)}
    >
      <td className="py-2.5 px-3">
        <div className="flex items-center gap-2">
          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", status.dot)} />
          <div className="min-w-0">
            <div className="font-semibold truncate">{property.name}</div>
            <div className="text-[10px] text-muted-foreground">
              {property.city}, {property.state}
            </div>
          </div>
        </div>
      </td>
      <td className="text-right px-3 font-mono tabular-nums">{property.kpis.occupancy}%</td>
      <td className="text-right px-3 font-mono tabular-nums font-semibold">
        {formatCurrency(property.kpis.revpar)}
      </td>
      <td className="text-right px-3">
        <Badge
          variant={paceUp ? "opportunity" : "critical"}
          className="font-mono text-[10px]"
        >
          {paceUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {paceUp ? "+" : ""}
          {property.kpis.paceVsStly.toFixed(1)}%
        </Badge>
      </td>
      <td className="text-right px-3 font-mono tabular-nums text-muted-foreground">
        {property.kpis.forecastAccuracy.toFixed(1)}%
      </td>
      <td className="text-center px-3">
        <div className="h-8 w-24 mx-auto">
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
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </td>
      <td className="text-right px-3 text-muted-foreground">
        <ChevronRight className="h-4 w-4 ml-auto" />
      </td>
    </motion.tr>
  );
}
