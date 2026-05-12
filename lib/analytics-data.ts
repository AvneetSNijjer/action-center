/**
 * Analytics page — static mock data for the prototype.
 *
 * All values are static (no Date.now()) to avoid SSR/hydration drift.
 * In production, this would be served by an `/analytics` API endpoint that
 * rolls up: financial_metrics_service, revpar_forecast_history,
 * historical_occupancy_raw, reservations, competitor_rates, hotel_comp_set,
 * pricing_calculation_logs.
 */

export type DateRange = "30d" | "90d" | "365d";

export interface IndexKpi {
  value: number;
  delta: number;
  trend: number[]; // 8-point sparkline
}

export interface DailyKpi {
  date: string; // ISO yyyy-mm-dd
  label: string; // human-friendly axis label
  revpar: number;
  adr: number;
  occupancy: number; // %
  stlyRevpar: number;
  stlyAdr: number;
  stlyOccupancy: number;
}

export interface ForecastWeek {
  week: string;
  forecast: number;
  actual: number;
  variancePct: number;
}

export interface ChannelWeek {
  week: string;
  direct: number;
  bookingcom: number;
  expedia: number;
  walkin: number;
  other: number;
}

export interface SegmentWeek {
  week: string;
  leisure: number;
  corporate: number;
  group: number;
  wholesale: number;
}

export interface PickupPaceRow {
  stayDate: string;
  dow: string;
  expectedPickup: number;
  actualPickup: number;
  variancePct: number;
}

export interface DistributionBucket {
  bucket: string;
  count: number;
}

export interface PricingDecision {
  id: string;
  decidedAt: string;
  roomType: string;
  stayDate: string;
  oldPrice: number;
  newPrice: number;
  changePct: number;
  approvedBy: string;
  source: "Auto" | "Manual" | "Override";
  reason: string;
}

/* ---------- Headline KPIs ---------- */

export const ANALYTICS_HEADLINE = {
  hotel: "The Beacon Hotel — Downtown",
  rangeLabel: "Feb 11 – May 11, 2026 (last 90 days)",
  compSetSize: 5,
  current: {
    revpar: 178,
    adr: 245,
    occupancy: 72.6,
    revenue: 3_492_000,
  },
  // Same period last year for headline-level deltas
  stly: {
    revpar: 161,
    adr: 232,
    occupancy: 69.4,
    revenue: 3_158_000,
  },
};

/* ---------- Indices vs comp set ---------- */

export const PERFORMANCE_INDICES: Record<"rgi" | "ari" | "mpi", IndexKpi> = {
  rgi: {
    value: 105.2,
    delta: 3.8,
    trend: [98, 99, 101, 100, 102, 104, 105, 105.2],
  },
  ari: {
    value: 108.1,
    delta: 5.4,
    trend: [101, 102, 103, 105, 106, 107, 108, 108.1],
  },
  mpi: {
    value: 97.4,
    delta: -1.6,
    trend: [99, 99, 98.5, 97.8, 97.5, 97.6, 97.4, 97.4],
  },
};

