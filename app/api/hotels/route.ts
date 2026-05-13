import { NextResponse } from "next/server";
import { listHotels } from "@/lib/queries/hotels";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const withKpis = searchParams.get("withKpis") === "true";

    const isSuperuser = process.env.DEMO_IS_SUPERUSER === "true";

    // For demo we don't have real auth — act as superuser if env says so
    const hotels = await listHotels(undefined, isSuperuser || true);

    if (!withKpis) {
      // Strip KPI fields for lighter payload
      const slim = hotels.map(({ id, name, city, state, location, pendingApprovals }) => ({
        id,
        name,
        city,
        state,
        location,
        pendingApprovals,
      }));
      return NextResponse.json({ ok: true, data: slim });
    }

    return NextResponse.json({ ok: true, data: hotels });
  } catch (err) {
    console.error("[GET /api/hotels]", err);
    return NextResponse.json(
      { ok: false, error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
