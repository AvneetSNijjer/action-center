"use client";
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  Brain,
  Calculator,
  Users,
} from "lucide-react";
import type { Insight } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";

/**
 * "Why this price?" — collapsible explainability panel.
 * Data shape mirrors what pricing_calculation_logs + suggested_prices store today.
 */
export function WhyThisPrice({ insight }: { insight: Insight }) {
  const [open, setOpen] = React.useState(false);
  const ex = insight.explainability;
  if (!ex) return null;

  const maxAbs = Math.max(...ex.drivers.map((d) => Math.abs(d.contribution)), 1);

  return (
    <div className="rounded-xl border border-brand-100 dark:border-brand-900/40 bg-gradient-to-br from-brand-50/70 via-white to-transparent dark:from-brand-900/20 dark:via-transparent dark:to-transparent overflow-hidden">
      {/* Header / toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "group w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
          "hover:bg-brand-50/60 dark:hover:bg-brand-900/30",
          open && "bg-brand-50/40 dark:bg-brand-900/20"
        )}
        aria-expanded={open}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-300 ring-1 ring-inset ring-brand-200/60 dark:ring-brand-800/60">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold leading-tight">Why this price?</div>
          <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
            Plain-language breakdown of every driver behind the recommendation
          </div>
        </div>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0 text-muted-foreground group-hover:text-foreground"
        >
          <ChevronDown className="h-4 w-4" />
        </motion.div>
      </button>

      {/* Body */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 space-y-4 border-t border-brand-100/60 dark:border-brand-900/40">
              {/* 1) Engine narrative */}
              <Section icon={<Brain className="h-3 w-3" />} label="Engine narrative">
                <div className="rounded-lg bg-card border border-border p-3">
                  <p className="text-sm leading-relaxed text-foreground">{ex.narrative}</p>
                </div>
              </Section>

              {/* 2) Driver bars */}
              <Section label="Decision drivers">
                <div className="space-y-1.5">
                  {ex.drivers.map((d, i) => {
                    const pct = (Math.abs(d.contribution) / maxAbs) * 100;
                    const isUp = d.direction === "up";
                    const isDown = d.direction === "down";
                    const barColor = isUp
                      ? "bg-emerald-500"
                      : isDown
                      ? "bg-red-500"
                      : "bg-muted-foreground/40";
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.25, delay: i * 0.05 }}
                        className="grid grid-cols-[minmax(0,1fr)_minmax(60px,2fr)_auto] items-center gap-3"
                      >
                        <div className="flex items-center gap-1.5 text-xs min-w-0">
                          {isUp ? (
                            <TrendingUp className="h-3 w-3 text-emerald-500 shrink-0" />
                          ) : isDown ? (
                            <TrendingDown className="h-3 w-3 text-red-500 shrink-0" />
                          ) : (
                            <Minus className="h-3 w-3 text-muted-foreground shrink-0" />
                          )}
                          <span className="truncate">{d.label}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.5, delay: 0.1 + i * 0.05, ease: "easeOut" }}
                            className={cn("h-full rounded-full", barColor)}
                          />
                        </div>
                        <div className="w-12 text-right text-xs font-mono tabular-nums shrink-0">
                          {d.contribution > 0 ? "+" : ""}
                          {d.contribution !== 0 ? `$${d.contribution}` : "—"}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </Section>

              {/* 3) Algorithm inputs */}
              {ex.calculation && (
                <Section
                  icon={<Calculator className="h-3 w-3" />}
                  label="Algorithm inputs"
                  hint="from pricing_calculation_logs"
                >
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <CalcCell label="Base price" value={formatCurrency(ex.calculation.basePrice)} />
                    <CalcCell
                      label="Suggested"
                      value={formatCurrency(ex.calculation.suggestedPrice)}
                      highlight
                    />
                    <CalcCell label="Floor" value={formatCurrency(ex.calculation.floorPrice)} subtle />
                    <CalcCell label="Ceiling" value={formatCurrency(ex.calculation.ceilingPrice)} subtle />
                    <CalcCell label="DOW weight" value={`${ex.calculation.dowWeight}×`} />
                    <CalcCell
                      label="Dynamic elasticity"
                      value={ex.calculation.dynamicElasticity.toFixed(2)}
                    />
                    <CalcCell label="occ_push" value={ex.calculation.occPush.toFixed(3)} />
                    <CalcCell label="pick_push" value={ex.calculation.pickPush.toFixed(3)} />
                    <CalcCell
                      label="Adjustment factor"
                      value={`${(ex.calculation.adjustmentFactor * 100).toFixed(1)}%`}
                      highlight
                    />
                    <CalcCell label="Days out" value={`${ex.calculation.daysUntilStay} days`} />
                    <CalcCell
                      label="Current occ"
                      value={`${(ex.calculation.currentOccupancy * 100).toFixed(0)}%`}
                    />
                    <CalcCell
                      label="Expected occ"
                      value={`${(ex.calculation.expectedOccupancy * 100).toFixed(0)}%`}
                    />
                  </div>
                </Section>
              )}

              {/* 4) Comp-set context */}
              {ex.compSet && ex.compSet.length > 0 && (
                <Section icon={<Users className="h-3 w-3" />} label="Comp-set context">
                  <div className="rounded-lg border border-border bg-card overflow-hidden divide-y divide-border">
                    {ex.compSet.map((c) => {
                      const isYou = c.gap === 0;
                      return (
                        <div
                          key={c.name}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 text-xs",
                            isYou && "bg-brand-50/50 dark:bg-brand-900/20"
                          )}
                        >
                          <span
                            className={cn(
                              "flex-1 min-w-0 truncate font-medium",
                              isYou && "text-brand-700 dark:text-brand-300"
                            )}
                          >
                            {c.name}
                          </span>
                          <span className="font-mono tabular-nums text-foreground">
                            {formatCurrency(c.price)}
                          </span>
                          <span
                            className={cn(
                              "w-16 text-right font-mono tabular-nums text-[11px]",
                              c.gap < 0 && "text-red-600 dark:text-red-400",
                              c.gap > 0 && "text-emerald-600 dark:text-emerald-400",
                              isYou && "text-muted-foreground"
                            )}
                          >
                            {isYou ? "you" : c.gap > 0 ? `+$${c.gap}` : `−$${Math.abs(c.gap)}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </Section>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Section({
  icon,
  label,
  hint,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {icon}
        <span>{label}</span>
        {hint && (
          <span className="ml-auto text-[9px] font-normal normal-case text-muted-foreground">
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function CalcCell({
  label,
  value,
  highlight,
  subtle,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  subtle?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-border bg-background px-2.5 py-1.5 transition-colors",
        highlight &&
          "border-brand-200 bg-brand-50/70 dark:border-brand-800/60 dark:bg-brand-900/30",
        subtle && "opacity-65"
      )}
    >
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground font-medium">
        {label}
      </div>
      <div className="font-mono tabular-nums text-sm font-semibold leading-tight">{value}</div>
    </div>
  );
}
