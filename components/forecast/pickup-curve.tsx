"use client";
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
  ReferenceLine,
} from "recharts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PICKUP_CURVE, PICKUP_CURVE_META } from "@/lib/forecast-data";

export function PickupCurve() {
  // Find today's point — last point with non-null OTB
  const todayPoint = [...PICKUP_CURVE].reverse().find((p) => p.otb !== null);
  const todayOtb = todayPoint?.otb ?? 0;
  const todayStly = todayPoint?.stly ?? 0;
  const todayForecast = todayPoint?.forecast ?? 0;
  const vsStly = ((todayOtb - todayStly) / todayStly) * 100;
  const vsForecast = ((todayOtb - todayForecast) / todayForecast) * 100;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle>Booking pickup curve — {PICKUP_CURVE_META.stayDate}</CardTitle>
            <CardDescription>
              On-the-books vs Same Time Last Year vs Forecast · {PICKUP_CURVE_META.daysUntilStay} days
              to stay
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={vsStly > 0 ? "opportunity" : "critical"}
              className="font-mono text-[10px]"
            >
              {vsStly > 0 ? "+" : ""}
              {vsStly.toFixed(1)}% vs STLY
            </Badge>
            <Badge
              variant={vsForecast > 0 ? "opportunity" : "warning"}
              className="font-mono text-[10px]"
            >
              {vsForecast > 0 ? "+" : ""}
              {vsForecast.toFixed(1)}% vs forecast
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="h-72 w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={PICKUP_CURVE} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="pickupGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0066cc" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#0066cc" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                label={{
                  value: "Cumulative rooms",
                  angle: -90,
                  position: "insideLeft",
                  style: { fontSize: 10, fill: "hsl(var(--muted-foreground))" },
                }}
              />
              <Tooltip
                contentStyle={{
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  background: "hsl(var(--popover))",
                  fontSize: 12,
                }}
                formatter={(v: any) => (v === null || v === undefined ? "—" : v)}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} iconType="line" />
              <ReferenceLine
                x="Today"
                stroke="#0066cc"
                strokeDasharray="3 3"
                label={{ value: "Today", position: "top", fontSize: 10, fill: "#0066cc" }}
              />
              <Area
                type="monotone"
                dataKey="otb"
                stroke="#0066cc"
                strokeWidth={2.5}
                fill="url(#pickupGrad)"
                name="OTB (actual)"
                connectNulls={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="stly"
                stroke="#94a3b8"
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                name="STLY"
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="forecast"
                stroke="#10b981"
                strokeWidth={2}
                strokeDasharray="3 3"
                dot={false}
                name="Forecast"
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </motion.div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <KpiCell label="OTB today" value={todayOtb.toString()} sub="rooms booked" />
          <KpiCell label="Pace vs STLY" value={`${vsStly > 0 ? "+" : ""}${vsStly.toFixed(1)}%`} sub="ahead of last year" />
          <KpiCell label="Forecast EOD" value={PICKUP_CURVE[PICKUP_CURVE.length - 1].forecast.toString()} sub="rooms at stay date" />
        </div>
        <div className="mt-3 text-[10px] text-muted-foreground">
          Source: expected_booking_curves · reservations · historical_occupancy_raw
        </div>
      </CardContent>
    </Card>
  );
}

function KpiCell({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-xl font-bold tabular-nums leading-tight">{value}</div>
      <div className="text-[10px] text-muted-foreground">{sub}</div>
    </div>
  );
}
