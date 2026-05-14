import { NextResponse } from "next/server";
import { getMorningBriefing } from "@/lib/queries/action-center";
import { MERITON_KENT_HOTEL_ID } from "@/lib/insights-engine";
import type { MorningBriefingData } from "@/lib/queries/action-center";

export const dynamic = "force-dynamic";

/** Showcase fixture for Meriton Kent — rich, presentation-ready numbers */
const MERITON_KENT_BRIEFING: MorningBriefingData = {
  hotelId: MERITON_KENT_HOTEL_ID,
  date: new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }),
  compLabel: "STLY",
  yesterday: {
    occupancy: { value: 84.2, comp: 78.6 },
    adr:       { value: 312,  comp: 289  },
    revpar:    { value: 263,  comp: 227  },
    revenue:   { value: 85488, comp: 73812 },
  },
  mtd: {
    revpar:     241.8,
    occupancy:  79.4,
    adr:        304.5,
    revenue:    1_243_600,
    daysElapsed: new Date().getDate(),
    daysInMonth: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate(),
    projectedRevpar:    247.3,
    projectedOccupancy: 80.2,
    projectedRevenue:   2_389_000,
  },
  tonight: {
    occupancy:  73.4,
    adr:        298.0,
    revenue:    65218,
    roomsSold:  202,
    totalRooms: 275,
  },
  pickup7d: 14,
};

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    if (params.id === MERITON_KENT_HOTEL_ID) {
      return NextResponse.json({ ok: true, data: MERITON_KENT_BRIEFING });
    }
    const data = await getMorningBriefing(params.id);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error(`[GET /api/hotels/${params.id}/morning-briefing]`, err);
    return NextResponse.json(
      { ok: false, error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
