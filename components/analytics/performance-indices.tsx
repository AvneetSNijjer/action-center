"use client";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { ResponsiveContainer, LineChart, Line } from "recharts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { PERFORMANCE_INDICES } from "@/lib/analytics-data";
import { cn } from "@/lib/utils";

const definitions = {
  rgi: {
    title: "RGI",
    fullName: "Revenue Generation Index",
    description: "Your RevPAR ÷ comp-set RevPAR × 100",
    tone: "brand" as const,
  },
  ari: {
    title: "ARI",
    fullName: "Average Rate Index",
    description: "Your ADR ÷ comp-set ADR × 100",
    tone: "emerald" as const,
  },
  mpi: {
    title: "MPI",
    fullName: "Market Penetration Index",
    description: "Your Occupancy ÷ comp-set Occupancy × 100",
    tone: "violet" as const,
  },
};

const toneClasses = {
  brand: { line: "#0066cc", bg: "bg-brand-50 dark:bg-brand-900/30", text: "text-brand-700 dark:text-brand-300" },
  emerald: { line: "#10b981", bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-300" },
  violet: { line: "#8b5cf6", bg: "bg-violet-50 dark:bg-violet-950/40", text: "text-violet-700 dark:text-violet-300" },
};

export function PerformanceIndices() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-brand-500" />
              Performance vs comp set
            </CardTitle>
            <CardDescription>
              100 = at parity with market · &gt;100 = beating the market · &lt;100 = trailing
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {(Object.keys(definitions) as Array<keyof typeof definitions>).map((key, i) => {
            const def = definitions[key];
            const kpi = PERFORMANCE_INDICES[key];
            const t = toneClasses[def.tone];
            const up = kpi.delta >= 0;
            const beatingMarket = kpi.value >= 100;
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.06 }}
                className="rounded-xl border border-border bg-card p-4 transition-all hover:border-foreground/20 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className={cn("text-xl font-bold tracking-tight", t.text)}>
                        {def.title}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{def.fullName}</span>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-3xl font-bold tabular-nums tracking-tight">
                        {kpi.value.toFixed(1)}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-0.5 text-xs font-medium",
                          up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                        )}
                      >
                        {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {up ? "+" : ""}
                        {kpi.delta.toFixed(1)}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "mt-1 text-[10px] font-medium",
                        beatingMarket
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-amber-600 dark:text-amber-400"
                      )}
                    >
                      {beatingMarket ? "Beating market" : "Trailing market"}
                    </div>
                  </div>
                  {/* Sparkline */}
                  <div className="w-20 h-12 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={kpi.trend.map((v, i) => ({ i, v }))}
                        margin={{ top: 4, right: 0, bottom: 4, left: 0 }}
                      >
                        <Line
                          type="monotone"
                          dataKey="v"
                          stroke={t.line}
                          strokeWidth={2}
                          dot={false}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-border text-[11px] text-muted-foreground leading-snug">
                  {def.description}
                </div>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
