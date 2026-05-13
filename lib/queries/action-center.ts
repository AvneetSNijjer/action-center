/**
 * Action Center queries — morning briefing, pending approvals, insights.
 */

import { sql, cached } from "@/lib/db";

/* ============================================================
 * Morning Briefing
 * ============================================================ */

export interface MorningBriefingData {
  hotelId: string;
  date: string; // "Wednesday, May 13 2026"
  // Yesterday vs STLY
  yesterday: {
    occupancy: { value: number; stly: number };
    adr: { value: number; stly: number };
    revpar: { value: number; stly: number };
    revenue: { value: number; stly: number };
  };
  // 7-day pickup (reservations added in last 7 days for future stays)
  pickup7d: number;
  // Tonight's quick stats
  tonight: {
    occupancy: number;    // %
    revenue: number;      // $
    adr: number;          // $
  };
}

export async function getMorningBriefing(hotelId: string): Promise<MorningBriefingData> {
  return cached(
    "morningBriefing",
    { hotelId },
    async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const ydStr = yesterday.toISOString().slice(0, 10);

      // Yesterday vs STLY
      const ydRows = await sql<{
        occupancy: string | null;
        adr: string | null;
        revpar: string | null;
        revenue: string | null;
      }>`
        SELECT
          SUM(di.actual_occupancy)::float /
            NULLIF(SUM(di.available_count + di.out_of_service_count + di.actual_occupancy), 0) * 100
            AS occupancy,
          CASE
            WHEN SUM(di.actual_occupancy) > 0
            THEN SUM(di.actual_occupancy * COALESCE(sp.suggested_price, sp.base_rate)) / SUM(di.actual_occupancy)
            ELSE NULL
          END AS adr,
          SUM(di.actual_occupancy * COALESCE(sp.suggested_price, sp.base_rate)) /
            NULLIF(SUM(di.available_count + di.out_of_service_count + di.actual_occupancy), 0)
            AS revpar,
          SUM(di.actual_occupancy * COALESCE(sp.suggested_price, sp.base_rate)) AS revenue
        FROM daily_inventory di
        LEFT JOIN suggested_prices sp
          ON sp.hotel_id = di.hotel_id
         AND sp.date = di.inventory_date
         AND sp.room_type_code = di.room_type_code
        WHERE di.hotel_id = ${hotelId}
          AND di.inventory_date = ${ydStr}
      `;

      // Same date last year
      const lyDate = new Date(yesterday);
      lyDate.setFullYear(lyDate.getFullYear() - 1);
      const lyStr = lyDate.toISOString().slice(0, 10);

      const lyRows = await sql<{
        occupancy: string | null;
        adr: string | null;
        revpar: string | null;
        revenue: string | null;
      }>`
        SELECT
          SUM(di.actual_occupancy)::float /
            NULLIF(SUM(di.available_count + di.out_of_service_count + di.actual_occupancy), 0) * 100
            AS occupancy,
          CASE
            WHEN SUM(di.actual_occupancy) > 0
            THEN SUM(di.actual_occupancy * COALESCE(sp.suggested_price, sp.base_rate)) / SUM(di.actual_occupancy)
            ELSE NULL
          END AS adr,
          SUM(di.actual_occupancy * COALESCE(sp.suggested_price, sp.base_rate)) /
            NULLIF(SUM(di.available_count + di.out_of_service_count + di.actual_occupancy), 0)
            AS revpar,
          SUM(di.actual_occupancy * COALESCE(sp.suggested_price, sp.base_rate)) AS revenue
        FROM daily_inventory di
        LEFT JOIN suggested_prices sp
          ON sp.hotel_id = di.hotel_id
         AND sp.date = di.inventory_date
         AND sp.room_type_code = di.room_type_code
        WHERE di.hotel_id = ${hotelId}
          AND di.inventory_date = ${lyStr}
      `;

      // Tonight's stats (today)
      const todayStr = new Date().toISOString().slice(0, 10);
      const tonightRows = await sql<{
        occupancy: string | null;
        adr: string | null;
        revenue: string | null;
      }>`
        SELECT
          SUM(di.actual_occupancy)::float /
            NULLIF(SUM(di.available_count + di.out_of_service_count + di.actual_occupancy), 0) * 100
            AS occupancy,
          CASE
            WHEN SUM(di.actual_occupancy) > 0
            THEN SUM(di.actual_occupancy * COALESCE(sp.suggested_price, sp.base_rate)) / SUM(di.actual_occupancy)
            ELSE NULL
          END AS adr,
          SUM(di.actual_occupancy * COALESCE(sp.suggested_price, sp.base_rate)) AS revenue
        FROM daily_inventory di
        LEFT JOIN suggested_prices sp
          ON sp.hotel_id = di.hotel_id
         AND sp.date = di.inventory_date
         AND sp.room_type_code = di.room_type_code
        WHERE di.hotel_id = ${hotelId}
          AND di.inventory_date = ${todayStr}
      `;

      // 7-day pickup — how many new pending approvals arrived in last 7 days
      const pickupRows = await sql<{ cnt: string }>`
        SELECT COUNT(*) AS cnt
        FROM auto_publishing_rate_reviews
        WHERE hotel_id = ${hotelId}
          AND created_at >= CURRENT_DATE - INTERVAL '7 days'
      `;

      const yd = ydRows[0] ?? {};
      const ly = lyRows[0] ?? {};
      const tn = tonightRows[0] ?? {};

      const now = new Date();
      const dateLabel = now.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      return {
        hotelId,
        date: dateLabel,
        yesterday: {
          occupancy: {
            value: yd.occupancy != null ? Number(Number(yd.occupancy).toFixed(1)) : 0,
            stly: ly.occupancy != null ? Number(Number(ly.occupancy).toFixed(1)) : 0,
          },
          adr: {
            value: yd.adr != null ? Number(Number(yd.adr).toFixed(2)) : 0,
            stly: ly.adr != null ? Number(Number(ly.adr).toFixed(2)) : 0,
          },
          revpar: {
            value: yd.revpar != null ? Number(Number(yd.revpar).toFixed(2)) : 0,
            stly: ly.revpar != null ? Number(Number(ly.revpar).toFixed(2)) : 0,
          },
          revenue: {
            value: yd.revenue != null ? Number(Number(yd.revenue).toFixed(2)) : 0,
            stly: ly.revenue != null ? Number(Number(ly.revenue).toFixed(2)) : 0,
          },
        },
        pickup7d: parseInt(pickupRows[0]?.cnt ?? "0", 10),
        tonight: {
          occupancy: tn.occupancy != null ? Number(Number(tn.occupancy).toFixed(1)) : 0,
          adr: tn.adr != null ? Number(Number(tn.adr).toFixed(2)) : 0,
          revenue: tn.revenue != null ? Number(Number(tn.revenue).toFixed(2)) : 0,
        },
      };
    },
    300_000 // 5-minute cache
  );
}

