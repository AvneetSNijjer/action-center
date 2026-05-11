/**
 * Pricing Strategy — types, modes library, defaults.
 *
 * Goal modes shape how the pricing engine interprets its core parameters
 * (elasticity, DOW weights, floor/ceiling, pickup scaling). When wired to the
 * real backend, the selected mode would be persisted in a `pricing_strategy_config`
 * table and read by `pricing_algorithm_v1.py` on each calculation.
 */

import {
  TrendingUp,
  Users,
  ShieldCheck,
  Target,
  Globe2,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";

export type StrategyModeId =
  | "maximize_revenue"
  | "maximize_occupancy"
  | "protect_adr"
  | "hit_target"
  | "direct_push"
  | "custom";

export interface StrategyModeDefinition {
  id: StrategyModeId;
  label: string;
  short: string;
  description: string;
  icon: LucideIcon;
  /** Tailwind accent class for badges + cards */
  accent: {
    bg: string;
    text: string;
    border: string;
    dot: string;
  };
  /** What the pricing engine does in this mode */
  engineEffect: { label: string; detail: string }[];
  /** Expected outcome ranges */
  expectedOutcome: { metric: string; range: string; direction: "up" | "down" | "neutral" }[];
  /** When this mode is appropriate */
  whenToUse: string;
}

export const STRATEGY_MODES: StrategyModeDefinition[] = [
  {
    id: "maximize_revenue",
    label: "Maximize Revenue",
    short: "Balanced — let the algorithm decide",
    description:
      "Balance ADR and occupancy via dynamic elasticity. The default mode — best when no specific goal dominates.",
    icon: TrendingUp,
    accent: {
      bg: "bg-brand-50 dark:bg-brand-900/30",
      text: "text-brand-700 dark:text-brand-300",
      border: "border-brand-200 dark:border-brand-800/60",
      dot: "bg-brand-500",
    },
    engineEffect: [
      { label: "Elasticity", detail: "Default range (-0.5 → -0.2) by lead time" },
      { label: "DOW weights", detail: "Default Mon-Sun multipliers" },
      { label: "Floor / Ceiling", detail: "Respected as configured" },
      { label: "Pickup scaling", detail: "Standard occupancy-weighted scaling" },
    ],
    expectedOutcome: [
      { metric: "Total revenue", range: "Highest", direction: "up" },
      { metric: "Occupancy", range: "Market-aligned", direction: "neutral" },
      { metric: "ADR", range: "Market-aligned", direction: "neutral" },
    ],
    whenToUse: "Most hotels, most of the year. Default state for new properties.",
  },
  {
    id: "maximize_occupancy",
    label: "Maximize Occupancy",
    short: "Heads in beds — sacrifice some ADR",
    description:
      "Discount more aggressively to fill rooms. Best when ancillary revenue (F&B, parking, events) outweighs room ADR.",
    icon: Users,
    accent: {
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      text: "text-emerald-700 dark:text-emerald-300",
      border: "border-emerald-200 dark:border-emerald-900/50",
      dot: "bg-emerald-500",
    },
    engineEffect: [
      { label: "Elasticity", detail: "More elastic (-0.6 → -0.4) — bigger price moves" },
      { label: "Ceiling", detail: "Lowered ~10% to avoid choking demand" },
      { label: "DOW weights", detail: "Reduced peaks (Sat 1.4× → 1.25×)" },
      { label: "Negative adjustments", detail: "Up to 25% larger" },
    ],
    expectedOutcome: [
      { metric: "Occupancy", range: "+5 to +9%", direction: "up" },
      { metric: "ADR", range: "-3 to -6%", direction: "down" },
      { metric: "Total revenue", range: "+1 to +3%", direction: "up" },
    ],
    whenToUse:
      "Soft seasons, post-disruption recovery, hotels where F&B / casino / parking revenue exceeds room revenue.",
  },
  {
    id: "protect_adr",
    label: "Protect ADR",
    short: "Hold rate — accept lower occupancy",
    description:
      "Hold rates firm to protect rate integrity and brand positioning. Best for luxury / post-renovation / brand-protective hotels.",
    icon: ShieldCheck,
    accent: {
      bg: "bg-amber-50 dark:bg-amber-950/40",
      text: "text-amber-700 dark:text-amber-300",
      border: "border-amber-200 dark:border-amber-900/50",
      dot: "bg-amber-500",
    },
    engineEffect: [
      { label: "Elasticity", detail: "Less elastic (-0.3 → -0.15) — smaller moves" },
      { label: "Floor", detail: "Raised ~5% above configured" },
      { label: "DOW weights", detail: "Stronger weekend premiums" },
      { label: "Negative adjustments", detail: "Capped at 5% per cycle" },
    ],
    expectedOutcome: [
      { metric: "ADR", range: "+3 to +7%", direction: "up" },
      { metric: "Occupancy", range: "-2 to -5%", direction: "down" },
      { metric: "Total revenue", range: "Flat to +2%", direction: "neutral" },
    ],
    whenToUse:
      "Luxury hotels, post-renovation repositioning, brand-protective ownership, premium seasonal hotels.",
  },
  {
    id: "hit_target",
    label: "Hit Revenue Target",
    short: "Adaptive — close gap to monthly target",
    description:
      "Engine inspects MTD vs target every cycle. Behind → more aggressive. On track → balanced. Ahead → ADR-protective.",
    icon: Target,
    accent: {
      bg: "bg-violet-50 dark:bg-violet-950/40",
      text: "text-violet-700 dark:text-violet-300",
      border: "border-violet-200 dark:border-violet-900/50",
      dot: "bg-violet-500",
    },
    engineEffect: [
      { label: "MTD checkpoint", detail: "Re-evaluates strategy each pricing cycle" },
      { label: "When behind > 5%", detail: "Shifts to Maximize Occupancy bias" },
      { label: "When on track ±5%", detail: "Reverts to Maximize Revenue bias" },
      { label: "When ahead > 5%", detail: "Shifts to Protect ADR bias" },
    ],
    expectedOutcome: [
      { metric: "Revenue target", range: "Tracks within ±5%", direction: "up" },
      { metric: "Volatility", range: "Higher mid-month", direction: "neutral" },
      { metric: "Forecast accuracy", range: "+10 to +15%", direction: "up" },
    ],
    whenToUse:
      "Hotels with strict ownership revenue KPIs, asset-managed properties, REIT-owned hotels reporting to monthly board.",
  },
  {
    id: "direct_push",
    label: "Direct Booking Push",
    short: "Reduce OTA dependency",
    description:
      "Discount the direct channel slightly + apply a small premium on OTAs (within parity rules) to combat commission erosion.",
    icon: Globe2,
    accent: {
      bg: "bg-indigo-50 dark:bg-indigo-950/40",
      text: "text-indigo-700 dark:text-indigo-300",
      border: "border-indigo-200 dark:border-indigo-900/50",
      dot: "bg-indigo-500",
    },
    engineEffect: [
      { label: "Direct channel", detail: "-3 to -5% vs BAR" },
      { label: "OTA channels", detail: "+2 to +4% vs BAR (parity-aware)" },
      { label: "Insight triggers", detail: "Fire when OTA share creeps up >3%" },
      { label: "Parity monitoring", detail: "Always-on; alerts on violations" },
    ],
    expectedOutcome: [
      { metric: "Direct ratio", range: "+5 to +12%", direction: "up" },
      { metric: "Commission cost", range: "-1 to -3%", direction: "down" },
      { metric: "NRevPAR", range: "+2 to +5%", direction: "up" },
    ],
    whenToUse:
      "Hotels with >50% OTA dependency, well-developed direct website, loyalty program ready to push.",
  },
  {
    id: "custom",
    label: "Custom",
    short: "Power-user manual tuning",
    description:
      "Define elasticity, DOW weights, event uplift caps, and channel premiums manually. Use only if you know what you're changing.",
    icon: SlidersHorizontal,
    accent: {
      bg: "bg-muted",
      text: "text-foreground",
      border: "border-border",
      dot: "bg-muted-foreground",
    },
    engineEffect: [
      { label: "All parameters", detail: "User-defined per pricing field" },
      { label: "Safety bounds", detail: "Floor/Ceiling still enforced" },
      { label: "Validation", detail: "Engine warns on extreme values" },
    ],
    expectedOutcome: [
      { metric: "Outcome", range: "Variable", direction: "neutral" },
    ],
    whenToUse: "Power users, multi-property RM teams, hotels with unusual demand curves.",
  },
];

export function getMode(id: StrategyModeId): StrategyModeDefinition {
  return STRATEGY_MODES.find((m) => m.id === id) || STRATEGY_MODES[0];
}

/* ----------------------------- Goals ----------------------------- */

export interface StrategyGoals {
  monthlyRevenueTarget: number; // USD
  targetOccupancy: number; // %
  adrFloor: number; // USD
  adrCeiling: number; // USD
  directBookingTarget: number; // %
  blackoutDates: string[]; // ISO dates
}

export interface StrategyConfig {
  modeId: StrategyModeId;
  goals: StrategyGoals;
}

export const DEFAULT_STRATEGY: StrategyConfig = {
  modeId: "maximize_revenue",
  goals: {
    monthlyRevenueTarget: 1_120_000,
    targetOccupancy: 74,
    adrFloor: 195,
    adrCeiling: 525,
    directBookingTarget: 35,
    blackoutDates: [],
  },
};

/* ----------------------------- Live (mock) actuals ----------------------------- */

/**
 * In production these come from financial_metrics_service / revpar_forecast_history.
 * Mocked here so the gauges feel alive.
 */
export const STRATEGY_ACTUALS = {
  // Month-to-date as of "today"
  mtdRevenue: 720_400,
  mtdOccupancy: 66.4,
  currentAdr: 223,
  directBookingShare: 28.6,
  // Forecast for end-of-month at current pace
  forecastEomRevenue: 998_800,
  // Days into the month + days remaining
  daysIntoMonth: 11,
  daysInMonth: 31,
};
