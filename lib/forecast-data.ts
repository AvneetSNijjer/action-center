/**
 * Forecast & Demand page — static mock data.
 *
 * All values are static (no Date.now() at module load) to avoid SSR/hydration
 * drift. In production these would be served by an API that joins:
 *   - expected_booking_curves
 *   - daily_inventory
 *   - suggested_prices
 *   - reservations
 *   - historical_occupancy_raw
 *   - competitor_rates + hotel_comp_set
 *   - events + daily_hotel_demand
 *   - auto_publishing_rate_reviews + agora_pushes + cron_job_logs
 */

/* ============================================================
 * 1) Demand Heatmap — 91 cells (13 weeks × 7 days)
 * ============================================================ */

export interface HeatmapCell {
  date: string; // ISO yyyy-mm-dd
  dow: number; // 0 = Sun, 6 = Sat
  paceIndex: number; // -0.4 → 0.5  (pickup variance vs expected curve)
  occupancy: number; // 0 → 1
  suggestedPrice: number;
}

function generateHeatmap(): HeatmapCell[] {
  const cells: HeatmapCell[] = [];
  // Start from May 12, 2026 (Tuesday)
  const startMs = Date.UTC(2026, 4, 12);
  for (let i = 0; i < 91; i++) {
    const d = new Date(startMs + i * 86400000);
    const dow = d.getUTCDay();
    const isWeekend = dow === 5 || dow === 6;

    // Synthetic but deterministic shape — no Date.now() involvement
    const seasonal = Math.sin((i / 91) * Math.PI) * 0.22 + 0.7;
    const noise = (Math.sin(i * 1.37) + Math.cos(i * 0.91)) * 0.15;
    const occ = Math.min(0.97, Math.max(0.32, seasonal + noise + (isWeekend ? 0.13 : 0)));
    const pace = Math.max(-0.35, Math.min(0.45, Math.sin(i * 0.6) * 0.22 + (isWeekend ? 0.06 : -0.04)));
    const basePrice = isWeekend ? 340 : 265;
    cells.push({
      date: d.toISOString().slice(0, 10),
      dow,
      paceIndex: Number(pace.toFixed(3)),
      occupancy: Number(occ.toFixed(3)),
      suggestedPrice: Math.round(basePrice * (1 + occ * 0.25)),
    });
  }
  return cells;
}

export const HEATMAP: HeatmapCell[] = generateHeatmap();

/* ============================================================
 * 2) Pickup Curve — Sat May 23, 2026 (next high-priority stay date)
 * ============================================================ */

export interface PickupPoint {
  dtg: number; // days to arrival (negative = future)
  label: string; // pretty x-axis label
  otb: number | null; // on-the-books cumulative pickup
  stly: number; // same time last year
  forecast: number; // expected curve from booking curves
}

export const PICKUP_CURVE: PickupPoint[] = [
  { dtg: -45, label: "-45d", otb: 22, stly: 24, forecast: 28 },
  { dtg: -40, label: "-40d", otb: 38, stly: 41, forecast: 46 },
  { dtg: -35, label: "-35d", otb: 55, stly: 58, forecast: 64 },
  { dtg: -30, label: "-30d", otb: 72, stly: 76, forecast: 82 },
  { dtg: -25, label: "-25d", otb: 89, stly: 94, forecast: 100 },
  { dtg: -20, label: "-20d", otb: 109, stly: 113, forecast: 118 },
  { dtg: -15, label: "-15d", otb: 132, stly: 130, forecast: 138 },
  { dtg: -12, label: "-12d", otb: 145, stly: 138, forecast: 152 },
  { dtg: -11, label: "Today", otb: 158, stly: 142, forecast: 161 },
  { dtg: -9, label: "-9d", otb: null, stly: 146, forecast: 167 },
  { dtg: -7, label: "-7d", otb: null, stly: 153, forecast: 178 },
  { dtg: -5, label: "-5d", otb: null, stly: 161, forecast: 188 },
  { dtg: -3, label: "-3d", otb: null, stly: 170, forecast: 197 },
  { dtg: -1, label: "-1d", otb: null, stly: 178, forecast: 205 },
  { dtg: 0, label: "Stay", otb: null, stly: 184, forecast: 209 },
];

export const PICKUP_CURVE_META = {
  stayDate: "Sat May 23, 2026",
  daysUntilStay: 11,
  hotel: "The Beacon Hotel — Downtown",
  totalRooms: 218,
};

/* ============================================================
 * 3) Comp-set rate ladder — next 7 nights
 * ============================================================ */

export interface CompLadderRow {
  date: string;
  dow: string;
  you: number;
  marriott: number;
  hilton: number;
  hyatt: number;
  westin: number;
  omni: number;
  median: number;
}

