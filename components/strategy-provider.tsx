"use client";
import * as React from "react";
import {
  DEFAULT_STRATEGY,
  type StrategyConfig,
  type StrategyModeId,
  type StrategyGoals,
} from "@/lib/strategy";

interface StrategyContextValue {
  config: StrategyConfig;
  hydrated: boolean;
  setMode: (id: StrategyModeId) => void;
  setGoals: (patch: Partial<StrategyGoals>) => void;
  reset: () => void;
}

const StrategyContext = React.createContext<StrategyContextValue | null>(null);

const STORAGE_KEY = "ampliphi.strategy.v1";

export function StrategyProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = React.useState<StrategyConfig>(DEFAULT_STRATEGY);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<StrategyConfig>;
        setConfig({
          modeId: parsed.modeId || DEFAULT_STRATEGY.modeId,
          goals: { ...DEFAULT_STRATEGY.goals, ...(parsed.goals || {}) },
        });
      }
    } catch {
      // ignore parse errors, fall back to default
    }
    setHydrated(true);
  }, []);

  // Persist on change (after initial hydration)
  React.useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      // ignore quota errors
    }
  }, [config, hydrated]);

  const setMode = React.useCallback(
    (id: StrategyModeId) => setConfig((c) => ({ ...c, modeId: id })),
    []
  );
  const setGoals = React.useCallback(
    (patch: Partial<StrategyGoals>) =>
      setConfig((c) => ({ ...c, goals: { ...c.goals, ...patch } })),
    []
  );
  const reset = React.useCallback(() => setConfig(DEFAULT_STRATEGY), []);

  return (
    <StrategyContext.Provider value={{ config, hydrated, setMode, setGoals, reset }}>
      {children}
    </StrategyContext.Provider>
  );
}

export function useStrategy() {
  const ctx = React.useContext(StrategyContext);
  if (!ctx) throw new Error("useStrategy must be used inside StrategyProvider");
  return ctx;
}
