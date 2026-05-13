import { NextResponse } from "next/server";
import { getHotel } from "@/lib/queries/hotels";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const hotel = await getHotel(params.id);
    if (!hotel) {
      return NextResponse.json({ ok: false, error: "Hotel not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: hotel });
  } catch (err) {
    console.error(`[GET /api/hotels/${params.id}]`, err);
    return NextResponse.json(
      { ok: false, error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
