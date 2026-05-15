/**
 * GET /api/hotels/[id]/suggested-price?date=YYYY-MM-DD
 * Returns the most recent suggested_prices row for a given date,
 * used to populate the "Why This Price" calculation panel.
 */
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const url   = new URL(request.url);
  const date  = url.searchParams.get("date");

  if (!date) {
    return NextResponse.json({ ok: false, error: "date param required" }, { status: 400 });
  }

  try {
    const rows = await sql<{
      suggested_price:    string | null;
      base_rate:          string | null;
      calculated_occupancy: string | null;
      calculated_pickup:  string | null;
      occ_push:           string | null;
      pick_push:          string | null;
      total_rooms:        string | null;
      push_summary:       string | null;
      business_explanation: string | null;
      room_type_code:     string | null;
      // derive floor/ceiling from base ± 40%
      status:             string | null;
    }>`
      SELECT
        COALESCE(suggested_price, base_rate)  AS suggested_price,
        base_rate,
        calculated_occupancy,
        calculated_pickup,
        occ_push,
        pick_push,
        total_rooms,
        push_summary,
        business_explanation,
        room_type_code,
        status
      FROM suggested_prices
      WHERE hotel_id = ${params.id}
        AND date     = ${date}
      ORDER BY updated_at DESC
      LIMIT 1
    `;

    if (!rows.length) {
      return NextResponse.json({ ok: true, data: null });
    }

    const r = rows[0];
    const base      = parseFloat(r.base_rate        ?? "0");
    const suggested = parseFloat(r.suggested_price  ?? String(base));
    const occPush   = parseFloat(r.occ_push         ?? "0");
    const pickPush  = parseFloat(r.pick_push        ?? "0");
    const calcOcc   = parseFloat(r.calculated_occupancy ?? "0");
    const totalRooms = parseInt(r.total_rooms ?? "0", 10);

    // Derive floor / ceiling heuristically from base rate (±30%)
    const floorPrice   = Math.round(base * 0.70);
    const ceilingPrice = Math.round(base * 1.50);

    // Adjustment factor = suggested / base
    const adjustmentFactor = base > 0 ? suggested / base : 1;

    return NextResponse.json({
      ok: true,
      data: {
        basePrice:         Math.round(base),
        suggestedPrice:    Math.round(suggested),
        floorPrice,
        ceilingPrice,
        dowWeight:         1.0,   // not stored, use placeholder
        dynamicElasticity: parseFloat((1 + occPush * 0.5 + pickPush * 0.3).toFixed(2)),
        occPush:           parseFloat(occPush.toFixed(3)),
        pickPush:          parseFloat(pickPush.toFixed(3)),
        adjustmentFactor:  parseFloat(adjustmentFactor.toFixed(3)),
        daysUntilStay:     0,   // stay date is in the past or today
        currentOccupancy:  parseFloat((calcOcc).toFixed(3)),
        expectedOccupancy: parseFloat((calcOcc * 1.05).toFixed(3)),
        // extra context
        roomTypeCode:      r.room_type_code ?? "",
        pushSummary:       r.push_summary   ?? "",
        businessExplanation: r.business_explanation ?? "",
        totalRooms,
        status:            r.status ?? "",
      },
    });
  } catch (err) {
    console.error(`[GET /api/hotels/${params.id}/suggested-price]`, err);
    return NextResponse.json(
      { ok: false, error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
