import { NextResponse } from "next/server";
import { getInsights } from "@/lib/queries/action-center";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const data = await getInsights(params.id);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error(`[GET /api/hotels/${params.id}/insights]`, err);
    return NextResponse.json(
      { ok: false, error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
