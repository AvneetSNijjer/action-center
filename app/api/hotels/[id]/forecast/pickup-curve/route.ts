import { NextResponse } from "next/server";
import { getPickupCurveData } from "@/lib/queries/forecast";
import { MERITON_KENT_HOTEL_ID } from "@/lib/insights-engine";

export const dynamic = "force-dynamic";

function mkPickupFixture() {
  const targetDate = new Date();
  // Next Saturday
  const daysToSat = (6 - targetDate.getDay() + 7) % 7 || 7;
  if (daysToSat < 10) targetDate.setDate(targetDate.getDate() + daysToSat + 7);
  else targetDate.setDate(targetDate.getDate() + daysToSat);
  const targetDateStr = targetDate.toISOString().slice(0, 10);
  const daysUntilStay = Math.round((targetDate.getTime() - Date.now()) / 86400000);

  const dailyPickup = [];
  const today = new Date();
  for (let d = 0; d < 14; d++) {
    const dt = new Date(today.getTime() + d * 86400000);
    const isWeekend = dt.getDay() === 5 || dt.getDay() === 6;
    dailyPickup.push({
      date: dt.toISOString().slice(0, 10),
      dow: dt.getDay(),
      pickup: Math.round((isWeekend ? 18 : 8) + Math.sin(d * 1.1) * 6),
      otb: Math.round((isWeekend ? 210 : 165) + Math.sin(d * 0.4) * 20),
      capacity: 275,
    });
  }

  return {
    targetDate: targetDateStr,
    daysUntilStay,
    totalRooms: 275,
    otbRooms: 202,
    otbOccupancy: 0.734,
    stlyRooms: 188,
    stlyOccupancy: 0.683,
    stlyAvailable: true,
    paceVsComp: 7.5,
    compLabel: "vs STLY",
    dailyPickup,
  };
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const CC = { "Cache-Control": "private, max-age=300, stale-while-revalidate=60" };
    if (params.id === MERITON_KENT_HOTEL_ID) {
      return NextResponse.json({ ok: true, data: mkPickupFixture() }, { headers: CC });
    }
    const data = await getPickupCurveData(params.id);
    return NextResponse.json({ ok: true, data }, { headers: CC });
  } catch (err) {
    console.error("[GET /api/hotels/[id]/forecast/pickup-curve]", err);
    return NextResponse.json(
      { ok: false, error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
