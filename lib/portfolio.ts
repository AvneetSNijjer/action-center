/**
 * Portfolio (multi-property) — types + static mock data.
 *
 * Models a hotel group with 6 properties and their rollup KPIs.
 * In production this would be served by an API that aggregates from
 * financial_metrics_service, daily_inventory, suggested_prices, and
 * auto_publishing_rate_reviews across the user's accessible hotels.
 */

import type { StrategyModeId } from "./strategy";

export type PropertyStatus = "on_track" | "needs_review" | "critical";

export interface PropertyKpis {
  occupancy: number; // %
  adr: number;
  revpar: number;
  revenueMtd: number;
  paceVsStly: number; // % delta
  forecastAccuracy: number; // % (100 = perfect)
}

export interface Property {
  id: string;
  name: string;
  city: string;
  state: string;
  rooms: number;
  status: PropertyStatus;
  openActions: number;
  criticalActions: number;
  strategyMode: StrategyModeId;
  kpis: PropertyKpis;
  revparTrend: number[]; // 14-day sparkline values
}

export interface HotelGroup {
  id: string;
  name: string;
  properties: Property[];
}

/* ---------- The mock group ---------- */

export const HOTEL_GROUP: HotelGroup = {
  id: "horizon",
  name: "Horizon Hotel Group",
  properties: [
    {
      id: "h-grand-marina",
      name: "The Grand Marina",
      city: "San Francisco",
      state: "CA",
      rooms: 320,
      status: "on_track",
      openActions: 1,
      criticalActions: 0,
      strategyMode: "maximize_revenue",
      kpis: {
        occupancy: 82,
        adr: 245,
        revpar: 201,
        revenueMtd: 712_400,
        paceVsStly: 6.8,
        forecastAccuracy: 96.4,
      },
      revparTrend: [184, 188, 192, 187, 195, 198, 196, 201, 203, 199, 205, 207, 201, 201],
    },
    {
      id: "h-downtown",
      name: "Horizon Downtown",
      city: "Austin",
      state: "TX",
      rooms: 180,
      status: "needs_review",
      openActions: 4,
      criticalActions: 0,
      strategyMode: "maximize_occupancy",
      kpis: {
        occupancy: 68,
        adr: 172,
        revpar: 117,
        revenueMtd: 232_980,
        paceVsStly: -2.1,
        forecastAccuracy: 91.8,
      },
      revparTrend: [128, 124, 121, 119, 122, 118, 115, 117, 116, 119, 118, 116, 117, 117],
    },
    {
      id: "h-pacific-heights",
      name: "Pacific Heights Resort",
      city: "Maui",
      state: "HI",
      rooms: 240,
      status: "critical",
      openActions: 5,
      criticalActions: 2,
      strategyMode: "hit_target",
      kpis: {
        occupancy: 54,
        adr: 198,
        revpar: 107,
        revenueMtd: 318_400,
        paceVsStly: -11.4,
        forecastAccuracy: 84.2,
      },
      revparTrend: [142, 138, 135, 128, 124, 119, 115, 112, 108, 109, 107, 105, 107, 107],
    },
    {
      id: "h-lakeshore",
      name: "Lakeshore Inn",
      city: "Chicago",
      state: "IL",
      rooms: 140,
      status: "on_track",
      openActions: 2,
      criticalActions: 0,
      strategyMode: "maximize_revenue",
      kpis: {
        occupancy: 79,
        adr: 155,
        revpar: 122,
        revenueMtd: 188_640,
        paceVsStly: 4.2,
        forecastAccuracy: 94.6,
      },
      revparTrend: [112, 115, 118, 120, 119, 122, 124, 121, 120, 123, 122, 124, 122, 122],
    },
    {
      id: "h-skyline",
      name: "Skyline Suites",
      city: "Denver",
      state: "CO",
      rooms: 95,
      status: "needs_review",
      openActions: 3,
      criticalActions: 0,
      strategyMode: "protect_adr",
      kpis: {
        occupancy: 71,
        adr: 139,
        revpar: 99,
        revenueMtd: 92_100,
        paceVsStly: -1.4,
        forecastAccuracy: 89.5,
      },
      revparTrend: [104, 102, 100, 98, 97, 99, 100, 98, 99, 101, 100, 99, 99, 99],
    },
    {
      id: "h-bayview",
      name: "Bayview Boutique",
      city: "Portland",
      state: "OR",
      rooms: 65,
      status: "on_track",
      openActions: 0,
      criticalActions: 0,
      strategyMode: "direct_push",
      kpis: {
        occupancy: 86,
        adr: 128,
        revpar: 110,
        revenueMtd: 71_500,
        paceVsStly: 5.3,
        forecastAccuracy: 95.1,
      },
      revparTrend: [98, 102, 105, 108, 107, 109, 111, 110, 112, 109, 111, 110, 110, 110],
    },
  ],
};

