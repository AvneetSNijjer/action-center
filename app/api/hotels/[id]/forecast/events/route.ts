import { NextResponse } from "next/server";
import { getUpcomingEvents } from "@/lib/queries/forecast";
import { MERITON_KENT_HOTEL_ID } from "@/lib/insights-engine";

export const dynamic = "force-dynamic";

function daysOut(n: number) {
  return new Date(Date.now() + n * 86400000).toISOString();
}

const MERITON_KENT_EVENTS = [
  {
    eventId: "mk-e1",
    title: "Coldplay — Music of the Spheres Tour",
    category: "concerts",
    startDate: daysOut(17),
    endDate: daysOut(17),
    phqAttendance: 19500,
    distanceKm: 1.4,
    localRank: 88,
    predictedSpend: 1_200_000,
    impact: "high" as const,
    demandFlag: true,
    impactTotal: 180,
  },
  {
    eventId: "mk-e2",
    title: "London Tech Week 2026",
    category: "conferences",
    startDate: daysOut(8),
    endDate: daysOut(12),
    phqAttendance: 12000,
    distanceKm: 0.8,
    localRank: 82,
    predictedSpend: 2_400_000,
    impact: "high" as const,
    demandFlag: true,
    impactTotal: 165,
  },
  {
    eventId: "mk-e3",
    title: "Chelsea Flower Show",
    category: "expos",
    startDate: daysOut(22),
    endDate: daysOut(26),
    phqAttendance: 157000,
    distanceKm: 3.2,
    localRank: 91,
    predictedSpend: 8_700_000,
    impact: "high" as const,
    demandFlag: true,
    impactTotal: 200,
  },
  {
    eventId: "mk-e4",
    title: "Arsenal vs Manchester City — Premier League",
    category: "sports",
    startDate: daysOut(4),
    endDate: daysOut(4),
    phqAttendance: 60000,
    distanceKm: 5.1,
    localRank: 76,
    predictedSpend: 980_000,
    impact: "medium" as const,
    demandFlag: false,
    impactTotal: 120,
  },
  {
    eventId: "mk-e5",
    title: "London Jazz Festival Opening Night",
    category: "performing-arts",
    startDate: daysOut(29),
    endDate: daysOut(29),
    phqAttendance: 3800,
    distanceKm: 1.9,
    localRank: 63,
    predictedSpend: 145_000,
    impact: "low" as const,
    demandFlag: false,
    impactTotal: 55,
  },
];

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    if (params.id === MERITON_KENT_HOTEL_ID) {
      return NextResponse.json({ ok: true, data: MERITON_KENT_EVENTS });
    }
    const data = await getUpcomingEvents(params.id);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("[GET /api/hotels/[id]/forecast/events]", err);
    return NextResponse.json(
      { ok: false, error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
