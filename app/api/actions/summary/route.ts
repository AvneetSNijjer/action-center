import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const hotelId = searchParams.get("hotelId");

    // Build an optional WHERE clause scoping to a single hotel when hotelId is provided.
    // We resolve the string hotel_id to the integer PK via a subquery so the caller
    // can pass the same hotel_id string used everywhere else in the app.
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
        COUNT(*) FILTER (WHERE status = 'pending')                                                 AS pending_total,
        COUNT(*) FILTER (WHERE status = 'approved')                                                AS approved_total,
        COUNT(*) FILTER (WHERE status = 'denied')                                                  AS denied_total,
        COUNT(*) FILTER (WHERE status = 'pending'  AND created_at  >= CURRENT_DATE)                AS pending_today,
        COUNT(*) FILTER (WHERE status = 'approved' AND reviewed_at >= CURRENT_DATE)                AS approved_today,
        COUNT(*) FILTER (WHERE status = 'denied'   AND reviewed_at >= CURRENT_DATE)                AS denied_today,
        COUNT(*) FILTER (WHERE status = 'approved' AND reviewed_at >= CURRENT_DATE
                          AND approved_by IS NULL)                                                 AS auto_published_today
      FROM auto_publishing_rate_reviews
      WHERE (
        ${hotelId}::text IS NULL
        OR hotel_id = (SELECT id FROM hotels WHERE hotel_id = ${hotelId} AND deleted_at IS NULL LIMIT 1)
      )
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