/* ---------- Portfolio rollups (weighted by rooms) ---------- */

export interface PortfolioRollup {
  totalRooms: number;
  occupancy: number;
  adr: number;
  revpar: number;
  revenueMtd: number;
  occupancyDeltaLy: number; // vs Last Year
  adrDeltaLy: number; // $ delta
  revparDeltaLy: number; // % delta
  revenueToBudget: number; // % to budget
  openActions: number;
  criticalActions: number;
  propertyCounts: Record<PropertyStatus, number>;
}

function computeRollup(): PortfolioRollup {
  const props = HOTEL_GROUP.properties;
  const totalRooms = props.reduce((a, p) => a + p.rooms, 0);
  const totalRevenue = props.reduce((a, p) => a + p.kpis.revenueMtd, 0);
  const occupancy =
    props.reduce((a, p) => a + (p.kpis.occupancy / 100) * p.rooms, 0) / totalRooms;
  const adr = props.reduce((a, p) => a + p.kpis.adr * p.rooms, 0) / totalRooms;
  // RevPAR = revenue / available roomnights — we'll synthesize a clean number
  const revpar = props.reduce((a, p) => a + p.kpis.revpar * p.rooms, 0) / totalRooms;

  const openActions = props.reduce((a, p) => a + p.openActions, 0);
  const criticalActions = props.reduce((a, p) => a + p.criticalActions, 0);

  const propertyCounts: Record<PropertyStatus, number> = {
    on_track: props.filter((p) => p.status === "on_track").length,
    needs_review: props.filter((p) => p.status === "needs_review").length,
    critical: props.filter((p) => p.status === "critical").length,
  };

  return {
    totalRooms,
    occupancy: Number((occupancy * 100).toFixed(1)),
    adr: Math.round(adr),
    revpar: Number(revpar.toFixed(1)),
    revenueMtd: totalRevenue,
    occupancyDeltaLy: 3.1,
    adrDeltaLy: 12,
    revparDeltaLy: 8.4,
    revenueToBudget: 11,
    openActions,
    criticalActions,
    propertyCounts,
  };
}

export const PORTFOLIO_ROLLUP: PortfolioRollup = computeRollup();

/* ---------- Helpers ---------- */

export const STATUS_META: Record<
  PropertyStatus,
  { label: string; stripe: string; badge: "critical" | "warning" | "opportunity"; dot: string }
> = {
  critical: {
    label: "Critical",
    stripe: "bg-red-500",
    badge: "critical",
    dot: "bg-red-500",
  },
  needs_review: {
    label: "Needs review",
    stripe: "bg-amber-500",
    badge: "warning",
    dot: "bg-amber-500",
  },
  on_track: {
    label: "On track",
    stripe: "bg-emerald-500",
    badge: "opportunity",
    dot: "bg-emerald-500",
  },
};

export function getProperty(id: string | null): Property | undefined {
  if (!id) return undefined;
  return HOTEL_GROUP.properties.find((p) => p.id === id);
}

export function getCriticalProperties(): Property[] {
  return HOTEL_GROUP.properties.filter((p) => p.status === "critical");
}
