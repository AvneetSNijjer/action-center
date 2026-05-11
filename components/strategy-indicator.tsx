"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useStrategy } from "@/components/strategy-provider";
import { getMode } from "@/lib/strategy";
import { cn } from "@/lib/utils";

/**
 * Compact "Strategy: X" badge shown on the Action Center home.
 * Click → navigates to /strategy.
 */
export function StrategyIndicator() {
  const { config, hydrated } = useStrategy();
  if (!hydrated) return null; // avoid hydration flash
  const mode = getMode(config.modeId);
  const Icon = mode.icon;
  return (
    <Link href="/strategy" className="inline-flex">
      <motion.span
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -1 }}
        className={cn(
          "group inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
          mode.accent.bg,
          mode.accent.text,
          mode.accent.border
        )}
      >
        <Icon className="h-3 w-3" />
        <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70">Strategy</span>
        <span className="font-semibold">{mode.label}</span>
        <ChevronRight className="h-3 w-3 opacity-50 group-hover:opacity-100 transition-opacity" />
      </motion.span>
    </Link>
  );
}