/* ---------- 90-day KPI series ---------- */
// Compact 13-point series (one per week) so charts read well.
export const KPI_SERIES: DailyKpi[] = [
  { date: "2026-02-11", label: "Feb 11", revpar: 142, adr: 218, occupancy: 65.1, stlyRevpar: 131, stlyAdr: 208, stlyOccupancy: 63.0 },
  { date: "2026-02-18", label: "Feb 18", revpar: 148, adr: 221, occupancy: 67.0, stlyRevpar: 138, stlyAdr: 212, stlyOccupancy: 65.1 },
  { date: "2026-02-25", label: "Feb 25", revpar: 152, adr: 225, occupancy: 67.6, stlyRevpar: 142, stlyAdr: 215, stlyOccupancy: 66.0 },
  { date: "2026-03-04", label: "Mar 4", revpar: 158, adr: 228, occupancy: 69.3, stlyRevpar: 146, stlyAdr: 218, stlyOccupancy: 67.0 },
  { date: "2026-03-11", label: "Mar 11", revpar: 163, adr: 232, occupancy: 70.3, stlyRevpar: 149, stlyAdr: 221, stlyOccupancy: 67.4 },
  { date: "2026-03-18", label: "Mar 18", revpar: 170, adr: 235, occupancy: 72.3, stlyRevpar: 153, stlyAdr: 223, stlyOccupancy: 68.6 },
  { date: "2026-03-25", label: "Mar 25", revpar: 175, adr: 238, occupancy: 73.5, stlyRevpar: 158, stlyAdr: 226, stlyOccupancy: 69.9 },
  { date: "2026-04-01", label: "Apr 1", revpar: 182, adr: 242, occupancy: 75.2, stlyRevpar: 162, stlyAdr: 228, stlyOccupancy: 71.1 },
  { date: "2026-04-08", label: "Apr 8", revpar: 188, adr: 247, occupancy: 76.1, stlyRevpar: 167, stlyAdr: 231, stlyOccupancy: 72.3 },
  { date: "2026-04-15", label: "Apr 15", revpar: 192, adr: 251, occupancy: 76.5, stlyRevpar: 172, stlyAdr: 234, stlyOccupancy: 73.5 },
  { date: "2026-04-22", label: "Apr 22", revpar: 195, adr: 253, occupancy: 77.1, stlyRevpar: 175, stlyAdr: 236, stlyOccupancy: 74.2 },
  { date: "2026-04-29", label: "Apr 29", revpar: 188, adr: 250, occupancy: 75.2, stlyRevpar: 174, stlyAdr: 235, stlyOccupancy: 74.0 },
  { date: "2026-05-06", label: "May 6", revpar: 182, adr: 248, occupancy: 73.4, stlyRevpar: 168, stlyAdr: 232, stlyOccupancy: 72.4 },
];

/* ---------- Forecast accuracy (last 12 weeks) ---------- */

export const FORECAST_ACCURACY: ForecastWeek[] = [
  { week: "Wk 8",  forecast: 145, actual: 142, variancePct: -2.1 },
  { week: "Wk 9",  forecast: 150, actual: 148, variancePct: -1.3 },
  { week: "Wk 10", forecast: 154, actual: 152, variancePct: -1.3 },
  { week: "Wk 11", forecast: 156, actual: 158, variancePct: 1.3 },
  { week: "Wk 12", forecast: 159, actual: 163, variancePct: 2.5 },
  { week: "Wk 13", forecast: 165, actual: 170, variancePct: 3.0 },
  { week: "Wk 14", forecast: 172, actual: 175, variancePct: 1.7 },
  { week: "Wk 15", forecast: 179, actual: 182, variancePct: 1.7 },
  { week: "Wk 16", forecast: 184, actual: 188, variancePct: 2.2 },
  { week: "Wk 17", forecast: 195, actual: 192, variancePct: -1.5 },
  { week: "Wk 18", forecast: 202, actual: 195, variancePct: -3.5 },
  { week: "Wk 19", forecast: 196, actual: 188, variancePct: -4.1 },
];

export const FORECAST_SUMMARY = {
  meanAbsError: 2.2,
  withinThreshold: 91.7, // % weeks within ±5%
  bias: 0.1, // average signed variance (close to 0 = unbiased)
};

/* ---------- Channel mix (last 12 weeks, % revenue share) ---------- */

