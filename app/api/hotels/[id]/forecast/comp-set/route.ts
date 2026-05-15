import { NextResponse } from "next/server";
import { getCompSetData } from "@/lib/queries/forecast";
import { MERITON_KENT_HOTEL_ID } from "@/lib/insights-engine";

export const dynamic = "force-dynamic";

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function mkCompSetFixture() {
  const rows = [];
  const competitors = [
    { name: "Grand Hyatt London", hotelClass: "5-star hotel" },
    { name: "Marriott London Park Lane", hotelClass: "5-star hotel" },
    { name: "InterContinental London", hotelClass: "5-star hotel" },
    { name: "Hilton London Metropole", hotelClass: "4-star hotel" },
  ];
  for (let d = 0; d < 7; d++) {
    const dt = new Date(Date.now() + d * 86400000);
    const date = dt.toISOString().slice(0, 10);
    const dow = DOW_LABELS[dt.getDay()];
    const isWeekend = dt.getDay() === 5 || dt.getDay() === 6;
    const myRate = Math.round((isWeekend ? 380 : 310) + Math.sin(d * 0.7) * 22);
    const compRates = competitors.map((c, i) => ({
      ...c,
      isMyHotel: false,
      rate: Math.round((isWeekend ? 355 : 290) + Math.sin(d * 0.5 + i) * 30),
    }));
    const myEntry = { name: "Meriton Kent Hotel", hotelClass: "4-star hotel", isMyHotel: true, rate: myRate };
    const allComps = [myEntry, ...compRates];
    const compRateValues = compRates.map((c) => c.rate).sort((a, b) => a - b);
    const median = compRateValues.length % 2 === 1
      ? compRateValues[Math.floor(compRateValues.length / 2)]
      : (compRateValues[compRateValues.length / 2 - 1] + compRateValues[compRateValues.length / 2]) / 2;
    const gap = ((myRate - median) / median) * 100;
    rows.push({ date, dow, myRate, competitors: allComps, median, gap });
  }
  return rows;
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const CC = { "Cache-Control": "private, max-age=300, stale-while-revalidate=60" };
    if (params.id === MERITON_KENT_HOTEL_ID) {
      return NextResponse.json({ ok: true, data: mkCompSetFixture() }, { headers: CC });
    }
    const data = await getCompSetData(params.id);
    return NextResponse.json({ ok: true, data }, { headers: CC });
  } catch (err) {
    console.error("[GET /api/hotels/[id]/forecast/comp-set]", err);
    return NextResponse.json(
      { ok: false, error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
