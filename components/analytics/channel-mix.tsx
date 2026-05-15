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
  Cell,
} from "recharts";
import useSWR from "swr";
import { Loader2, Info } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { usePortfolio } from "@/components/portfolio-provider";
import type { RoomTypeMixRow } from "@/lib/queries/analytics";

const fetcher = (url: string) =>
  fetch(url).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });

// Colours per room-type category
const CAT_COLORS: Record<string, string> = {
  Standard: "#0066cc",
  Superior: "#10b981",
  Club:     "#f59e0b",
  Premium:  "#8b5cf6",
  Other:    "#64748b",
};

function occColor(pct: number) {
  if (pct >= 80) return "#10b981";
  if (pct >= 60) return "#34d399";
  if (pct >= 40) return "#f59e0b";
  return "#ef4444";
}

export function ChannelMix({ range = "90d" }: { range?: "30d" | "90d" | "365d" }) {
  const { activePropertyId } = usePortfolio();
  const [view, setView] = React.useState<"share" | "occupancy">("share");
  const days = range === "30d" ? 30 : range === "365d" ? 365 : 90;

  const { data: res, isLoading, error } = useSWR<{ ok: boolean; data: RoomTypeMixRow[] }>(
    activePropertyId
      ? `/api/hotels/${activePropertyId}/analytics/room-type-mix?days=${days}`
      : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 }
  );

  const rows: RoomTypeMixRow[] = res?.ok ? (res.data ?? []) : [];

  // Group by category for summary pills
  const categories = React.useMemo(() => {
    const map: Record<string, { sold: number; capacity: number }> = {};
    rows.forEach((r) => {
      if (!map[r.category]) map[r.category] = { sold: 0, capacity: 0 };
      map[r.category].sold     += r.soldNights;
      map[r.category].capacity += r.capacity;
    });
    return Object.entries(map).map(([cat, { sold, capacity }]) => ({
      category:    cat,
      soldNights:  sold,
      occupancyPct: capacity > 0 ? Math.round((sold / capacity) * 100) : 0,
    })).sort((a, b) => b.soldNights - a.soldNights);
  }, [rows]);

  // Top-10 room types for chart
  const chartData = rows.slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle>Room type mix</CardTitle>
            <CardDescription>
              Sold-night distribution by room type · last {days} days
            </CardDescription>
          </div>
          {rows.length > 0 && (
            <div className="flex items-center rounded-md border border-border bg-card p-0.5">
              <button
                onClick={() => setView("share")}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  view === "share"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Share %
              </button>
              <button
                onClick={() => setView("occupancy")}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  view === "occupancy"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Occupancy %
              </button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Fallback notice */}
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-900/20 p-2.5 text-xs text-amber-800 dark:text-amber-300">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            <span className="font-semibold">Fallback: room type mix</span>
            {" · "}PMS feed does not include <code className="font-mono">booking_source</code> (channel data).
            Showing sold-night distribution by <code className="font-mono">room_type_code</code> as a proxy.
          </span>
        </div>

        {isLoading ? (
          <div className="flex h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading room type data…
          </div>
        ) : error || !rows.length ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            {error ? "Could not load room type data." : "No room type data available."}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {/* Category summary pills */}
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <div
                  key={c.category}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-muted/30 px-2.5 py-1 text-xs"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: CAT_COLORS[c.category] ?? CAT_COLORS.Other }}
                  />
                  <span className="font-medium">{c.category}</span>
                  <span className="text-muted-foreground">
                    {c.soldNights} nights · {c.occupancyPct}% occ
                  </span>
                </div>
              ))}
            </div>

            {/* Bar chart — top 10 room types */}
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 0, right: 40, bottom: 0, left: 48 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis
                    type="number"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <YAxis
                    type="category"
                    dataKey="roomTypeCode"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    width={44}
                  />
                  <Tooltip
                    contentStyle={{
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      background: "hsl(var(--popover))",
                      fontSize: 12,
                    }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(v: number) => [
                      view === "share" ? `${v}%` : `${v}%`,
                      view === "share" ? "Share of sold nights" : "Occupancy",
                    ]}
                  />
                  <Bar
                    dataKey={view === "share" ? "sharePct" : "occupancyPct"}
                    radius={[0, 4, 4, 0]}
                    isAnimationActive={false}
                  >
                    {chartData.map((row, i) => (
                      <Cell
                        key={i}
                        fill={
                          view === "share"
                            ? (CAT_COLORS[row.category] ?? CAT_COLORS.Other)
                            : occColor(row.occupancyPct)
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}
        <div className="mt-2 text-[10px] text-muted-foreground">
          Method: room type mix proxy (true channel data unavailable) ·
          Source: <code className="font-mono">daily_inventory.room_type_code</code> · live DB · top 10 types shown
        </div>
      </CardContent>
    </Card>
  );
}