/* ============================================================
 * Pending Approvals
 * ============================================================ */

export interface ApprovalRow {
  id: string;
  hotelId: string;
  roomTypeId: string;
  stayDate: string;        // ISO yyyy-mm-dd
  currentRate: number;
  suggestedRate: number;
  change: number;
  changePct: number;
  violationType: string;
  violationSeverity: string;
  status: string;
  createdAt: string;
}

export async function getPendingApprovals(hotelId: string): Promise<ApprovalRow[]> {
  return cached(
    "pendingApprovals",
    { hotelId },
    async () => {
      const rows = await sql<{
        id: string;
        hotel_id: string;
        room_type_id: string;
        stay_date: string;
        current_rate: string;
        suggested_rate: string;
        threshold_violation_type: string | null;
        violation_severity: string | null;
        status: string;
        created_at: string;
      }>`
        SELECT
          id::text,
          hotel_id,
          room_type_id::text,
          stay_date::text,
          current_rate::text,
          suggested_rate::text,
          threshold_violation_type,
          violation_severity,
          status,
          created_at::text
        FROM auto_publishing_rate_reviews
        WHERE hotel_id = ${hotelId}
          AND status = 'pending'
        ORDER BY created_at DESC
        LIMIT 50
      `;

      return rows.map((r) => {
        const curr = Number(r.current_rate);
        const sugg = Number(r.suggested_rate);
        const change = sugg - curr;
        const changePct = curr > 0 ? (change / curr) * 100 : 0;
        return {
          id: r.id,
          hotelId: r.hotel_id,
          roomTypeId: r.room_type_id,
          stayDate: r.stay_date,
          currentRate: curr,
          suggestedRate: sugg,
          change: Number(change.toFixed(2)),
          changePct: Number(changePct.toFixed(1)),
          violationType: r.threshold_violation_type ?? "",
          violationSeverity: r.violation_severity ?? "medium",
          status: r.status,
          createdAt: r.created_at,
        };
      });
    },
    60_000 // 1-minute cache
  );
}

/* ============================================================
 * Insights
 * ============================================================ */

export interface InsightRow {
  id: string;
  hotelId: string;
  insightType: string;
  title: string;
  description: string;
  dateStart: string | null;
  dateEnd: string | null;
  confidenceScore: number | null;
  actionTaken: boolean;
  createdAt: string;
}

export async function getInsights(hotelId: string): Promise<InsightRow[]> {
  return cached(
    "insights",
    { hotelId },
    async () => {
      const rows = await sql<{
        id: string;
        hotel_id: string;
        insight_type: string | null;
        title: string | null;
        description: string | null;
        date_start: string | null;
        date_end: string | null;
        confidence_score: string | null;
        action_taken: boolean | null;
        created_at: string;
      }>`
        SELECT
          i.id::text,
          i.hotel_id::text,
          i.insight_type,
          i.title,
          i.description,
          i.date_start::text,
          i.date_end::text,
          i.confidence_score::text,
          i.action_taken,
          i.created_at::text
        FROM insights i
        WHERE i.hotel_id = (
          SELECT id FROM hotels WHERE hotel_id = ${hotelId} AND deleted_at IS NULL LIMIT 1
        )
          AND i.created_at >= NOW() - INTERVAL '30 days'
          AND (i.action_taken IS NULL OR i.action_taken = false)
        ORDER BY i.created_at DESC
        LIMIT 30
      `;

      return rows.map((r) => ({
        id: r.id,
        hotelId: r.hotel_id,
        insightType: r.insight_type ?? "info",
        title: r.title ?? "",
        description: r.description ?? "",
        dateStart: r.date_start,
        dateEnd: r.date_end,
        confidenceScore: r.confidence_score != null ? Number(r.confidence_score) : null,
        actionTaken: r.action_taken ?? false,
        createdAt: r.created_at,
      }));
    },
    300_000 // 5-minute cache
  );
}
