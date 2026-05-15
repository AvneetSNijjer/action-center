import { NextResponse } from "next/server";
import { getUpcomingEvents } from "@/lib/queries/forecast";
import { MERITON_KENT_HOTEL_ID } from "@/lib/insights-engine";

export const dynamic = "force-dynamic";

function daysOut(n: number) {
  return new Date(Date.now() + n * 86400000).toISOString();
}

// Fixture includes ALL fields required by UpcomingEventRow to prevent runtime crashes
const MERITON_KENT_EVENTS = [
  {
    eventId: "mk-e1",
    title: "Coldplay — Music of the Spheres Tour",
    category: "concerts",
    startDate: daysOut(17),
    endDate: daysOut(17),
    durationDays: 1,
    distanceKm: 1.4,
    rank: 88,
    localRank: 88,
    phqLabels: ["concerts", "music", "entertainment"],
    impact: "high" as const,
    demandFlag: true,
    avgBaseRate: 285,
    avgSuggestedPrice: 348,
    pricingRatio: 1.221,
  },
  {
    eventId: "mk-e2",
    title: "London Tech Week 2026",
    category: "conferences",
    startDate: daysOut(8),
    endDate: daysOut(12),
    durationDays: 5,
    distanceKm: 0.8,
    rank: 82,
    localRank: 82,
    phqLabels: ["conferences", "technology", "business"],
    impact: "high" as const,
    demandFlag: true,
    avgBaseRate: 310,
    avgSuggestedPrice: 372,
    pricingRatio: 1.200,
  },
  {
    eventId: "mk-e3",
    title: "Chelsea Flower Show",
    category: "expos",
    startDate: daysOut(22),
    endDate: daysOut(26),
    durationDays: 5,
    distanceKm: 3.2,
    rank: 91,
    localRank: 91,
    phqLabels: ["expos", "garden", "royalty"],
    impact: "high" as const,
    demandFlag: true,
    avgBaseRate: 340,
    avgSuggestedPrice: 442,
    pricingRatio: 1.300,
  },
  {
    eventId: "mk-e4",
    title: "Arsenal vs Manchester City — Premier League",
    category: "sports",
    startDate: daysOut(4),
    endDate: daysOut(4),
    durationDays: 1,
    distanceKm: 5.1,
    rank: 76,
    localRank: 76,
    phqLabels: ["sports", "football", "premier-league"],
    impact: "medium" as const,
    demandFlag: false,
    avgBaseRate: 285,
    avgSuggestedPrice: 313,
    pricingRatio: 1.098,
  },
  {
    eventId: "mk-e5",
    title: "London Jazz Festival Opening Night",
    category: "performing-arts",
    startDate: daysOut(29),
    endDate: daysOut(29),
    durationDays: 1,
    distanceKm: 1.9,
    rank: 63,
    localRank: 63,
    phqLabels: ["performing-arts", "music", "jazz"],
    impact: "low" as const,
    demandFlag: false,
    avgBaseRate: 285,
    avgSuggestedPrice: 291,
    pricingRatio: 1.021,
  },
];

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const CC = { "Cache-Control": "private, max-age=300, stale-while-revalidate=60" };
    if (params.id === MERITON_KENT_HOTEL_ID) {
      return NextResponse.json({ ok: true, data: MERITON_KENT_EVENTS }, { headers: CC });
    }
    const data = await getUpcomingEvents(params.id);
    return NextResponse.json({ ok: true, data }, { headers: CC });
  } catch (err) {
    console.error("[GET /api/hotels/[id]/forecast/events]", err);
    return NextResponse.json(
      { ok: false, error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
