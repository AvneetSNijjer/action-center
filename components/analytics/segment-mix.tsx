"use client";
import * as React from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
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
import { usePortfolio } from "@/components/portfolio-provider";
import type { RoomTypeMixRow } from "@/lib/queries/analytics";

const fetcher = (url: string) =>
  fetch(url).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });

// Colours per category — consistent with channel-mix
const CAT_COLORS: Record<string, string> = {
  Standard: "#0066cc",
  Superior: "#10b981",
  Club:     "#f59e0b",
  Premium:  "#8b5cf6",
  Other:    "#64748b",
};

interface CategorySummary {
  category:     string;
  soldNights:   number;
  capacity:     number;
  occupancyPct: number;
  sharePct:     number;
}

export function SegmentMix() {
  const { activePropertyId } = usePortfolio();

  const { data: res, isLoading, error } = useSWR<{ ok: boolean; data: RoomTypeMixRow[] }>(
    activePropertyId
      ? `/api/hotels/${activePropertyId}/analytics/room-type-mix?days=90`
      : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 }
  );

  const rows: RoomTypeMixRow[] = res?.ok ? (res.data ?? []) : [];

  // Aggregate into categories
  const categories: CategorySummary[] = React.useMemo(() => {
    const map: Record<string, { sold: number; capacity: number }> = {};
    rows.forEach((r) => {
      if (!map[r.category]) map[r.category] = { sold: 0, capacity: 0 };
      map[r.category].sold     += r.soldNights;
      map[r.category].capacity += r.capacity;
    });
    const totalSold = Object.values(map).reduce((s, v) => s + v.sold, 0);
    return Object.entries(map)
      .map(([cat, { sold, capacity }]) => ({
        category:     cat,
        soldNights:   sold,
        capacity,
        occupancyPct: capacity > 0 ? Math.round((sold / capacity) * 100) : 0,
        sharePct:     totalSold > 0 ? parseFloat(((sold / totalSold) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.soldNights - a.soldNights);
  }, [rows]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Room category mix</CardTitle>
        <CardDescription>
          Occupancy distribution by room category · last 90 days
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Fallback notice */}
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-900/20 p-2.5 text-xs text-amber-800 dark:text-amber-300">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            <span className="font-semibold">Fallback: room category mix</span>
            {" · "}No <code className="font-mono">rate_plan_code → segment</code> mapping available.
            Room types are grouped into categories (Standard / Superior / Club / Premium) as a proxy for segment performance.
          </span>
        </div>

        {isLoading ? (
          <div className="flex h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading segment data…
          </div>
        ) : error || !categories.length ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            {error ? "Could not load segment data." : "No segment data available."}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {/* Summary stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {categories.map((c) => (
                <div
                  key={c.category}
                  className="rounded-lg border border-border bg-card p-2.5"
                >
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ background: CAT_COLORS[c.category] ?? CAT_COLORS.Other }}
                    />
                    {c.category}
                  </div>
                  <div className="mt-1 text-lg font-bold tabular-nums leading-none">
                    {c.sharePct}%
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    {c.soldNights} nights · {c.occupancyPct}% occ
                  </div>
                </div>
              ))}
            </div>

            {/* Grouped bar chart: sold nights + occupancy per category */}
            <div className="h-36 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={categories}
                  margin={{ top: 4, right: 16, bottom: 0, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="category"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                  />
                  <YAxis
                    yAxisId="left"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    label={{
                      value: "Nights",
                      angle: -90,
                      position: "insideLeft",
                      style: { fontSize: 9, fill: "hsl(var(--muted-foreground))" },
                    }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      background: "hsl(var(--popover))",
                      fontSize: 12,
                    }}
                    formatter={(v: number, name: string) => {
                      if (name === "Occ %") return [`${v}%`, "Occupancy"];
                      return [v, name];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar
                    yAxisId="left"
                    dataKey="soldNights"
                    name="Sold nights"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  >
                    {categories.map((c, i) => (
                      <Cell key={i} fill={CAT_COLORS[c.category] ?? CAT_COLORS.Other} />
                    ))}
                  </Bar>
                  <Bar
                    yAxisId="right"
                    dataKey="occupancyPct"
                    name="Occ %"
                    fill="#94a3b8"
                    radius={[4, 4, 0, 0]}
                    opacity={0.6}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}
        <div className="mt-2 text-[10px] text-muted-foreground">
          Method: room category proxy (true segment data unavailable) ·
          Source: <code className="font-mono">daily_inventory.room_type_code</code> grouped by prefix · live DB ·
          Categories: Standard (SC/SS) · Superior (WA/WS/WR) · Club (CC) · Premium (PW/SG/RB)
        </div>
      </CardContent>
    </Card>
  );
}
