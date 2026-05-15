"use client";
import * as React from "react";
import useSWR from "swr";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from "recharts";
import { Loader2, TrendingUp, TrendingDown, Info } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";
import { usePortfolio } from "@/components/portfolio-provider";
import type { PickupCurveData } from "@/lib/queries/forecast";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

const DOW_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function PickupCurve() {
  const { activePropertyId } = usePortfolio();

  const { data: resp, isLoading, error } = useSWR<{ ok: boolean; data: PickupCurveData | null }>(
    `/api/hotels/${activePropertyId}/forecast/pickup-curve`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 }
  );

  const d = resp?.ok ? resp.data : null;

  const pacePositive = d?.paceVsComp !== null && d?.paceVsComp !== undefined && d.paceVsComp > 0;

  // Format target date nicely
  const targetLabel = d
    ? new Date(d.targetDate.slice(0, 10) + "T00:00:00Z").toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      })
    : "";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle>
              Booking pickup pace
              {targetLabel ? ` — ${targetLabel}` : ""}
            </CardTitle>
            <CardDescription>
              Daily rooms added (last 14 stay nights) · OTB vs{" "}
              {d?.compLabel ?? "comparison period"}
            </CardDescription>
          </div>
          {d && d.paceVsComp !== null && (
            <Badge
              variant={pacePositive ? "opportunity" : "critical"}
              className="font-mono text-[10px]"
            >
              {pacePositive ? (
                <TrendingUp className="h-3 w-3 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 mr-1" />
              )}
              {d.paceVsComp > 0 ? "+" : ""}
              {d.paceVsComp.toFixed(1)}% {d.compLabel}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-56 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading pickup data…
          </div>
        ) : error || !d ? (
          <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
            No pickup data available for this property.
          </div>
        ) : (
          <>
            {/* KPI strip */}
            <div className="mb-4 grid grid-cols-3 gap-3">
              <KpiCell
                label={`OTB · ${targetLabel}`}
                value={`${d.otbRooms}`}
                sub={`${(d.otbOccupancy * 100).toFixed(0)}% occ · ${d.totalRooms} rooms`}
              />
              <KpiCell
                label={`STLY OTB`}
                value={d.stlyAvailable ? `${d.stlyRooms}` : "—"}
                sub={
                  d.stlyAvailable
                    ? `${((d.stlyOccupancy ?? 0) * 100).toFixed(0)}% occ`
                    : "No year-ago data"
                }
                muted={!d.stlyAvailable}
              />
              <KpiCell
                label="Pace vs comp"
                value={
                  d.paceVsComp !== null
                    ? `${d.paceVsComp > 0 ? "+" : ""}${d.paceVsComp.toFixed(1)}%`
                    : "—"
                }
                sub={d.compLabel}
                positive={d.paceVsComp !== null ? d.paceVsComp > 0 : undefined}
              />
            </div>

            {/* Daily chart — show pickup if available, fall back to OTB rooms */}
            {d.dailyPickup.length > 0 ? (() => {
              const totalPickup = d.dailyPickup.reduce((s, e) => s + (e.pickup || 0), 0);
              const usePickup   = totalPickup > 0;
              const chartKey    = usePickup ? "pickup" : "otb";
              const chartLabel  = usePickup ? "Rooms added yesterday" : "Rooms on-the-books";
              const yLabel      = usePickup ? "Rooms/day pickup" : "Rooms OTB";

              // Compute capacity ceiling for visual reference
              const maxCap = Math.max(...d.dailyPickup.map((e) => e.capacity || 0));

              return (
              <>
                {!usePickup && (
                  <div className="mb-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/40 p-2.5 text-xs text-amber-800 dark:text-amber-300">
                    <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>
                      <span className="font-semibold">Fallback: showing OTB rooms.</span> PMS is not
                      sending last-day pickup increments ({" "}
                      <code className="font-mono">actual_pickup_last_day = 0</code> for every row),
                      so we display rooms on-the-books per stay night instead.
                    </span>
                  </div>
                )}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="h-52 w-full"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={d.dailyPickup}
                      margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={10}
                        tickFormatter={(v) => {
                          const dt = new Date(v + "T00:00:00Z");
                          return DOW_SHORT[dt.getUTCDay()];
                        }}
                      />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={10}
                        domain={usePickup ? [0, "auto"] : [0, Math.max(maxCap, 1)]}
                        label={{
                          value: yLabel,
                          angle: -90,
                          position: "insideLeft",
                          style: { fontSize: 9, fill: "hsl(var(--muted-foreground))" },
                        }}
                      />
                      <Tooltip
                        contentStyle={{
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          background: "hsl(var(--popover))",
                          fontSize: 12,
                        }}
                        formatter={(v: number) => [v, chartLabel]}
                        labelFormatter={(label) =>
                          new Date(label + "T00:00:00Z").toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            timeZone: "UTC",
                          })
                        }
                      />
                      <ReferenceLine
                        x={d.targetDate}
                        stroke="#0066cc"
                        strokeDasharray="3 3"
                        label={{
                          value: "Target",
                          position: "top",
                          fontSize: 9,
                          fill: "#0066cc",
                        }}
                      />
                      <Bar dataKey={chartKey} name={chartLabel} radius={[3, 3, 0, 0]} isAnimationActive={false}>
                        {d.dailyPickup.map((entry, index) => {
                          const v = (usePickup ? entry.pickup : entry.otb) || 0;
                          return (
                            <Cell
                              key={`cell-${index}`}
                              fill={v > 0 ? "#0066cc" : "hsl(var(--muted))"}
                              opacity={v > 0 ? 0.85 : 0.4}
                            />
                          );
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </motion.div>
              </>
              );
            })() : (
              <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
                No daily inventory data for the next 14 nights.
              </div>
            )}
          </>
        )}

        <div className="mt-3 text-[10px] text-muted-foreground">
          Live · <code className="font-mono">daily_inventory</code> ·
          {d && d.dailyPickup.reduce((s, e) => s + e.pickup, 0) > 0
            ? " pickup from actual_pickup_last_day"
            : " OTB fallback (pickup unavailable)"}
          {d?.stlyAvailable ? " · STLY from historical rows" : " · STLY unavailable (dataset too recent)"}
        </div>
      </CardContent>
    </Card>
  );
}

function KpiCell({
  label,
  value,
  sub,
  muted,
  positive,
}: {
  label: string;
  value: string;
  sub: string;
  muted?: boolean;
  positive?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground truncate">
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 text-xl font-bold tabular-nums leading-tight",
          muted && "text-muted-foreground",
          positive === true && "text-emerald-600 dark:text-emerald-400",
          positive === false && "text-red-600 dark:text-red-400"
        )}
      >
        {value}
      </div>
      <div className="text-[10px] text-muted-foreground truncate">{sub}</div>
    </div>
  );
}
