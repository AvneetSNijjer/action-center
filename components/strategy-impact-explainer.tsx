"use client";
import { motion } from "framer-motion";
import { ArrowRight, TrendingUp, TrendingDown, Minus, Lightbulb, Cog } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useStrategy } from "@/components/strategy-provider";
import { getMode } from "@/lib/strategy";
import { cn } from "@/lib/utils";

export function StrategyImpactExplainer() {
  const { config } = useStrategy();
  const mode = getMode(config.modeId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>What this strategy changes</CardTitle>
        <CardDescription>
          Plain-language breakdown of how the pricing engine behaves under the active mode.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Engine effect */}
        <div className="rounded-xl border border-border bg-card/60 p-4">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            <Cog className="h-3 w-3" />
            How the engine behaves
          </div>
          <div className="space-y-3">
            {mode.engineEffect.map((e, i) => (
              <motion.div
                key={e.label}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-start gap-2.5 text-sm leading-snug"
              >
                <ArrowRight className="h-3.5 w-3.5 mt-0.5 text-brand-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="font-semibold">{e.label}: </span>
                  <span className="text-muted-foreground">{e.detail}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Expected outcomes */}
        <div className="rounded-xl border border-border bg-card/60 p-4">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            <Lightbulb className="h-3 w-3" />
            Expected outcome
          </div>
          <div className="space-y-2.5">
            {mode.expectedOutcome.map((o, i) => {
              const Icon =
                o.direction === "up" ? TrendingUp : o.direction === "down" ? TrendingDown : Minus;
              const tone =
                o.direction === "up"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : o.direction === "down"
                  ? "text-red-600 dark:text-red-400"
                  : "text-muted-foreground";
              return (
                <motion.div
                  key={o.metric}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 + 0.1 }}
                  className="flex items-center gap-3 text-sm"
                >
                  <Icon className={cn("h-4 w-4 shrink-0", tone)} />
                  <span className="flex-1 font-medium">{o.metric}</span>
                  <span className={cn("font-mono tabular-nums text-xs font-semibold", tone)}>
                    {o.range}
                  </span>
                </motion.div>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-border text-[11px] leading-relaxed">
            <span className="text-muted-foreground font-medium">When to use: </span>
            <span className="text-foreground">{mode.whenToUse}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
