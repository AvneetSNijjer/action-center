"use client";
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStrategy } from "@/components/strategy-provider";
import { STRATEGY_MODES, getMode } from "@/lib/strategy";
import { cn } from "@/lib/utils";

export function StrategyModeCard() {
  const { config, setMode } = useStrategy();
  const active = getMode(config.modeId);
  const ActiveIcon = active.icon;
  const [picking, setPicking] = React.useState(false);

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-0 bg-mesh opacity-50 pointer-events-none" />
      <div className="relative p-6">
        {/* Active mode header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4 min-w-0">
            <div
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-2xl ring-1 ring-inset shrink-0",
                active.accent.bg,
                active.accent.text,
                active.accent.border
              )}
            >
              <ActiveIcon className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Active strategy
                </div>
                <Badge variant="opportunity" className="text-[10px]">
                  <span className={cn("h-1.5 w-1.5 rounded-full mr-1", active.accent.dot)} />
                  Live
                </Badge>
              </div>
              <h2 className="mt-1 text-2xl font-bold tracking-tight leading-tight">
                {active.label}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground max-w-xl">{active.description}</p>
            </div>
          </div>
          <Button
            variant={picking ? "outline" : "default"}
            onClick={() => setPicking((v) => !v)}
            className="shrink-0"
          >
            {picking ? "Cancel" : "Change strategy"}
            {!picking && <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>

        {/* Mode picker grid */}
        <AnimatePresence initial={false}>
          {picking && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-6 pt-6 border-t border-border">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Choose strategy mode
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {STRATEGY_MODES.map((mode, i) => {
                    const Icon = mode.icon;
                    const isActive = mode.id === config.modeId;
                    return (
                      <motion.button
                        key={mode.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        whileHover={{ y: -2 }}
                        onClick={() => {
                          setMode(mode.id);
                          setPicking(false);
                        }}
                        className={cn(
                          "group relative text-left rounded-xl border p-4 transition-all bg-card",
                          isActive
                            ? cn(mode.accent.border, "ring-2 ring-offset-2 ring-offset-background", mode.accent.bg)
                            : "border-border hover:border-foreground/20"
                        )}
                      >
                        {isActive && (
                          <div className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background">
                            <Check className="h-3 w-3" />
                          </div>
                        )}
                        <div
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-lg mb-3",
                            mode.accent.bg,
                            mode.accent.text
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="font-semibold text-sm leading-tight">{mode.label}</div>
                        <div className="text-[11px] text-muted-foreground mt-1 leading-snug">
                          {mode.short}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  );
}
