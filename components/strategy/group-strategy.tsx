"use client";
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Compass,
  Layers,
  CheckCircle2,
  Send,
  ArrowRight,
  Building2,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActionToast } from "@/components/action-toast";
import { STATUS_META, type Property } from "@/lib/portfolio";
import { STRATEGY_MODES, getMode, type StrategyModeId } from "@/lib/strategy";
import { cn, formatCurrency } from "@/lib/utils";
import { usePortfolio, hotelRowToProperty } from "@/components/portfolio-provider";

export function GroupStrategy() {
  const { hotels: dbHotels } = usePortfolio();

  // Convert DB hotels to Property objects; default strategy to "maximize_revenue"
  const properties: Property[] = React.useMemo(
    () => dbHotels.map((h) => hotelRowToProperty(h)),
    [dbHotels]
  );

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [newMode, setNewMode] = React.useState<StrategyModeId | null>(null);
  const [confirming, setConfirming] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);

  const fireToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  // Mode distribution — all real hotels default to maximize_revenue
  const modeCounts = React.useMemo(() => {
    const counts: Record<StrategyModeId, number> = {
      maximize_revenue: 0,
      maximize_occupancy: 0,
      protect_adr: 0,
      hit_target: 0,
      direct_push: 0,
      custom: 0,
    };
    properties.forEach((p) => {
      counts[p.strategyMode]++;
    });
    return counts;
  }, [properties]);

  const toggleProperty = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === properties.length) setSelected(new Set());
    else setSelected(new Set(properties.map((p) => p.id)));
  };

  const handleApply = () => {
    if (!newMode || selected.size === 0) return;
    setConfirming(true);
  };

  const handleConfirm = () => {
    const count = selected.size;
    const modeLabel = newMode ? getMode(newMode).label : "";
    setConfirming(false);
    setSelected(new Set());
    setNewMode(null);
    fireToast(`${modeLabel} applied to ${count} propert${count === 1 ? "y" : "ies"}`);
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-semibold tracking-tight">Pricing Strategy</h1>
          <span className="rounded-full bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 px-2 py-0.5 text-[10px] font-semibold ring-1 ring-violet-200 dark:ring-violet-900/50 inline-flex items-center gap-1">
            <Layers className="h-3 w-3" />
            BULK DEPLOY
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Apply strategy changes across multiple properties at once. Select properties → pick a
          mode → preview the impact → confirm.
        </p>
      </motion.div>

      {/* Mode distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Strategy distribution across portfolio</CardTitle>
          <CardDescription>
            How your {properties.length} properties are currently configured.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {STRATEGY_MODES.map((mode, i) => {
              const count = modeCounts[mode.id];
              const Icon = mode.icon;
              return (
                <motion.div
                  key={mode.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.04 }}
                  className={cn(
                    "rounded-xl border p-3 text-center transition-all",
                    count > 0 ? mode.accent.border : "border-border",
                    count > 0 ? mode.accent.bg : "bg-card/40"
                  )}
                >
                  <div
                    className={cn(
                      "mx-auto flex h-9 w-9 items-center justify-center rounded-lg mb-2",
                      mode.accent.bg,
                      mode.accent.text
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="text-xl font-bold tabular-nums leading-tight">{count}</div>
                  <div className="text-[10px] font-medium text-muted-foreground leading-tight mt-1">
                    {mode.label}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Bulk deploy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-4 w-4 text-brand-500" />
            Bulk Strategy Deploy
          </CardTitle>
          <CardDescription>
            Select properties, pick a new strategy mode, and apply it in one operation. The
            pricing engine picks up changes on the next cycle.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Step 1: Select properties */}
          <Step
            number={1}
            label="Select properties"
            hint={
              selected.size === 0
                ? "No properties selected"
                : `${selected.size} of ${properties.length} selected`
            }
            action={
              <Button variant="outline" size="sm" onClick={toggleAll}>
                {selected.size === properties.length ? "Clear all" : "Select all"}
              </Button>
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {properties.map((p) => (
                <PropertyChecklistRow
                  key={p.id}
                  property={p}
                  checked={selected.has(p.id)}
                  onToggle={() => toggleProperty(p.id)}
                />
              ))}
            </div>
          </Step>

          {/* Step 2: Pick a mode */}
          <Step
            number={2}
            label="Pick new strategy mode"
            hint={newMode ? getMode(newMode).label : "No mode selected"}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {STRATEGY_MODES.map((mode) => {
                const Icon = mode.icon;
                const isActive = newMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    onClick={() => setNewMode(mode.id)}
                    className={cn(
                      "text-left rounded-lg border p-3 transition-all",
                      isActive
                        ? cn(mode.accent.border, "ring-2 ring-offset-2 ring-offset-background", mode.accent.bg)
                        : "border-border bg-card hover:bg-accent/40"
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                          mode.accent.bg,
                          mode.accent.text
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold leading-tight">{mode.label}</div>
                        <div className="text-[11px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">
                          {mode.short}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Step>

          {/* Step 3: Preview + Apply */}
          <Step
            number={3}
            label="Preview & apply"
            hint={
              selected.size === 0 || !newMode
                ? "Complete steps 1 and 2 first"
                : `Will change ${selected.size} propert${selected.size === 1 ? "y" : "ies"}`
            }
          >
            <AnimatePresence>
              {selected.size > 0 && newMode && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Preview — before / after
                    </div>
                    {Array.from(selected).map((id) => {
                      const p = properties.find((x) => x.id === id);
                      if (!p) return null;
                      const oldMode = getMode(p.strategyMode);
                      const next = getMode(newMode);
                      return (
                        <div
                          key={id}
                          className="flex items-center gap-3 rounded-md bg-background border border-border px-3 py-2 text-sm flex-wrap"
                        >
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="font-semibold flex-1 min-w-0 truncate">{p.name}</span>
                          <Badge variant="secondary" className="text-[10px]">
                            {oldMode.label}
                          </Badge>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                          <Badge
                            className={cn("text-[10px] font-semibold border", next.accent.border, next.accent.bg, next.accent.text)}
                          >
                            {next.label}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                disabled={selected.size === 0 || !newMode}
                onClick={handleApply}
                size="lg"
              >
                <Send className="h-4 w-4" />
                Apply to {selected.size} propert{selected.size === 1 ? "y" : "ies"}
              </Button>
            </div>
          </Step>
        </CardContent>
      </Card>

      {/* Per-property strategy snapshot */}
      <Card>
        <CardHeader>
          <CardTitle>Current strategy per property</CardTitle>
          <CardDescription>
            What each hotel is set to today, plus a quick performance read.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left font-medium py-2.5 px-3">Property</th>
                  <th className="text-left font-medium py-2.5 px-3">Strategy</th>
                  <th className="text-right font-medium py-2.5 px-3">RevPAR</th>
                  <th className="text-right font-medium py-2.5 px-3">Pace vs STLY</th>
                  <th className="text-right font-medium py-2.5 px-3">Revenue MTD</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((p, i) => {
                  const mode = getMode(p.strategyMode);
                  const Icon = mode.icon;
                  const status = STATUS_META[p.status];
                  const paceUp = p.kpis.paceVsStly >= 0;
                  return (
                    <tr
                      key={p.id}
                      className="border-t border-border hover:bg-accent/30 transition-colors"
                    >
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
                          <span className="font-semibold">{p.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge
                          className={cn("text-[10px] font-semibold border", mode.accent.border, mode.accent.bg, mode.accent.text)}
                        >
                          <Icon className="h-3 w-3" />
                          {mode.label}
                        </Badge>
                      </td>
                      <td className="text-right px-3 font-mono tabular-nums font-semibold">
                        {formatCurrency(p.kpis.revpar)}
                      </td>
                      <td className="text-right px-3 font-mono tabular-nums">
                        <span
                          className={cn(
                            paceUp ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                          )}
                        >
                          {paceUp ? "+" : ""}
                          {p.kpis.paceVsStly.toFixed(1)}%
                        </span>
                      </td>
                      <td className="text-right px-3 font-mono tabular-nums text-muted-foreground">
                        {formatCurrency(p.kpis.revenueMtd)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation modal */}
      <AnimatePresence>
        {confirming && newMode && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirming(false)}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-2xl"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300 mb-3">
                <Send className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-semibold">Confirm bulk deployment</h2>
              <p className="text-sm text-muted-foreground mt-1">
                You are about to set{" "}
                <span className="font-semibold text-foreground">{selected.size}</span> propert
                {selected.size === 1 ? "y" : "ies"} to{" "}
                <span className="font-semibold text-foreground">{getMode(newMode).label}</span>.
                The pricing engine will pick up the change on its next cycle.
              </p>
              <div className="mt-4 flex items-center justify-end gap-2">
                <Button variant="outline" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
                <Button onClick={handleConfirm}>
                  <CheckCircle2 className="h-4 w-4" />
                  Confirm & apply
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ActionToast message={toast || ""} show={!!toast} />
    </div>
  );
}

function Step({
  number,
  label,
  hint,
  action,
  children,
}: {
  number: number;
  label: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 text-[11px] font-bold">
            {number}
          </span>
          <span className="text-sm font-semibold">{label}</span>
          {hint && <span className="text-[11px] text-muted-foreground">· {hint}</span>}
        </div>
        {action}
      </div>
      <div className="pl-8">{children}</div>
    </div>
  );
}

function PropertyChecklistRow({
  property,
  checked,
  onToggle,
}: {
  property: Property;
  checked: boolean;
  onToggle: () => void;
}) {
  const status = STATUS_META[property.status];
  const mode = getMode(property.strategyMode);
  return (
    <button
      onClick={onToggle}
      className={cn(
        "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all",
        checked
          ? "border-brand-300 bg-brand-50/60 dark:border-brand-700 dark:bg-brand-900/30"
          : "border-border bg-card hover:bg-accent/40"
      )}
    >
      <div
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-md border-2 transition-colors shrink-0",
          checked ? "bg-brand-500 border-brand-500 text-white" : "border-border bg-background"
        )}
      >
        {checked && <CheckCircle2 className="h-3 w-3" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", status.dot)} />
          <span className="font-semibold text-sm truncate">{property.name}</span>
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
          <span>{property.rooms} rooms</span>
          <span>·</span>
          <span>Currently: {mode.label}</span>
        </div>
      </div>
    </button>
  );
}