export const COMP_SET_LADDER: CompLadderRow[] = [
  { date: "May 13", dow: "Wed", you: 272, marriott: 285, hilton: 278, hyatt: 255, westin: 290, omni: 265, median: 275 },
  { date: "May 14", dow: "Thu", you: 289, marriott: 295, hilton: 285, hyatt: 268, westin: 305, omni: 275, median: 287 },
  { date: "May 15", dow: "Fri", you: 318, marriott: 325, hilton: 315, hyatt: 298, westin: 335, omni: 305, median: 316 },
  { date: "May 16", dow: "Sat", you: 342, marriott: 287, hilton: 295, hyatt: 312, westin: 305, omni: 295, median: 295 },
  { date: "May 17", dow: "Sun", you: 295, marriott: 285, hilton: 290, hyatt: 278, westin: 298, omni: 280, median: 287 },
  { date: "May 18", dow: "Mon", you: 268, marriott: 270, hilton: 265, hyatt: 252, westin: 278, omni: 260, median: 267 },
  { date: "May 19", dow: "Tue", you: 265, marriott: 272, hilton: 268, hyatt: 250, westin: 275, omni: 258, median: 266 },
];

/* ============================================================
 * 4) Upcoming Events (next 30 days)
 * Source: events + daily_hotel_demand + PredictHQ enrichment
 * ============================================================ */

export interface UpcomingEvent {
  id: string;
  title: string;
  category: string;
  startDate: string;
  endDate: string;
  attendance: number;
  distanceKm: number;
  localRank: number; // 0-100
  predictedSpend: number; // accommodation spend region-wide
  impact: "high" | "medium" | "low";
  venue: string;
  unsoldRoomsPct: number;
}

export const UPCOMING_EVENTS: UpcomingEvent[] = [
  {
    id: "e1",
    title: "Coldplay — Music of the Spheres Tour",
    category: "Concert",
    startDate: "May 30",
    endDate: "May 30",
    attendance: 19500,
    distanceKm: 1.4,
    localRank: 88,
    predictedSpend: 1_200_000,
    impact: "high",
    venue: "TD Garden",
    unsoldRoomsPct: 41,
  },
  {
    id: "e2",
    title: "Boston Calling Music Festival",
    category: "Festival",
    startDate: "May 24",
    endDate: "May 26",
    attendance: 42000,
    distanceKm: 4.2,
    localRank: 84,
    predictedSpend: 2_800_000,
    impact: "high",
    venue: "Harvard Athletic Complex",
    unsoldRoomsPct: 28,
  },
  {
    id: "e3",
    title: "NEUR Conference 2026",
    category: "Conference",
    startDate: "Jun 02",
    endDate: "Jun 04",
    attendance: 6800,
    distanceKm: 0.8,
    localRank: 71,
    predictedSpend: 980_000,
    impact: "medium",
    venue: "Hynes Convention Center",
    unsoldRoomsPct: 52,
  },
  {
    id: "e4",
    title: "Red Sox vs Yankees",
    category: "Sports",
    startDate: "Jun 06",
    endDate: "Jun 08",
    attendance: 37000,
    distanceKm: 2.1,
    localRank: 76,
    predictedSpend: 720_000,
    impact: "medium",
    venue: "Fenway Park",
    unsoldRoomsPct: 38,
  },
  {
    id: "e5",
    title: "Boston Pride Parade",
    category: "Community",
    startDate: "Jun 13",
    endDate: "Jun 13",
    attendance: 15000,
    distanceKm: 1.2,
    localRank: 62,
    predictedSpend: 240_000,
    impact: "low",
    venue: "Downtown Boston",
    unsoldRoomsPct: 47,
  },
];

/* ============================================================
 * 5) Pending Approvals (home page widget) — auto_publishing_rate_reviews
 * ============================================================ */

export interface PendingApproval {
  id: string;
  roomType: string;
  stayDate: string;
  dayOfWeek: string;
  currentPrice: number;
  suggestedPrice: number;
  change: number;
  changePct: number;
  violation: "percentage_increase" | "percentage_decrease" | "absolute_increase" | "absolute_decrease";
  severity: "high" | "medium";
  age: string;
  reason: string;
}

export const PENDING_APPROVALS: PendingApproval[] = [
  {
    id: "ap1",
    roomType: "King Deluxe",
    stayDate: "May 30",
    dayOfWeek: "Fri",
    currentPrice: 289,
    suggestedPrice: 410,
    change: 121,
    changePct: 41.9,
    violation: "percentage_increase",
    severity: "high",
    age: "2h",
    reason: "Coldplay event impact",
  },
  {
    id: "ap2",
    roomType: "Queen Standard",
    stayDate: "May 17",
    dayOfWeek: "Sat",
    currentPrice: 342,
    suggestedPrice: 305,
    change: -37,
    changePct: -10.8,
    violation: "percentage_decrease",
    severity: "medium",
    age: "8h",
    reason: "Marriott comp drop",
  },
  {
    id: "ap3",
    roomType: "Junior Suite",
    stayDate: "May 24",
    dayOfWeek: "Sat",
    currentPrice: 425,
    suggestedPrice: 478,
    change: 53,
    changePct: 12.5,
    violation: "percentage_increase",
    severity: "medium",
    age: "18h",
    reason: "Memorial Day pickup +23%",
  },
];

/* ============================================================
 * 6) Publishing Health — agora_pushes + cron_job_logs + Prometheus
 * ============================================================ */

export const PUBLISHING_HEALTH = {
  pushesToday: 187,
  successRate: 99.5,
  failedToday: 1,
  lastSync: "2 min ago",
  agoraStatus: "healthy" as const,
  pmsStatus: "healthy" as const,
  competitorScrapeStatus: "healthy" as const,
};
