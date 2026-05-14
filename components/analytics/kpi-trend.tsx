"use client";
import * as React from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import useSWR from "swr";
import { Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";
import { usePortfolio } from "@/components/portfolio-provider";
import type { KpiTrendPoint } from "@/lib/queries/analytics";

type Metric = "revpar" | "adr" | "occupancy";

const metricMap: Record<Metric, { label: string; color: string; format: (v: number) => string }> = {
  revpar:    { label: "RevPAR",    color: "#0066cc", format: (v) => formatCurrency(v) },
  adr:       { label: "ADR",       color: "#10b981", format: (v) => formatCurrency(v) },
  occupancy: { label: "Occupancy", color: "#f59e0b", format: (v) => `${v.toFixed(1)}%` },
};

const fetcher = (url: string) =>
  fetch(url).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });

export function KpiTrend({ showStly, range }: { showStly: boolean; range?: "30d" | "90d" | "365d" }) {
  const [metric, setMetric] = React.useState<Metric>("revpar");
  const m = metricMap[metric];
  const { activePropertyId } = usePortfolio();

  const days = range === "30d" ? 30 : range === "365d" ? 365 : 90;

  const { data: res, isLoading, error } = useSWR<{ ok: boolean; data: KpiTrendPoint[] }>(
    activePropertyId
      ? `/api/hotels/${activePropertyId}/analytics/kpi-trend?days=${days}`
      : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 }
  );

  const points: KpiTrendPoint[] = res?.ok ? res.data : [];

  // Date range from actual data
  const dataRange = points.length >= 2
    ? `${points[0].label} – ${points[points.length - 1].label}`
    : points.length === 1 ? points[0].label : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle>KPI trend</CardTitle>
            <CardDescription>
              Weekly aggregate · last {days} days
              {dataRange && (
                <span className="ml-1 text-foreground/60"> · {dataRange}</span>
              )}
              {" · "}live from <span className="font-mono text-[10px]">daily_inventory</span>
            </CardDescription>
          </div>
          <div className="flex items-center rounded-md border border-border bg-card p-0.5">
            {(Object.keys(metricMap) as Metric[]).map((k) => (
              <button
                key={k}
                onClick={() => setMetric(k)}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  metric === k
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {metricMap[k].label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading KPI data…
          </div>
        ) : error || !points.length ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            {error ? "Could not load KPI data." : "No historical data available for this period."}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="h-64 w-full"
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={points} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="kpiTrendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={m.color} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={m.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickFormatter={m.format}
                />
                <Tooltip
                  contentStyle={{
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    background: "hsl(var(--popover))",
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [m.format(v), m.label]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} iconType="line" />
                <Area
                  type="monotone"
                  dataKey={metric}
                  stroke={m.color}
                  strokeWidth={2.5}
                  fill="url(#kpiTrendGrad)"
                  name={m.label}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </motion.div>
        )}
        <div className="mt-2 text-[10px] text-muted-foreground">
          Method: actual RevPAR/ADR/Occ from <code className="font-mono">daily_inventory</code> joined to <code className="font-mono">suggested_prices</code> · live DB
          {showStly && (
            <span className="ml-2 text-amber-600 dark:text-amber-400">
              · STLY not available — dataset starts Feb 2026, no year-ago data exists yet
            </span>
          )}
          {dataRange && (
            <span className="ml-2">· Data window: {dataRange}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
