import { NextResponse } from "next/server";
import { getHeatmapData } from "@/lib/queries/forecast";
import { MERITON_KENT_HOTEL_ID } from "@/lib/insights-engine";

export const dynamic = "force-dynamic";

/** Generate a plausible 91-day heatmap fixture for Meriton Kent */
function mkHeatmapFixture() {
  const cells = [];
  const startMs = Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  for (let i = 0; i < 91; i++) {
    const d = new Date(startMs + i * 86400000);
    const dow = d.getUTCDay();
    const isWeekend = dow === 5 || dow === 6;
    const occ = Math.min(0.97, Math.max(0.45, 0.72 + Math.sin(i * 1.37) * 0.14 + (isWeekend ? 0.12 : 0)));
    const pace = Math.max(-0.3, Math.min(0.4, Math.sin(i * 0.6) * 0.18 + (isWeekend ? 0.07 : -0.03)));
    cells.push({
      date: d.toISOString().slice(0, 10),
      dow,
      occupancy: Number(occ.toFixed(3)),
      paceIndex: Number(pace.toFixed(3)),
      suggestedPrice: Math.round((isWeekend ? 360 : 285) * (1 + occ * 0.2)),
      roomsSold: Math.round(occ * 275),
      totalRooms: 275,
    });
  }
  return cells;
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    if (params.id === MERITON_KENT_HOTEL_ID) {
      return NextResponse.json({ ok: true, data: mkHeatmapFixture() });
    }
    const data = await getHeatmapData(params.id);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("[GET /api/hotels/[id]/forecast/heatmap]", err);
    return NextResponse.json(
      { ok: false, error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
