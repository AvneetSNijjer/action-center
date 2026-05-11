export type Severity = "critical" | "warning" | "opportunity" | "info";

export type InsightType =
  | "competitor_change"
  | "event_alert"
  | "demand_pacing"
  | "cancellation_alert"
  | "revenue_pacing"
  | "pending_approvals"
  | "stale_pricing";

export type ActionType = "approve" | "review" | "adjust" | "dismiss" | "snooze" | "view";

export interface InsightAction {
  id: ActionType;
  label: string;
  primary?: boolean;
}

export interface Metric {
  label: string;
  value: string;
  trend?: "up" | "down" | "neutral";
  delta?: string;
}

export interface Insight {
  id: string;
  type: InsightType;
  severity: Severity;
  title: string;
  summary: string;
  body: string;
  hotel: string;
  roomType?: string;
  affectedDates?: string[];
  createdAt: string;
  metrics: Metric[];
  actions: InsightAction[];
  // Optional chart payload
  chart?: {
    kind: "bar" | "line";
    data: { name: string; a?: number; b?: number; value?: number }[];
    aLabel?: string;
    bLabel?: string;
  };
  // Estimated revenue impact if action taken
  revenueImpact?: number;
  // For grouping
  status?: "new" | "snoozed" | "actioned" | "dismissed";
  source?: string;
  // "Why this price" — surfaced from pricing_calculation_logs + business_explanation
  explainability?: Explainability;
}

export interface ExplainDriver {
  label: string;
  contribution: number; // $ contribution to the recommendation (positive = price up)
  direction: "up" | "down" | "neutral";
}

export interface ExplainCalculation {
  basePrice: number;
  suggestedPrice: number;
  floorPrice: number;
  ceilingPrice: number;
  dowWeight: number;
  dynamicElasticity: number;
  occPush: number;
  pickPush: number;
  adjustmentFactor: number;
  daysUntilStay: number;
  currentOccupancy: number;
  expectedOccupancy: number;
}

export interface ExplainCompRow {
  name: string;
  price: number;
  gap: number; // $ relative to "you"; 0 = your row
}

export interface Explainability {
  narrative: string;
  drivers: ExplainDriver[];
  calculation?: ExplainCalculation;
  compSet?: ExplainCompRow[];
}
