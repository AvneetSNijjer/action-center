"use client";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from "recharts";
import useSWR from "swr";
import { Loader2, Info } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { usePortfolio } from "@/components/portfolio-provider";
import type { BookingPaceRow } from "@/lib/queries/analytics";

const fetcher = (url: string) =>
  fetch(url).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });

function barColor(variance: number) {
  if (variance >= 10)  return "#10b981"; // strong above
  if (variance >= 0)   return "#34d399"; // mild above
  if (variance >= -10) return "#f59e0b"; // mild below
  return "#ef4444";                       // strong below
}

export function PickupRetrospective() {
  const { activePropertyId } = usePortfolio();

  const { data: res, isLoading, error } = useSWR<{ ok: boolean; data: BookingPaceRow[] }>(
    activePropertyId
      ? `/api/hotels/${activePropertyId}/analytics/booking-pace`
      : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 180_000 }
  );

  const rows: BookingPaceRow[] = res?.ok ? res.data : [];

  const ahead  = rows.filter((r) => r.variancePct > 0).length;
  const behind = rows.filter((r) => r.variancePct < 0).length;
  const avg    = rows.length
    ? rows.reduce((a, b) => a + b.variancePct, 0) / rows.length
    : 0;

  // Date range label from first/last row
  const dateRange = rows.length >= 2
    ? `${rows[0].stayDate} – ${rows[rows.length - 1].stayDate}`
    : rows.length === 1 ? rows[0].stayDate : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle>Booking pace — retrospective</CardTitle>
            <CardDescription>
              Daily occupancy vs 4-week same-DOW rolling average · last 28 days
            </CardDescription>
          </div>
          {rows.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                {ahead} nights ahead
              </span>
              <span className="text-red-600 dark:text-red-400 font-semibold">{behind} nights behind</span>
              <span className="text-muted-foreground">
                Avg variance:{" "}
                <span className={cn("font-semibold", avg >= 0 ? "text-emerald-600" : "text-red-600")}>
                  {avg > 0 ? "+" : ""}
                  {avg.toFixed(1)}%
                </span>
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Fallback method notice */}
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-900/20 p-2.5 text-xs text-amber-800 dark:text-amber-300">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            <span className="font-semibold">Fallback: occupancy pace</span>
            {" · "}PMS is not sending last-day pickup increments (<code className="font-mono">actual_pickup_last_day = 0</code> across all records).
            Showing daily sold-rooms vs 4-week same-DOW rolling average instead.
            {dateRange && <span className="ml-1 text-amber-700 dark:text-amber-400">· Data: {dateRange}</span>}
          </span>
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading pace data…
          </div>
        ) : error || !rows.length ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            {error
              ? "Could not load booking pace data."
              : "No occupancy history available yet for this property."}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="h-64 w-full"
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={rows} margin={{ top: 10, right: 30, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="stayDate"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  interval={3}
                  tickFormatter={(v, i) => {
                    const row = rows[i];
                    return row ? `${row.dow} ${v}` : v;
                  }}
                />
                <YAxis
                  yAxisId="rooms"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  label={{
                    value: "Rooms",
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: 10, fill: "hsl(var(--muted-foreground))" },
                  }}
                />
                <YAxis
                  yAxisId="pct"
                  orientation="right"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickFormatter={(v) => `${v > 0 ? "+" : ""}${v}%`}
                />
                <Tooltip
                  contentStyle={{
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    background: "hsl(var(--popover))",
                    fontSize: 12,
                  }}
                  formatter={(v: number, name: string) => {
                    if (name === "Variance %") return [`${v > 0 ? "+" : ""}${v}%`, name];
                    if (name === "Actual Occ %") return [`${v}%`, name];
                    if (name === "Expected Occ %") return [`${v}%`, name];
                    return [v, name];
                  }}
                  labelFormatter={(label, payload) => {
                    const row = payload?.[0]?.payload as BookingPaceRow | undefined;
                    return row ? `${row.dow}, ${label}` : label;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar
                  yAxisId="rooms"
                  dataKey="expectedOcc"
                  name="Expected rooms (4-wk avg)"
                  fill="#cbd5e1"
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={false}
                />
                <Bar
                  yAxisId="rooms"
                  dataKey="actualOcc"
                  name="Actual rooms sold"
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={false}
                >
                  {rows.map((row, i) => (
                    <Cell key={i} fill={barColor(row.variancePct)} />
                  ))}
                </Bar>
                <Line
                  yAxisId="pct"
                  type="monotone"
                  dataKey="variancePct"
                  stroke="#0066cc"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  name="Variance %"
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </motion.div>
        )}
        <div className="mt-2 text-[10px] text-muted-foreground">
          Method: occupancy pace fallback (4-week same-DOW rolling avg) ·
          Source: <code className="font-mono">daily_inventory.actual_occupancy</code> · live DB ·
          Green = above expected · Amber = slightly below · Red = well below
        </div>
      </CardContent>
    </Card>
  );
}
