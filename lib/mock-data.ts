import type { Insight } from "./types";

const now = Date.now();
const minutesAgo = (m: number) => new Date(now - m * 60 * 1000).toISOString();
const hoursAgo = (h: number) => new Date(now - h * 60 * 60 * 1000).toISOString();

export const HOTELS = [
  { id: "h1", name: "The Beacon Hotel — Downtown", location: "Boston, MA", rooms: 218 },
  { id: "h2", name: "Harborview Suites", location: "Seattle, WA", rooms: 144 },
  { id: "h3", name: "The Wren — Midtown", location: "New York, NY", rooms: 312 },
];

export const INSIGHTS: Insight[] = [
  {
    id: "i1",
    type: "competitor_change",
    severity: "critical",
    title: "Marriott Downtown dropped Saturday rate by $42",
    summary: "You are now 19% above market for Sat May 17. Suggested action: review competitive positioning.",
    body:
      "Marriott Downtown reduced its BAR for Saturday May 17 from $329 to $287 in the last 2 hours. Your current price is $342, putting you 19% above the new market median of $287. Historically, hotels that hold premium pricing >15% above market on weekends see a 7-12% occupancy drop in the final 14-day window.",
    hotel: "The Beacon Hotel — Downtown",
    roomType: "King Deluxe",
    affectedDates: ["2026-05-17"],
    createdAt: minutesAgo(8),
    revenueImpact: 4200,
    source: "CompetitorRates · SearchAPI",
    metrics: [
      { label: "Your price", value: "$342" },
      { label: "Market median", value: "$287", trend: "down", delta: "-$42" },
      { label: "Price gap", value: "+19%", trend: "up" },
      { label: "Days until stay", value: "6 days" },
    ],
    chart: {
      kind: "bar",
      data: [
        { name: "You", a: 342 },
        { name: "Marriott", a: 287 },
        { name: "Hilton", a: 295 },
        { name: "Hyatt", a: 312 },
        { name: "Westin", a: 305 },
      ],
      aLabel: "Saturday Rate ($)",
    },
    actions: [
      { id: "review", label: "Review pricing", primary: true },
      { id: "adjust", label: "Suggest new price" },
      { id: "snooze", label: "Snooze 4h" },
      { id: "dismiss", label: "Dismiss" },
    ],
    status: "new",
  },
  {
    id: "i2",
    type: "event_alert",
    severity: "opportunity",
    title: "Coldplay concert at TD Garden — 19,500 attendees",
    summary: "Major concert Fri May 30, 1.4 km away. Predicted accommodation spend +$1.2M.",
    body:
      "PredictHQ has flagged a high-impact concert (Local Rank 88) at TD Garden on Friday May 30. Expected attendance: 19,500. Predicted regional accommodation spend lift: +$1.2M. Currently 41% of your hotel inventory is unsold for that night at an average price of $289 — well below event-night optimal pricing.",
    hotel: "The Beacon Hotel — Downtown",
    affectedDates: ["2026-05-29", "2026-05-30", "2026-05-31"],
    createdAt: hoursAgo(2),
    revenueImpact: 18600,
    source: "PredictHQ Events API",
    metrics: [
      { label: "Event date", value: "Fri May 30" },
      { label: "Attendance", value: "19,500" },
      { label: "Distance", value: "1.4 km" },
      { label: "Unsold rooms", value: "89 (41%)" },
    ],
    chart: {
      kind: "bar",
      data: [
        { name: "Thu", a: 165, b: 240 },
        { name: "Fri", a: 289, b: 410 },
        { name: "Sat", a: 305, b: 395 },
        { name: "Sun", a: 195, b: 215 },
      ],
      aLabel: "Current price",
      bLabel: "Suggested",
    },
    actions: [
      { id: "approve", label: "Apply event pricing", primary: true },
      { id: "review", label: "Review details" },
      { id: "snooze", label: "Snooze 1d" },
      { id: "dismiss", label: "Dismiss" },
    ],
    status: "new",
  },
  {
    id: "i3",
    type: "demand_pacing",
    severity: "opportunity",
    title: "Weekend pickup running 23% ahead of curve",
    summary: "Memorial Day weekend is pacing well above expected. Capture more revenue with higher prices.",
    body:
      "For Memorial Day weekend (May 23-25), cumulative actual pickup is 23% above the expected booking curve. Sat May 24 in particular is 31% ahead. Current pricing reflects baseline demand; recommend tightening yield to capture this upside without choking demand.",
    hotel: "The Beacon Hotel — Downtown",
    affectedDates: ["2026-05-23", "2026-05-24", "2026-05-25"],
    createdAt: hoursAgo(4),
    revenueImpact: 9800,
    source: "DailyInventory · Expected Booking Curves",
    metrics: [
      { label: "Actual pickup", value: "168 rooms" },
      { label: "Expected", value: "137 rooms" },
      { label: "Variance", value: "+23%", trend: "up" },
      { label: "Days until stay", value: "12 days" },
    ],
    chart: {
      kind: "line",
      data: [
        { name: "-21d", a: 12, b: 14 },
        { name: "-18d", a: 28, b: 33 },
        { name: "-15d", a: 51, b: 64 },
        { name: "-12d", a: 78, b: 99 },
        { name: "-9d", a: 102, b: 134 },
        { name: "-6d", a: 122, b: 162 },
        { name: "Today", a: 137, b: 168 },
      ],
      aLabel: "Expected",
      bLabel: "Actual",
    },
    actions: [
      { id: "approve", label: "Apply suggested uplift", primary: true },
      { id: "review", label: "Review forecast" },
      { id: "dismiss", label: "Dismiss" },
    ],
    status: "new",
  },
  {
    id: "i4",
    type: "cancellation_alert",
    severity: "warning",
    title: "Unusual cancellation spike — 12 rooms for Fri May 23",
    summary: "Cancellations 4× the 30-day average. Pickup outlook now soft.",
    body:
      "In the last 24 hours, 12 reservations were cancelled for Friday May 23 — 4× your rolling 30-day average of 3 cancellations per day. This drops projected final occupancy from 91% to 84%. Recommend re-evaluating Fri rate; pricing may currently be too aggressive vs. softening demand.",
    hotel: "The Beacon Hotel — Downtown",
    affectedDates: ["2026-05-23"],
    createdAt: hoursAgo(6),
    revenueImpact: -3600,
    source: "Reservations · PMS Sync",
    metrics: [
      { label: "Cancellations 24h", value: "12" },
      { label: "30d average", value: "3" },
      { label: "Projected occ", value: "84%", trend: "down", delta: "-7%" },
      { label: "ADR exposure", value: "$3,468" },
    ],
    actions: [
      { id: "review", label: "Investigate", primary: true },
      { id: "adjust", label: "Adjust price" },
      { id: "dismiss", label: "Dismiss" },
    ],
    status: "new",
  },
  {
    id: "i5",
    type: "revenue_pacing",
    severity: "warning",
    title: "RevPAR pacing 11% below May target",
    summary: "$23k gap to month-to-date target. Highest impact: weekday corporate ADR.",
    body:
      "RevPAR MTD is $148, versus a $166 target — a -11% gap totaling roughly $23k in missed revenue. Drilldown shows weekday corporate ADR is the largest underperformer at -14% vs forecast. Weekend leisure is on target. Consider corporate rate audit and a midweek demand push.",
    hotel: "The Beacon Hotel — Downtown",
    createdAt: hoursAgo(9),
    revenueImpact: -23000,
    source: "RevPAR Log · Financial Metrics",
    metrics: [
      { label: "MTD RevPAR", value: "$148" },
      { label: "Target", value: "$166", trend: "neutral" },
      { label: "Gap", value: "-11%", trend: "down" },
      { label: "Revenue gap", value: "-$23k" },
    ],
    chart: {
      kind: "line",
      data: [
        { name: "May 1", a: 162, b: 158 },
        { name: "May 5", a: 164, b: 152 },
        { name: "May 9", a: 166, b: 149 },
        { name: "May 11", a: 166, b: 148 },
      ],
      aLabel: "Target",
      bLabel: "Actual",
    },
    actions: [
      { id: "review", label: "Open drilldown", primary: true },
      { id: "snooze", label: "Snooze 1d" },
    ],
    status: "new",
  },
  {
    id: "i6",
    type: "pending_approvals",
    severity: "info",
    title: "6 suggested prices waiting on your approval",
    summary: "Oldest pending suggestion is 18 hours old. Review and publish to keep auto-sync healthy.",
    body:
      "There are 6 dynamic price suggestions in 'pending' status. 3 are for high-impact dates (next 14 days, occupancy >70%). The oldest pending suggestion is 18 hours old — leaving suggestions stale risks the auto-publishing window expiring and degrades pricing freshness.",
    hotel: "The Beacon Hotel — Downtown",
    createdAt: hoursAgo(1),
    revenueImpact: 7200,
    source: "SuggestedPrices Queue",
    metrics: [
      { label: "Pending", value: "6" },
      { label: "Oldest", value: "18h" },
      { label: "High-impact", value: "3" },
      { label: "Total value", value: "$7,200" },
    ],
    actions: [
      { id: "approve", label: "Review & approve all", primary: true },
      { id: "view", label: "Open queue" },
    ],
    status: "new",
  },
  {
    id: "i7",
    type: "stale_pricing",
    severity: "info",
    title: "3 room types haven't repriced in 9+ days",
    summary: "Stale pricing may be missing demand shifts. Trigger a refresh.",
    body:
      "Junior Suite, Family Room, and Accessible King have not had a price update in 9, 11, and 12 days respectively. Pricing freshness SLA is 7 days. Refresh suggestions can be generated on demand.",
    hotel: "The Beacon Hotel — Downtown",
    createdAt: hoursAgo(14),
    source: "SuggestedPrices · Freshness Monitor",
    metrics: [
      { label: "Stale room types", value: "3" },
      { label: "Oldest", value: "12 days" },
      { label: "SLA", value: "7 days" },
    ],
    actions: [
      { id: "approve", label: "Generate refresh", primary: true },
      { id: "view", label: "View details" },
      { id: "dismiss", label: "Dismiss" },
    ],
    status: "new",
  },
  {
    id: "i8",
    type: "competitor_change",
    severity: "warning",
    title: "Hilton raised midweek rates by $25",
    summary: "Hilton Downtown moved Tue-Wed rates up. Opportunity to follow.",
    body:
      "Hilton Downtown increased Tue May 13 and Wed May 14 rates by $22-$25, suggesting they're seeing stronger midweek corporate demand. You're now slightly below market by $14-$17.",
    hotel: "The Beacon Hotel — Downtown",
    affectedDates: ["2026-05-13", "2026-05-14"],
    createdAt: hoursAgo(11),
    revenueImpact: 2900,
    source: "CompetitorRates",
    metrics: [
      { label: "Hilton uplift", value: "+$25" },
      { label: "Your gap", value: "-$17" },
      { label: "Days out", value: "2-3" },
    ],
    actions: [
      { id: "review", label: "Review", primary: true },
      { id: "dismiss", label: "Dismiss" },
    ],
    status: "new",
  },
];

export const DISMISSED_INSIGHTS: Insight[] = [
  {
    ...INSIGHTS[7],
    id: "d1",
    title: "Westin dropped premium suite rate by $80",
    createdAt: hoursAgo(72),
    status: "dismissed",
  },
  {
    ...INSIGHTS[2],
    id: "d2",
    title: "Pickup pacing 12% ahead for Memorial Day",
    createdAt: hoursAgo(96),
    status: "actioned",
  },
];

// Weekly trend for header chart
export const ACTION_TREND = [
  { name: "Mon", new: 12, actioned: 9 },
  { name: "Tue", new: 9, actioned: 8 },
  { name: "Wed", new: 14, actioned: 11 },
  { name: "Thu", new: 11, actioned: 10 },
  { name: "Fri", new: 17, actioned: 14 },
  { name: "Sat", new: 8, actioned: 7 },
  { name: "Sun", new: 6, actioned: 5 },
];
