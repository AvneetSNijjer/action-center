"use client";
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
} from "recharts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { CHANNEL_MIX } from "@/lib/analytics-data";

const channels = [
  { key: "direct", label: "Direct", color: "#0066cc" },
  { key: "bookingcom", label: "Booking.com", color: "#6366f1" },
  { key: "expedia", label: "Expedia", color: "#8b5cf6" },
  { key: "walkin", label: "Walk-in", color: "#64748b" },
  { key: "other", label: "Other OTAs", color: "#94a3b8" },
] as const;

export function ChannelMix() {
  const latest = CHANNEL_MIX[CHANNEL_MIX.length - 1];
  const first = CHANNEL_MIX[0];
  const directDelta = latest.direct - first.direct;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Channel mix over time</CardTitle>
        <CardDescription>
          Direct share trending{" "}
          <span className={directDelta >= 0 ? "text-emerald-600 font-semibold" : "text-red-600 font-semibold"}>
            {directDelta >= 0 ? "+" : ""}
            {directDelta} pts
          </span>{" "}
          over the period — {latest.direct}% of revenue now direct.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="h-56 w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={CHANNEL_MIX} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickFormatter={(v) => `${v}%`}
                domain={[0, 100]}
              />
              <Tooltip
                contentStyle={{
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  background: "hsl(var(--popover))",
                  fontSize: 12,
                }}
                formatter={(v: any) => `${v}%`}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {channels.map((c) => (
                <Bar
                  key={c.key}
                  dataKey={c.key}
                  stackId="mix"
                  fill={c.color}
                  name={c.label}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
        <div className="mt-2 text-[10px] text-muted-foreground">
          Source: reservations.booking_source aggregated by week
        </div>
      </CardContent>
    </Card>
  );
}
