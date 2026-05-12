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
} from "recharts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { LEAD_TIME_DIST, LOS_DIST, DISTRIBUTION_SUMMARY } from "@/lib/analytics-data";
import { cn } from "@/lib/utils";

export function Distributions() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <DistributionCard
        title="Booking lead time"
        description="How far in advance guests are booking"
        data={LEAD_TIME_DIST}
        color="#0066cc"
        meta={[
          { label: "Avg lead time", value: `${DISTRIBUTION_SUMMARY.avgLeadTime.toFixed(1)} days` },
          { label: "Median", value: `${DISTRIBUTION_SUMMARY.medianLeadTime} days` },
        ]}
      />
      <DistributionCard
        title="Length of stay"
        description="How many nights per reservation"
        data={LOS_DIST}
        color="#10b981"
        meta={[
          { label: "Avg LOS", value: `${DISTRIBUTION_SUMMARY.avgLos.toFixed(2)} nights` },
          { label: "Median", value: `${DISTRIBUTION_SUMMARY.medianLos} nights` },
        ]}
      />
    </div>
  );
}

function DistributionCard({
  title,
  description,
  data,
  color,
  meta,
}: {
  title: string;
  description: string;
  data: { bucket: string; count: number }[];
  color: string;
  meta: { label: string; value: string }[];
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {meta.map((m) => (
              <span key={m.label} className="inline-flex items-center gap-1">
                <span className="text-muted-foreground">{m.label}:</span>
                <span className="font-semibold tabular-nums">{m.value}</span>
              </span>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="h-48 w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="bucket" stroke="hsl(var(--muted-foreground))" fontSize={10} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip
                contentStyle={{
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  background: "hsl(var(--popover))",
                  fontSize: 12,
                }}
                formatter={(v: any) => [`${v} reservations`, "Count"]}
              />
              <Bar dataKey="count" fill={color} radius={[6, 6, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
        <div className="mt-2 text-[10px] text-muted-foreground">
          Source: historical_occupancy_raw — completed stays only
        </div>
      </CardContent>
    </Card>
  );
}
