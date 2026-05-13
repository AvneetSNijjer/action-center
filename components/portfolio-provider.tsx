"use client";
import * as React from "react";
import { HOTEL_GROUP } from "@/lib/portfolio";

export type Scope = "group" | "property";

interface PortfolioContextValue {
  scope: Scope;
  activePropertyId: string;
  hydrated: boolean;
  setScope: (s: Scope) => void;
  setActiveProperty: (id: string, opts?: { switchToProperty?: boolean }) => void;
  switchToGroup: () => void;
}

const PortfolioContext = React.createContext<PortfolioContextValue | null>(null);

const STORAGE_KEY = "ampliphi.portfolio.v1";

interface StoredState {
  scope: Scope;
  activePropertyId: string;
}

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
  // Default: group scope on first load (matches multi-property user expectation)
  const [scope, setScopeState] = React.useState<Scope>("group");
  const [activePropertyId, setActivePropertyIdState] = React.useState<string>(
    HOTEL_GROUP.properties[0].id
  );
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<StoredState>;
        if (parsed.scope === "group" || parsed.scope === "property") {
          setScopeState(parsed.scope);
        }
        if (
          parsed.activePropertyId &&
          HOTEL_GROUP.properties.some((p) => p.id === parsed.activePropertyId)
        ) {
          setActivePropertyIdState(parsed.activePropertyId);
        }
      }
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      const state: StoredState = { scope, activePropertyId };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [scope, activePropertyId, hydrated]);

  const setScope = React.useCallback((s: Scope) => setScopeState(s), []);

  const setActiveProperty = React.useCallback(
    (id: string, opts?: { switchToProperty?: boolean }) => {
      setActivePropertyIdState(id);
      if (opts?.switchToProperty) setScopeState("property");
    },
    []
  );

  const switchToGroup = React.useCallback(() => setScopeState("group"), []);

  return (
    <PortfolioContext.Provider
      value={{
        scope,
        activePropertyId,
        hydrated,
        setScope,
        setActiveProperty,
        switchToGroup,
      }}
    >
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const ctx = React.useContext(PortfolioContext);
  if (!ctx) throw new Error("usePortfolio must be used inside PortfolioProvider");
  return ctx;
}
