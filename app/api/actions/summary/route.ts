import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const rows = await sql<{
      pending_total: string;
      approved_total: string;
      denied_total: string;
      pending_today: string;
      approved_today: string;
      denied_today: string;
      auto_published_today: string;
    }>`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending')                                    AS pending_total,
        COUNT(*) FILTER (WHERE status = 'approved')                                   AS approved_total,
        COUNT(*) FILTER (WHERE status = 'denied')                                     AS denied_total,
        COUNT(*) FILTER (WHERE status = 'pending'  AND created_at  >= CURRENT_DATE)   AS pending_today,
        COUNT(*) FILTER (WHERE status = 'approved' AND reviewed_at >= CURRENT_DATE)   AS approved_today,
        COUNT(*) FILTER (WHERE status = 'denied'   AND reviewed_at >= CURRENT_DATE)   AS denied_today,
        COUNT(*) FILTER (WHERE reviewed_at >= CURRENT_DATE)                            AS auto_published_today
      FROM auto_publishing_rate_reviews
    `;

    const r = rows[0];
    return NextResponse.json({
      ok: true,
      data: {
        pendingTotal:       parseInt(r.pending_total ?? "0", 10),
        approvedTotal:      parseInt(r.approved_total ?? "0", 10),
        deniedTotal:        parseInt(r.denied_total ?? "0", 10),
        pendingToday:       parseInt(r.pending_today ?? "0", 10),
        approvedToday:      parseInt(r.approved_today ?? "0", 10),
        deniedToday:        parseInt(r.denied_today ?? "0", 10),
        autoPublishedToday: parseInt(r.auto_published_today ?? "0", 10),
      },
    });
  } catch (err) {
    console.error("[actions/summary]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
