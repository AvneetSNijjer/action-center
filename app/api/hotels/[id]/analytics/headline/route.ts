import { NextResponse } from "next/server";
import { getAnalyticsHeadline } from "@/lib/queries/analytics";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const url   = new URL(request.url);
  const ALLOWED_DAYS = [30, 90, 365] as const;
  const rawDays = parseInt(url.searchParams.get("days") ?? "90", 10);
  const days: 30 | 90 | 365 = (ALLOWED_DAYS as readonly number[]).includes(rawDays) ? (rawDays as 30 | 90 | 365) : 90;
  const name  = url.searchParams.get("name") ?? params.id;
  try {
    const data = await getAnalyticsHeadline(params.id, name, days);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err instanceof Error ? err.message : err) }, { status: 500 });
  }
}
