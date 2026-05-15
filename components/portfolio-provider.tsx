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
  /** All hotels from DB (filtered by role). */
  hotels: HotelRow[];
  /** Active hotel from DB (or null if not yet loaded). */
  activeHotel: HotelRow | null;
  /** Groups concept — currently a single group with all hotels. */
  groups: Array<{ id: string; name: string; propertyIds: string[] }>;
  /** Role returned from /api/hotels meta — "admin" | "customer" */
  role: string;
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

// Use the env-var default if set; fall back to empty string so that SWR null-guards
// (`activePropertyId ? url : null`) prevent API calls until the hotel list loads
// and the validation effect picks a real first hotel.  The old fallback of
// HOTEL_GROUP.properties[0].id ("h-grand-marina") doesn't exist in the DB and
// caused 500 errors across every widget until the hotels SWR resolved.
const DEFAULT_HOTEL_ID = process.env.NEXT_PUBLIC_DEFAULT_HOTEL_ID ?? "";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

/** Convert a DB HotelRow to a mock-compatible Property (best-effort). */
/** Derive property status from live KPI data. */
function deriveStatus(h: HotelRow): "critical" | "needs_review" | "on_track" {
  const pending = h.pendingApprovals ?? 0;
  const occ     = h.occupancy ?? null;
  if (pending > 100 || (occ !== null && occ < 30)) return "critical";
  if (pending > 20  || (occ !== null && occ < 55)) return "needs_review";
  return "on_track";
}

export function hotelRowToProperty(h: HotelRow): Property {
  const status = deriveStatus(h);
  // Critical actions = pending approvals that pushed status to critical
  const criticalActions = status === "critical" ? h.pendingApprovals : 0;
  return {
    id: h.id,
    name: h.name,
    city: h.city,
    state: h.state,
    rooms: h.totalRooms ?? 0,
    status,
    openActions: h.pendingApprovals,
    criticalActions,
    strategyMode: "maximize_revenue",
    kpis: {
      occupancy: h.occupancy ?? 0,
      adr: h.adr ?? 0,
      revpar: h.revpar ?? 0,
      revenueMtd: h.revenueMtd ?? 0,
      paceVsStly: h.paceVsStly ?? 0,
      forecastAccuracy: 0,
    },
    revparTrend: [],
  };
}

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
  const [scope, setScopeState] = React.useState<Scope>("group");
  const [activePropertyId, setActivePropertyIdState] = React.useState<string>(DEFAULT_HOTEL_ID);
  const [hydrated, setHydrated] = React.useState(false);

  // Fetch hotels from DB with KPIs — role filtering happens server-side
  const { data: hotelsResponse, isLoading } = useSWR<{
    ok: boolean;
    data: HotelRow[];
    meta?: { role: string; total: number };
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

  const role = hotelsResponse?.meta?.role ?? "admin";

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
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ scope, activePropertyId }));
    } catch {
      // ignore
    }
  }, [scope, activePropertyId, hydrated]);

  // When the hotel list changes (initial load, role/simulation switch) validate
  // the active hotel and scope.
  //
  // Rules:
  //  1. If activePropertyId is empty or not in the new list → pick the first
  //     real DB hotel (skip index 0 which is always the Meriton Kent fixture).
  //  2. If the hotel list changed to a *different* set (role switch) → always
  //     return to group scope so the user sees the correct portfolio overview
  //     instead of being stuck on a property page from the previous role.
  //
  // IMPORTANT: activePropertyId is intentionally NOT in the dependency array.
  // Including it would cause the effect to fire on every user navigation.
  const prevHotelIdsRef = React.useRef<string>("");
  React.useEffect(() => {
    if (!dbHotels.length) return;

    const currentIds = dbHotels.map((h) => h.id).join(",");
    const listChanged = prevHotelIdsRef.current !== "" && prevHotelIdsRef.current !== currentIds;
    prevHotelIdsRef.current = currentIds;

    const found = dbHotels.some((h) => h.id === activePropertyId);

    if (!found) {
      // Active hotel not accessible under this role — pick first real hotel.
      const fallback = dbHotels.find((_, i) => i > 0) ?? dbHotels[0];
      setActivePropertyIdState(fallback.id);
    }

    if (listChanged) {
      // Hotel list swapped (admin ↔ customer switch) — always go to group view
      // so the user sees the portfolio for the new role, not a stale property.
      setScopeState("group");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbHotels]); // Only re-run when the hotel LIST changes, never on user navigation

  const activeHotel = React.useMemo(
    () => dbHotels.find((h) => h.id === activePropertyId) ?? null,
    [dbHotels, activePropertyId]
  );

  const groups = React.useMemo(() => {
    if (!dbHotels.length) return [];
    return [{ id: "all", name: HOTEL_GROUP.name, propertyIds: dbHotels.map((h) => h.id) }];
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
        scope, activePropertyId, hydrated, isLoading,
        hotels: dbHotels, activeHotel, groups, role,
        setScope, setActiveProperty, switchToGroup,
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
