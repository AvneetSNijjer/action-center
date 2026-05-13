"use client";
import * as React from "react";
import { motion } from "framer-motion";
import { Save, RotateCcw, DollarSign, Percent, Globe2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStrategy } from "@/components/strategy-provider";
import { ActionToast } from "@/components/action-toast";
import { cn, formatCurrency } from "@/lib/utils";
import type { PricingConfigRow } from "@/lib/queries/strategy";

export function StrategyGoals({
  pricingConfig,
}: {
  /** Live pricing config from DB. When provided, pre-seeds ADR floor/ceiling. */
  pricingConfig?: PricingConfigRow | null;
}) {
  const { config, setGoals, reset } = useStrategy();
  const [local, setLocal] = React.useState(config.goals);
  const [toast, setToast] = React.useState<string | null>(null);

  // Sync local form state when context hydrates from localStorage
  React.useEffect(() => {
    setLocal(config.goals);
  }, [config.goals]);

  // When live DB pricing config arrives, update floor/ceiling if they haven't been customized
  React.useEffect(() => {
    if (!pricingConfig) return;
    setLocal((prev) => ({
      ...prev,
      adrFloor: pricingConfig.floorPrice > 0 ? pricingConfig.floorPrice : prev.adrFloor,
      adrCeiling: pricingConfig.ceilingPrice > 0 ? pricingConfig.ceilingPrice : prev.adrCeiling,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricingConfig?.floorPrice, pricingConfig?.ceilingPrice]);

  const dirty =
    JSON.stringify(local) !== JSON.stringify(config.goals);

  const handleSave = () => {
    setGoals(local);
    setToast("Goals saved · pricing engine will pick them up next cycle");
    setTimeout(() => setToast(null), 2400);
  };

  const handleReset = () => {
    reset();
    setToast("Reset to defaults");
    setTimeout(() => setToast(null), 1800);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Goals & Targets</CardTitle>
          <CardDescription>
            Tell the engine what success looks like. The pricing algorithm reads these every cycle.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <GoalField
              icon={<DollarSign className="h-3.5 w-3.5" />}
              label="Monthly revenue target"
              hint="Ownership-facing top-line number for the month"
              value={local.monthlyRevenueTarget}
              onChange={(v) => setLocal({ ...local, monthlyRevenueTarget: v })}
              min={0}
              max={5_000_000}
              step={10_000}
              format={(v) => formatCurrency(v)}
              tone="brand"
            />
            <GoalField
              icon={<Percent className="h-3.5 w-3.5" />}
              label="Target occupancy"
              hint="Average occupancy you want to maintain"
              value={local.targetOccupancy}
              onChange={(v) => setLocal({ ...local, targetOccupancy: v })}
              min={20}
              max={100}
              step={1}
              format={(v) => `${v}%`}
              tone="emerald"
            />
            <GoalField
              icon={<DollarSign className="h-3.5 w-3.5" />}
              label="ADR floor"
              hint="Lowest acceptable rate. Algorithm will never go below this."
              value={local.adrFloor}
              onChange={(v) =>
                setLocal({ ...local, adrFloor: Math.min(v, local.adrCeiling - 5) })
              }
              min={50}
              max={500}
              step={5}
              format={(v) => formatCurrency(v)}
              tone="amber"
            />
            <GoalField
              icon={<DollarSign className="h-3.5 w-3.5" />}
              label="ADR ceiling"
              hint="Highest acceptable rate. Algorithm will never exceed this."
              value={local.adrCeiling}
              onChange={(v) =>
                setLocal({ ...local, adrCeiling: Math.max(v, local.adrFloor + 5) })
              }
              min={100}
              max={1500}
              step={5}
              format={(v) => formatCurrency(v)}
              tone="amber"
            />
            <GoalField
              icon={<Globe2 className="h-3.5 w-3.5" />}
              label="Target direct booking share"
              hint="Reduce OTA dependency by hitting this direct-channel %"
              value={local.directBookingTarget}
              onChange={(v) => setLocal({ ...local, directBookingTarget: v })}
              min={0}
              max={100}
              step={1}
              format={(v) => `${v}%`}
              tone="indigo"
              fullWidth
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-3 border-t border-border">
            <div className="text-[11px] text-muted-foreground">
              {dirty ? "Unsaved changes" : "All changes saved"}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleReset}>
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </Button>
              <Button size="sm" onClick={handleSave} disabled={!dirty}>
                <Save className="h-3.5 w-3.5" />
                Save goals
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <ActionToast message={toast || ""} show={!!toast} />
    </>
  );
}

const toneClasses: Record<string, { bg: string; text: string; bar: string }> = {
  brand: {
    bg: "bg-brand-50 dark:bg-brand-900/30",
    text: "text-brand-700 dark:text-brand-300",
    bar: "bg-brand-500",
  },
  emerald: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-300",
    bar: "bg-emerald-500",
  },
  amber: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-300",
    bar: "bg-amber-500",
  },
  indigo: {
    bg: "bg-indigo-50 dark:bg-indigo-950/40",
    text: "text-indigo-700 dark:text-indigo-300",
    bar: "bg-indigo-500",
  },
};

function GoalField({
  icon,
  label,
  hint,
  value,
  onChange,
  min,
  max,
  step,
  format,
  tone,
  fullWidth,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  tone: string;
  fullWidth?: boolean;
}) {
  const t = toneClasses[tone] || toneClasses.brand;
  return (
    <div className={cn("space-y-2", fullWidth && "md:col-span-2")}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className={cn("flex h-5 w-5 items-center justify-center rounded-md", t.bg, t.text)}>
            {icon}
          </span>
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span className={cn("font-mono tabular-nums text-sm font-semibold", t.text)}>
          {format(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn(
          "w-full h-2 rounded-full appearance-none cursor-pointer outline-none",
          "bg-muted",
          "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4",
          "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground",
          "[&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-transform",
          "[&::-webkit-slider-thumb]:hover:scale-110",
          "[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full",
          "[&::-moz-range-thumb]:bg-foreground [&::-moz-range-thumb]:border-0"
        )}
        style={{
          background: `linear-gradient(to right, var(--tw-gradient-from) 0%, var(--tw-gradient-from) ${
            ((value - min) / (max - min)) * 100
          }%, hsl(var(--muted)) ${((value - min) / (max - min)) * 100}%, hsl(var(--muted)) 100%)`,
        }}
      />
      <div className="text-[11px] text-muted-foreground leading-snug">{hint}</div>
    </div>
  );
}
