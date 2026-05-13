"use client";
import * as React from "react";
import useSWR from "swr";
import { HOTEL_GROUP } from "@/lib/portfolio";
import type { Property } from "@/lib/portfolio";
import type { HotelRow } from "@/lib/queries/hotels";

export type Scope = "group" | "property";

/** Shape exposed through the context — backwards compatible + extensions. */
interface PortfolioContextValue {
  scope: Scope;
  activePropertyId: string;
  hydrated: boolean;
  isLoading: boolean;
  /** All hotels from DB (or mock fallback). */
  hotels: HotelRow[];
  /** Active hotel from DB (or null if not yet loaded). */
  activeHotel: HotelRow | null;
  /** Groups concept — currently a single group with all hotels. */
  groups: Array<{ id: string; name: string; propertyIds: string[] }>;
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

const DEFAULT_HOTEL_ID =
  process.env.NEXT_PUBLIC_DEFAULT_HOTEL_ID ??
  HOTEL_GROUP.properties[0].id;

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

/** Convert a DB HotelRow to a mock-compatible Property (best-effort). */
function hotelRowToProperty(h: HotelRow): Property {
  return {
    id: h.id,
    name: h.name,
    city: h.city,
    state: h.state,
    rooms: 0, // not available in basic listing
    status: "on_track",
    openActions: h.pendingApprovals,
    criticalActions: 0,
    strategyMode: "maximize_revenue",
    kpis: {
      occupancy: h.occupancy ?? 0,
      adr: h.adr ?? 0,
      revpar: h.revpar ?? 0,
      revenueMtd: 0,
      paceVsStly: 0,
      forecastAccuracy: 0,
    },
    revparTrend: [],
  };
}

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
  const [scope, setScopeState] = React.useState<Scope>("group");
  const [activePropertyId, setActivePropertyIdState] = React.useState<string>(DEFAULT_HOTEL_ID);
  const [hydrated, setHydrated] = React.useState(false);

  // Fetch hotels from DB with KPIs
  const { data: hotelsResponse, isLoading } = useSWR<{
    ok: boolean;
    data: HotelRow[];
  }>("/api/hotels?withKpis=true", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
    shouldRetryOnError: false,
  });

  const dbHotels: HotelRow[] = React.useMemo(() => {
    if (hotelsResponse?.ok && Array.isArray(hotelsResponse.data)) {
      return hotelsResponse.data;
    }
    return [];
  }, [hotelsResponse]);

  // Hydrate from localStorage
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<StoredState>;
        if (parsed.scope === "group" || parsed.scope === "property") {
          setScopeState(parsed.scope);
        }
        if (parsed.activePropertyId) {
          setActivePropertyIdState(parsed.activePropertyId);
        }
      }
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  // Persist to localStorage
  React.useEffect(() => {
    if (!hydrated) return;
    try {
      const state: StoredState = { scope, activePropertyId };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [scope, activePropertyId, hydrated]);

  const activeHotel = React.useMemo(
    () => dbHotels.find((h) => h.id === activePropertyId) ?? null,
    [dbHotels, activePropertyId]
  );

  const groups = React.useMemo(() => {
    if (!dbHotels.length) return [];
    return [
      {
        id: "all",
        name: HOTEL_GROUP.name,
        propertyIds: dbHotels.map((h) => h.id),
      },
    ];
  }, [dbHotels]);

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
        isLoading,
        hotels: dbHotels,
        activeHotel,
        groups,
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