export const CHANNEL_MIX: ChannelWeek[] = [
  { week: "Wk 8",  direct: 26, bookingcom: 38, expedia: 24, walkin: 6, other: 6 },
  { week: "Wk 9",  direct: 27, bookingcom: 38, expedia: 23, walkin: 6, other: 6 },
  { week: "Wk 10", direct: 28, bookingcom: 37, expedia: 23, walkin: 6, other: 6 },
  { week: "Wk 11", direct: 29, bookingcom: 36, expedia: 23, walkin: 7, other: 5 },
  { week: "Wk 12", direct: 29, bookingcom: 36, expedia: 23, walkin: 7, other: 5 },
  { week: "Wk 13", direct: 30, bookingcom: 35, expedia: 22, walkin: 8, other: 5 },
  { week: "Wk 14", direct: 31, bookingcom: 35, expedia: 22, walkin: 7, other: 5 },
  { week: "Wk 15", direct: 31, bookingcom: 34, expedia: 22, walkin: 8, other: 5 },
  { week: "Wk 16", direct: 32, bookingcom: 34, expedia: 21, walkin: 8, other: 5 },
  { week: "Wk 17", direct: 33, bookingcom: 33, expedia: 21, walkin: 8, other: 5 },
  { week: "Wk 18", direct: 33, bookingcom: 33, expedia: 21, walkin: 8, other: 5 },
  { week: "Wk 19", direct: 34, bookingcom: 32, expedia: 21, walkin: 8, other: 5 },
];

/* ---------- Segment mix (last 12 weeks, % revenue share) ---------- */

export const SEGMENT_MIX: SegmentWeek[] = [
  { week: "Wk 8",  leisure: 48, corporate: 32, group: 14, wholesale: 6 },
  { week: "Wk 9",  leisure: 47, corporate: 33, group: 14, wholesale: 6 },
  { week: "Wk 10", leisure: 49, corporate: 31, group: 14, wholesale: 6 },
  { week: "Wk 11", leisure: 50, corporate: 31, group: 13, wholesale: 6 },
  { week: "Wk 12", leisure: 52, corporate: 29, group: 13, wholesale: 6 },
  { week: "Wk 13", leisure: 53, corporate: 29, group: 12, wholesale: 6 },
  { week: "Wk 14", leisure: 54, corporate: 28, group: 12, wholesale: 6 },
  { week: "Wk 15", leisure: 55, corporate: 27, group: 12, wholesale: 6 },
  { week: "Wk 16", leisure: 56, corporate: 26, group: 12, wholesale: 6 },
  { week: "Wk 17", leisure: 57, corporate: 25, group: 12, wholesale: 6 },
  { week: "Wk 18", leisure: 56, corporate: 26, group: 12, wholesale: 6 },
  { week: "Wk 19", leisure: 55, corporate: 27, group: 12, wholesale: 6 },
];

/* ---------- Pickup pace retrospective (12 recent stay dates) ---------- */

export const PICKUP_RETROSPECTIVE: PickupPaceRow[] = [
  { stayDate: "Apr 19", dow: "Sun", expectedPickup: 142, actualPickup: 138, variancePct: -2.8 },
  { stayDate: "Apr 24", dow: "Fri", expectedPickup: 168, actualPickup: 184, variancePct: 9.5 },
  { stayDate: "Apr 25", dow: "Sat", expectedPickup: 178, actualPickup: 198, variancePct: 11.2 },
  { stayDate: "Apr 26", dow: "Sun", expectedPickup: 145, actualPickup: 152, variancePct: 4.8 },
  { stayDate: "May 1",  dow: "Fri", expectedPickup: 172, actualPickup: 190, variancePct: 10.5 },
  { stayDate: "May 2",  dow: "Sat", expectedPickup: 182, actualPickup: 205, variancePct: 12.6 },
  { stayDate: "May 3",  dow: "Sun", expectedPickup: 148, actualPickup: 144, variancePct: -2.7 },
  { stayDate: "May 8",  dow: "Fri", expectedPickup: 175, actualPickup: 168, variancePct: -4.0 },
  { stayDate: "May 9",  dow: "Sat", expectedPickup: 185, actualPickup: 178, variancePct: -3.8 },
  { stayDate: "May 10", dow: "Sun", expectedPickup: 150, actualPickup: 142, variancePct: -5.3 },
  { stayDate: "May 11", dow: "Mon", expectedPickup: 138, actualPickup: 145, variancePct: 5.1 },
  { stayDate: "May 12", dow: "Tue", expectedPickup: 132, actualPickup: 128, variancePct: -3.0 },
];

/* ---------- Distributions ---------- */

