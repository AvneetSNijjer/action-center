import { NextResponse } from "next/server";
import { getPricingConfig } from "@/lib/queries/strategy";
import { getStrategyProfiles } from "@/lib/queries/strategy";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const [config, profiles] = await Promise.all([
      getPricingConfig(params.id),
      getStrategyProfiles(),
    ]);
    return NextResponse.json({ ok: true, data: { config, profiles } });
  } catch (err) {
    console.error(`[GET /api/hotels/${params.id}/strategy]`, err);
    return NextResponse.json(
      { ok: false, error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
