import { NextResponse } from "next/server";
import { getPricingAuditTrail } from "@/lib/queries/analytics";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const limit = parseInt(new URL(request.url).searchParams.get("limit") ?? "50", 10) || 50;
  try {
    const data = await getPricingAuditTrail(params.id, limit);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err instanceof Error ? err.message : err) }, { status: 500 });
  }
}