export const LEAD_TIME_DIST: DistributionBucket[] = [
  { bucket: "0-3 days", count: 412 },
  { bucket: "4-7 days", count: 384 },
  { bucket: "8-14 days", count: 506 },
  { bucket: "15-30 days", count: 612 },
  { bucket: "31-60 days", count: 478 },
  { bucket: "61-90 days", count: 295 },
  { bucket: "91+ days", count: 187 },
];

export const LOS_DIST: DistributionBucket[] = [
  { bucket: "1 night", count: 1184 },
  { bucket: "2 nights", count: 962 },
  { bucket: "3 nights", count: 478 },
  { bucket: "4 nights", count: 162 },
  { bucket: "5 nights", count: 71 },
  { bucket: "6+ nights", count: 47 },
];

export const DISTRIBUTION_SUMMARY = {
  avgLeadTime: 22.4,
  medianLeadTime: 14,
  avgLos: 1.94,
  medianLos: 2,
};

/* ---------- Pricing decision audit trail ---------- */

export const PRICING_DECISIONS: PricingDecision[] = [
  { id: "p1",  decidedAt: "May 11, 09:42 AM", roomType: "King Deluxe", stayDate: "May 17 (Sat)", oldPrice: 342, newPrice: 305, changePct: -10.8, approvedBy: "Auto-publish", source: "Auto", reason: "Marriott comp drop" },
  { id: "p2",  decidedAt: "May 11, 09:42 AM", roomType: "Queen Standard", stayDate: "May 17 (Sat)", oldPrice: 289, newPrice: 268, changePct: -7.3, approvedBy: "Auto-publish", source: "Auto", reason: "Marriott comp drop" },
  { id: "p3",  decidedAt: "May 10, 02:18 PM", roomType: "King Deluxe", stayDate: "May 30 (Fri)", oldPrice: 289, newPrice: 410, changePct: 41.9, approvedBy: "A. Singh", source: "Manual", reason: "Coldplay event" },
  { id: "p4",  decidedAt: "May 10, 02:18 PM", roomType: "Junior Suite", stayDate: "May 30 (Fri)", oldPrice: 425, newPrice: 595, changePct: 40.0, approvedBy: "A. Singh", source: "Manual", reason: "Coldplay event" },
  { id: "p5",  decidedAt: "May 09, 11:05 AM", roomType: "King Deluxe", stayDate: "May 24 (Sat)", oldPrice: 425, newPrice: 478, changePct: 12.5, approvedBy: "Auto-publish", source: "Auto", reason: "Memorial Day pickup +23%" },
  { id: "p6",  decidedAt: "May 09, 11:05 AM", roomType: "Queen Standard", stayDate: "May 24 (Sat)", oldPrice: 348, newPrice: 386, changePct: 10.9, approvedBy: "Auto-publish", source: "Auto", reason: "Memorial Day pickup +23%" },
  { id: "p7",  decidedAt: "May 08, 04:31 PM", roomType: "King Deluxe", stayDate: "May 13 (Wed)", oldPrice: 268, newPrice: 282, changePct: 5.2, approvedBy: "Auto-publish", source: "Auto", reason: "Hilton midweek +$25" },
  { id: "p8",  decidedAt: "May 07, 10:12 AM", roomType: "Family Room", stayDate: "May 17 (Sat)", oldPrice: 398, newPrice: 425, changePct: 6.8, approvedBy: "M. Chen", source: "Override", reason: "GM directive — protect ADR" },
  { id: "p9",  decidedAt: "May 06, 08:50 AM", roomType: "Junior Suite", stayDate: "May 24 (Sat)", oldPrice: 478, newPrice: 525, changePct: 9.8, approvedBy: "Auto-publish", source: "Auto", reason: "DOW + pickup signal" },
  { id: "p10", decidedAt: "May 05, 03:24 PM", roomType: "Accessible King", stayDate: "May 22 (Thu)", oldPrice: 245, newPrice: 232, changePct: -5.3, approvedBy: "A. Singh", source: "Manual", reason: "Soft pickup correction" },
];
