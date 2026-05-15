import { NextResponse } from "next/server";
import { getStrategyPerformance } from "@/lib/queries/strategy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const data = await getStrategyPerformance(params.id);
    const CC = { "Cache-Control": "private, max-age=300, stale-while-revalidate=60" };
    if (!data) {
      return NextResponse.json({ ok: false, error: "No performance data" }, { status: 404, headers: CC });
    }
    return NextResponse.json({ ok: true, data }, { headers: CC });
  } catch (err) {
    console.error("[strategy/performance]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
