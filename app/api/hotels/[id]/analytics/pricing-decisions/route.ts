import { NextResponse } from "next/server";
import { getPricingAuditTrail } from "@/lib/queries/analytics";

export const dynamic = "force-dynamic";

const ALLOWED_DAYS = [30, 90, 365] as const;

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 200);
  const rawDays = parseInt(searchParams.get("days") ?? "90", 10);
  const days: 30 | 90 | 365 = (ALLOWED_DAYS as readonly number[]).includes(rawDays)
    ? (rawDays as 30 | 90 | 365)
    : 90;
  try {
    const data = await getPricingAuditTrail(params.id, limit, days);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err instanceof Error ? err.message : err) }, { status: 500 });
  }
}
