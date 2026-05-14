import { NextResponse } from "next/server";
import { getInsights } from "@/lib/queries/action-center";
import { runInsightsEngine, MERITON_KENT_HOTEL_ID, MERITON_KENT_INSIGHTS } from "@/lib/insights-engine";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const hotelId = params.id;

    // Showcase fixture for Meriton Kent Hotel
    if (hotelId === MERITON_KENT_HOTEL_ID) {
      return NextResponse.json({ ok: true, data: MERITON_KENT_INSIGHTS });
    }

    // Fetch DB insights + run rule-based engine concurrently
    const dbInsights = await getInsights(hotelId);
    const enriched = await runInsightsEngine(hotelId, dbInsights);

    return NextResponse.json({ ok: true, data: enriched });
  } catch (err) {
    console.error(`[GET /api/hotels/${params.id}/insights]`, err);
    return NextResponse.json(
      { ok: false, error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
