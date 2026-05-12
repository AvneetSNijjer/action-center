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
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { KPI_SERIES } from "@/lib/analytics-data";
import { cn } from "@/lib/utils";

type Metric = "revpar" | "adr" | "occupancy";

const metricMap: Record<Metric, { label: string; stlyKey: string; color: string }> = {
  revpar: { label: "RevPAR", stlyKey: "stlyRevpar", color: "#0066cc" },
  adr: { label: "ADR", stlyKey: "stlyAdr", color: "#10b981" },
  occupancy: { label: "Occupancy", stlyKey: "stlyOccupancy", color: "#f59e0b" },
};

export function KpiTrend({ showStly }: { showStly: boolean }) {
  const [metric, setMetric] = React.useState<Metric>("revpar");
  const m = metricMap[metric];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle>KPI trend</CardTitle>
            <CardDescription>Weekly aggregate, plotted over the selected range</CardDescription>
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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="h-64 w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={KPI_SERIES} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="kpiTrendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={m.color} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={m.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip
                contentStyle={{
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  background: "hsl(var(--popover))",
                  fontSize: 12,
                }}
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
              {showStly && (
                <Line
                  type="monotone"
                  dataKey={m.stlyKey}
                  stroke="#94a3b8"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                  name="STLY"
                  isAnimationActive={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </motion.div>
        <div className="mt-2 text-[10px] text-muted-foreground">
          Source: financial_metrics_service · STLY computed from historical_occupancy_raw
        </div>
      </CardContent>
    </Card>
  );
}
