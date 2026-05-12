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
  ReferenceLine,
  Cell,
} from "recharts";
import { CheckCircle2, AlertTriangle, Activity } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { FORECAST_ACCURACY, FORECAST_SUMMARY } from "@/lib/analytics-data";
import { cn } from "@/lib/utils";

function barColor(variance: number) {
  const abs = Math.abs(variance);
  if (abs <= 3) return "#10b981"; // emerald — on target
  if (abs <= 5) return "#0066cc"; // brand — close
  if (abs <= 10) return "#f59e0b"; // amber — drifting
  return "#ef4444"; // red — off
}

export function ForecastAccuracy() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle>Forecast accuracy</CardTitle>
            <CardDescription>
              Weekly RevPAR variance vs forecast. Green ≤3% · Blue ≤5% · Amber ≤10% · Red &gt;10%.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <SummaryStat
              Icon={CheckCircle2}
              label="Mean abs error"
              value={`${FORECAST_SUMMARY.meanAbsError.toFixed(1)}%`}
              tone="text-emerald-600 dark:text-emerald-400"
            />
            <SummaryStat
              Icon={Activity}
              label="Within ±5%"
              value={`${FORECAST_SUMMARY.withinThreshold}% of weeks`}
              tone="text-brand-600 dark:text-brand-400"
            />
            <SummaryStat
              Icon={AlertTriangle}
              label="Bias"
              value={`${FORECAST_SUMMARY.bias > 0 ? "+" : ""}${FORECAST_SUMMARY.bias.toFixed(1)}%`}
              tone="text-muted-foreground"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="h-56 w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={FORECAST_ACCURACY} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickFormatter={(v) => `${v > 0 ? "+" : ""}${v}%`}
                domain={[-6, 6]}
              />
              <Tooltip
                contentStyle={{
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  background: "hsl(var(--popover))",
                  fontSize: 12,
                }}
                formatter={(value: any, _name: any, props: any) => {
                  const row = props?.payload;
                  return [
                    `${row?.actual} actual vs ${row?.forecast} forecast (${
                      value > 0 ? "+" : ""
                    }${Number(value).toFixed(1)}%)`,
                    "Variance",
                  ];
                }}
              />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 2" />
              <ReferenceLine y={5} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 2" opacity={0.3} />
              <ReferenceLine y={-5} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 2" opacity={0.3} />
              <Bar dataKey="variancePct" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                {FORECAST_ACCURACY.map((d, i) => (
                  <Cell key={i} fill={barColor(d.variancePct)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
        <div className="mt-2 text-[10px] text-muted-foreground">
          Source: revpar_forecast_history (forecast) vs financial_metrics_service (actual)
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryStat({
  Icon,
  label,
  value,
  tone,
}: {
  Icon: any;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <Icon className={cn("h-3.5 w-3.5", tone)} />
      <span className="text-muted-foreground">{label}:</span>
      <span className={cn("font-semibold", tone)}>{value}</span>
    </div>
  );
}
