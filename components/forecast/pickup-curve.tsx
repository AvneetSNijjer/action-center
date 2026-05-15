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
import { Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
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
    ? new Date(d.targetDate + "T00:00:00Z").toLocaleDateString("en-US", {
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

            {/* Daily pickup bar chart */}
            {d.dailyPickup.length > 0 ? (
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
                      label={{
                        value: "Rooms/day",
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
                      formatter={(v: number, name: string) => [
                        v,
                        name === "pickup" ? "Rooms added yesterday" : "Total OTB",
                      ]}
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
                    <Bar dataKey="pickup" name="pickup" radius={[3, 3, 0, 0]}>
                      {d.dailyPickup.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.pickup > 0 ? "#0066cc" : "hsl(var(--muted))"}
                          opacity={entry.pickup > 0 ? 0.85 : 0.4}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>
            ) : (
              <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
                No daily pickup data for the next 14 nights.
              </div>
            )}
          </>
        )}

        <div className="mt-3 text-[10px] text-muted-foreground">
          Live · daily_inventory (actual_pickup_last_day){" "}
          {d?.stlyAvailable ? "· STLY from historical rows" : "· STLY unavailable (dataset too recent)"}
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
