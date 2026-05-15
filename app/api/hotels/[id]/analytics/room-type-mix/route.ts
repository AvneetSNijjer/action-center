import { NextResponse } from "next/server";
import { getRoomTypeMix } from "@/lib/queries/analytics";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const days = (parseInt(new URL(request.url).searchParams.get("days") ?? "90", 10) || 90) as 30 | 90 | 365;
  try {
    const data = await getRoomTypeMix(params.id, days);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
