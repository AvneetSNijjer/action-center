"use client";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { COMP_SET_LADDER } from "@/lib/forecast-data";
import { cn, formatCurrency } from "@/lib/utils";

const COMP_KEYS = ["marriott", "hilton", "hyatt", "westin", "omni"] as const;

export function CompSetLadder() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Comp-set rate ladder · next 7 nights</CardTitle>
        <CardDescription>
          Your BAR vs the comp set. Nights with &gt;10% gap from median are flagged.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left font-medium py-2.5 px-3">Date</th>
                <th className="text-right font-medium py-2.5 px-3 bg-brand-50/60 dark:bg-brand-900/20">You</th>
                <th className="text-right font-medium py-2.5 px-3">Marriott</th>
                <th className="text-right font-medium py-2.5 px-3">Hilton</th>
                <th className="text-right font-medium py-2.5 px-3">Hyatt</th>
                <th className="text-right font-medium py-2.5 px-3">Westin</th>
                <th className="text-right font-medium py-2.5 px-3">Omni</th>
                <th className="text-right font-medium py-2.5 px-3">Median</th>
                <th className="text-right font-medium py-2.5 px-3">Gap</th>
              </tr>
            </thead>
            <tbody>
              {COMP_SET_LADDER.map((row, i) => {
                const gap = ((row.you - row.median) / row.median) * 100;
                const outlier = Math.abs(gap) > 10;
                return (
                  <motion.tr
                    key={row.date}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.04 }}
                    className={cn(
                      "border-t border-border hover:bg-accent/30 transition-colors",
                      outlier && "bg-amber-50/40 dark:bg-amber-950/15"
                    )}
                  >
                    <td className="py-2.5 px-3">
                      <div className="font-semibold">{row.dow}</div>
                      <div className="text-[10px] text-muted-foreground">{row.date}</div>
                    </td>
                    <td className="text-right px-3 font-semibold font-mono tabular-nums bg-brand-50/50 dark:bg-brand-900/20">
                      {formatCurrency(row.you)}
                    </td>
                    {COMP_KEYS.map((key) => (
                      <CompCell key={key} value={(row as any)[key]} median={row.median} />
                    ))}
                    <td className="text-right px-3 font-mono tabular-nums text-muted-foreground">
                      {formatCurrency(row.median)}
                    </td>
                    <td className="text-right px-3">
                      <Badge
                        variant={outlier ? (gap > 0 ? "warning" : "critical") : "secondary"}
                        className="font-mono text-[10px]"
                      >
                        {gap > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {gap > 0 ? "+" : ""}
                        {gap.toFixed(1)}%
                      </Badge>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-brand-50 border border-brand-200 dark:bg-brand-900/20 dark:border-brand-800/60" />
            Your rate
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/50" />
            Outlier night (&gt;10% gap)
          </span>
          <span className="ml-auto">Source: competitor_rates · hotel_comp_set · refreshed every 4h</span>
        </div>
      </CardContent>
    </Card>
  );
}

function CompCell({ value, median }: { value: number; median: number }) {
  const gap = ((value - median) / median) * 100;
  return (
    <td className="text-right px-3 font-mono tabular-nums">
      <span
        className={cn(
          gap < -8 && "text-red-600 dark:text-red-400",
          gap > 8 && "text-emerald-600 dark:text-emerald-400"
        )}
      >
        {formatCurrency(value)}
      </span>
    </td>
  );
}
