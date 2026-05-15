// This route is kept for backwards compatibility but now points to the booking-pace endpoint.
// The actual implementation is in /analytics/booking-pace/route.ts
import { NextResponse } from "next/server";
import { getBookingPace } from "@/lib/queries/analytics";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const data = await getBookingPace(params.id);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
