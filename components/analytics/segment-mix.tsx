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
import { SEGMENT_MIX } from "@/lib/analytics-data";

const segments = [
  { key: "leisure", label: "Transient leisure", color: "#10b981" },
  { key: "corporate", label: "Transient corporate", color: "#0066cc" },
  { key: "group", label: "Group", color: "#f59e0b" },
  { key: "wholesale", label: "Wholesale", color: "#a78bfa" },
] as const;

export function SegmentMix() {
  const latest = SEGMENT_MIX[SEGMENT_MIX.length - 1];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Segment mix over time</CardTitle>
        <CardDescription>
          Leisure currently {latest.leisure}% · Corporate {latest.corporate}% · Group {latest.group}% · Wholesale {latest.wholesale}%
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
            <BarChart data={SEGMENT_MIX} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
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
              {segments.map((s) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  stackId="seg"
                  fill={s.color}
                  name={s.label}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
        <div className="mt-2 text-[10px] text-muted-foreground">
          Source: reservations.rate_plan_code mapped to standard market segments
        </div>
      </CardContent>
    </Card>
  );
}
