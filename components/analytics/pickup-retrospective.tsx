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
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { PICKUP_RETROSPECTIVE } from "@/lib/analytics-data";
import { cn } from "@/lib/utils";

function barColor(variance: number) {
  if (variance >= 5) return "#10b981";
  if (variance <= -5) return "#ef4444";
  if (variance >= 0) return "#34d399";
  return "#f59e0b";
}

export function PickupRetrospective() {
  // compute summary stats
  const ahead = PICKUP_RETROSPECTIVE.filter((r) => r.variancePct > 0).length;
  const behind = PICKUP_RETROSPECTIVE.filter((r) => r.variancePct < 0).length;
  const avg = PICKUP_RETROSPECTIVE.reduce((a, b) => a + b.variancePct, 0) / PICKUP_RETROSPECTIVE.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle>Pickup pace — retrospective</CardTitle>
            <CardDescription>
              Actual pickup vs the expected booking curve for each recent stay date. Did demand land where we predicted?
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
              {ahead} ahead
            </span>
            <span className="text-red-600 dark:text-red-400 font-semibold">{behind} behind</span>
            <span className="text-muted-foreground">
              Avg variance:{" "}
              <span className={cn("font-semibold", avg >= 0 ? "text-emerald-600" : "text-red-600")}>
                {avg > 0 ? "+" : ""}
                {avg.toFixed(1)}%
              </span>
            </span>
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
            <ComposedChart data={PICKUP_RETROSPECTIVE} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="stayDate" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis
                yAxisId="left"
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                label={{ value: "Rooms", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "hsl(var(--muted-foreground))" } }}
              />
              <YAxis
                yAxisId="right"
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
                formatter={(v: any, name: string) => {
                  if (name === "Variance") return [`${v > 0 ? "+" : ""}${v}%`, name];
                  return [v, name];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="expectedPickup" name="Expected" fill="#cbd5e1" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar yAxisId="left" dataKey="actualPickup" name="Actual" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {PICKUP_RETROSPECTIVE.map((row, i) => (
                  <Cell key={i} fill={barColor(row.variancePct)} />
                ))}
              </Bar>
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="variancePct"
                stroke="#0066cc"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                name="Variance"
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </motion.div>
        <div className="mt-2 text-[10px] text-muted-foreground">
          Source: expected_booking_curves vs reservations (final pickup at days_until_stay = 0)
        </div>
      </CardContent>
    </Card>
  );
}
