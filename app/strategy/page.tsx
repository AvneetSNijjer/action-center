"use client";
import { motion } from "framer-motion";
import { Compass } from "lucide-react";
import { StrategyModeCard } from "@/components/strategy-mode-card";
import { StrategyGoals } from "@/components/strategy-goals";
import { StrategyPerformance } from "@/components/strategy-performance";
import { StrategyImpactExplainer } from "@/components/strategy-impact-explainer";

export default function StrategyPage() {
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between gap-3 flex-wrap"
      >
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Pricing Strategy</h1>
            <span className="rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 px-2 py-0.5 text-[10px] font-semibold ring-1 ring-brand-200 dark:ring-brand-800/60 inline-flex items-center gap-1">
              <Compass className="h-3 w-3" />
              ENGINE ACTIVE
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Set the strategy mode and your goals — the pricing engine reads these every cycle to
            decide how aggressive to be on rate moves, where to clamp prices, and which deviations
            trigger action.
          </p>
        </div>
      </motion.div>

      <StrategyModeCard />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <StrategyGoals />
        </div>
        <div className="lg:col-span-2">
          <StrategyImpactExplainer />
        </div>
      </div>

      <StrategyPerformance />
    </div>
  );
}
