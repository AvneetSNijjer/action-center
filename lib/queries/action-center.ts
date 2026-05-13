/**
 * Action Center queries — morning briefing, pending approvals, insights.
 *
 * Key schema facts discovered via DB probe:
 *   - daily_inventory uses `inventory_date` (not `date`)
 *   - AI3786 data starts Sep 2025 — no same-date-last-year data exists
 *   - Comparison metric = 30-day rolling average (labeled "30d avg")
 *   - MTD must cap at < CURRENT_DATE (future rows exist in daily_inventory)
 */

import { sql, cached } from "@/lib/db";

/* ============================================================
 * Morning Briefing
 * ============================================================ */

export interface MorningBriefingData {
  hotelId: string;
  date: string;           // "Wednesday, May 13, 2026"
  compLabel: string;      // "30d avg" — what the comparison period is

  /** Yesterday's actuals vs 30-day rolling avg */
  yesterday: {
    occupancy: { value: number; comp: number | null };
    adr:       { value: number; comp: number | null };
    revpar:    { value: number; comp: number | null };
    revenue:   { value: number; comp: number | null };
  };

  /** Month-to-date (confirmed closed nights only: < today) */
  mtd: {
    revpar:     number;   // $ weighted avg RevPAR
    occupancy:  number;   // %
    adr:        number;   // $
    revenue:    number;   // $ total
    daysElapsed: number;
    daysInMonth: number;
    /** Extrapolated end-of-month at current pace */
    projectedRevpar:    number;
    projectedOccupancy: number;
    projectedRevenue:   number;
  };

  /** Tonight on-the-books (current_date row) */
  tonight: {
    occupancy:  number;   // %
    adr:        number;   // $
    revenue:    number;   // $
    roomsSold:  number;
    totalRooms: number;
  };

  /** New rate-review items in last 7 days */
  pickup7d: number;
}

export async function getMorningBriefing(hotelId: string): Promise<MorningBriefingData> {
  return cached(
    "morningBriefing",
    { hotelId },
    async () => {
      // Single query: yesterday + STLY + 30d avg + MTD + tonight in one round-trip
      const rows = await sql<{
        yd_occ:      string | null;
        yd_adr:      string | null;
        yd_revpar:   string | null;
        yd_revenue:  string | null;
        // Same time last year (exact date -365 days)
        stly_occ:    string | null;
        stly_adr:    string | null;
        stly_revpar: string | null;
        stly_revenue:string | null;
        stly_has_data: string;          // "1" if STLY had actual bookings, "0" if not
        // 30-day rolling avg — fallback when no STLY
        avg_occ:     string | null;
        avg_adr:     string | null;
        avg_revpar:  string | null;
        avg_revenue: string | null;
        // MTD (confirmed closed nights: 1st of month → yesterday)
        mtd_occ:     string | null;
        mtd_adr:     string | null;
        mtd_revpar:  string | null;
        mtd_revenue: string | null;
        mtd_days:    string;
        // Tonight on-the-books
        tn_occ:      string | null;
        tn_adr:      string | null;
        tn_revenue:  string | null;
        tn_sold:     string | null;
        tn_total:    string | null;
      }>`
        WITH
        sp_latest AS (
          SELECT DISTINCT ON (hotel_id, date, room_type_code)
            hotel_id, date, room_type_code,
            COALESCE(suggested_price, base_rate) AS price
          FROM suggested_prices
          WHERE hotel_id = ${hotelId}
          ORDER BY hotel_id, date, room_type_code, updated_at DESC
        ),
        di_priced AS (
          SELECT
            di.inventory_date,
            di.actual_occupancy                                          AS sold,
            (di.available_count + di.out_of_service_count
              + di.actual_occupancy)                                    AS capacity,
            di.actual_occupancy * COALESCE(sp.price, 0)                AS revenue
          FROM daily_inventory di
          LEFT JOIN sp_latest sp
            ON sp.hotel_id = di.hotel_id
           AND sp.date = di.inventory_date
           AND sp.room_type_code = di.room_type_code
          WHERE di.hotel_id = ${hotelId}
        ),
        yd AS (
          SELECT
            SUM(sold)::float / NULLIF(SUM(capacity), 0) * 100         AS occ,
            CASE WHEN SUM(sold) > 0 THEN SUM(revenue)/SUM(sold) END   AS adr,
            SUM(revenue) / NULLIF(SUM(capacity), 0)                   AS revpar,
            SUM(revenue)                                               AS revenue
          FROM di_priced
          WHERE inventory_date = CURRENT_DATE - INTERVAL '1 day'
        ),
        stly AS (
          -- exact same calendar date one year ago
          SELECT
            SUM(sold)::float / NULLIF(SUM(capacity), 0) * 100         AS occ,
            CASE WHEN SUM(sold) > 0 THEN SUM(revenue)/SUM(sold) END   AS adr,
            SUM(revenue) / NULLIF(SUM(capacity), 0)                   AS revpar,
            SUM(revenue)                                               AS revenue,
            -- Use SUM(sold) not COUNT(*) — inventory rows exist even on 0-occupancy dates
            COALESCE(SUM(sold), 0)                                     AS total_sold
          FROM di_priced
          WHERE inventory_date = (CURRENT_DATE - INTERVAL '1 day') - INTERVAL '1 year'
        ),
        avg30 AS (
          SELECT
            SUM(sold)::float / NULLIF(SUM(capacity), 0) * 100         AS occ,
            CASE WHEN SUM(sold) > 0 THEN SUM(revenue)/SUM(sold) END   AS adr,
            SUM(revenue) / NULLIF(SUM(capacity), 0)                   AS revpar,
            SUM(revenue) / NULLIF(COUNT(DISTINCT inventory_date), 0)  AS revenue
          FROM di_priced
          WHERE inventory_date >= CURRENT_DATE - INTERVAL '31 days'
            AND inventory_date <  CURRENT_DATE - INTERVAL '1 day'
        ),
        mtd AS (
          SELECT
            SUM(sold)::float / NULLIF(SUM(capacity), 0) * 100         AS occ,
            CASE WHEN SUM(sold) > 0 THEN SUM(revenue)/SUM(sold) END   AS adr,
            SUM(revenue) / NULLIF(SUM(capacity), 0)                   AS revpar,
            SUM(revenue)                                               AS revenue,
            COUNT(DISTINCT inventory_date)                             AS days
          FROM di_priced
          WHERE inventory_date >= date_trunc('month', CURRENT_DATE)
            AND inventory_date <  CURRENT_DATE
        ),
        tn AS (
          SELECT
            SUM(sold)::float / NULLIF(SUM(capacity), 0) * 100         AS occ,
            CASE WHEN SUM(sold) > 0 THEN SUM(revenue)/SUM(sold) END   AS adr,
            SUM(revenue)                                               AS revenue,
            SUM(sold)                                                  AS sold,
            SUM(capacity)                                              AS total
          FROM di_priced
          WHERE inventory_date = CURRENT_DATE
        )
        SELECT
          yd.occ::text         AS yd_occ,
          yd.adr::text         AS yd_adr,
          yd.revpar::text      AS yd_revpar,
          yd.revenue::text     AS yd_revenue,
          stly.occ::text       AS stly_occ,
          stly.adr::text       AS stly_adr,
          stly.revpar::text    AS stly_revpar,
          stly.revenue::text   AS stly_revenue,
          CASE WHEN stly.total_sold > 0 THEN '1' ELSE '0' END AS stly_has_data,
          avg30.occ::text      AS avg_occ,
          avg30.adr::text      AS avg_adr,
          avg30.revpar::text   AS avg_revpar,
          avg30.revenue::text  AS avg_revenue,
          mtd.occ::text        AS mtd_occ,
          mtd.adr::text        AS mtd_adr,
          mtd.revpar::text     AS mtd_revpar,
          mtd.revenue::text    AS mtd_revenue,
          mtd.days::text       AS mtd_days,
          tn.occ::text         AS tn_occ,
          tn.adr::text         AS tn_adr,
          tn.revenue::text     AS tn_revenue,
          tn.sold::text        AS tn_sold,
          tn.total::text       AS tn_total
        FROM yd, stly, avg30, mtd, tn
      `;

      const r = rows[0] ?? {};

      // Date metadata
      const now = new Date();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const daysElapsed = Math.max(1, parseInt(r.mtd_days ?? "1", 10));

      // MTD actuals
      const mtdRevpar  = r.mtd_revpar  != null ? Number(r.mtd_revpar)  : 0;
      const mtdOcc     = r.mtd_occ     != null ? Number(r.mtd_occ)     : 0;
      const mtdAdr     = r.mtd_adr     != null ? Number(r.mtd_adr)     : 0;
      const mtdRevenue = r.mtd_revenue != null ? Number(r.mtd_revenue) : 0;

      // Projected EOM = (daily avg) × days_in_month
      const dailyRevpar  = daysElapsed > 0 ? mtdRevpar  / daysElapsed : 0;
      const dailyOcc     = daysElapsed > 0 ? mtdOcc     / daysElapsed : 0;
      const dailyRevenue = daysElapsed > 0 ? mtdRevenue / daysElapsed : 0;

      const dateLabel = now.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      // Pickup: rate-review items created in the last 7 days
      const pickupRows = await sql<{ cnt: string }>`
        SELECT COUNT(*) AS cnt
        FROM auto_publishing_rate_reviews
        WHERE hotel_id = ${hotelId}
          AND created_at >= CURRENT_DATE - INTERVAL '7 days'
      `;

      // Prefer STLY when available; fall back to 30-day rolling avg
      const useStly = r.stly_has_data === "1";
      const compLabel = useStly ? "STLY" : "30d avg";
      const compOcc     = useStly ? r.stly_occ     : r.avg_occ;
      const compAdr     = useStly ? r.stly_adr     : r.avg_adr;
      const compRevpar  = useStly ? r.stly_revpar  : r.avg_revpar;
      const compRevenue = useStly ? r.stly_revenue : r.avg_revenue;

      return {
        hotelId,
        date: dateLabel,
        compLabel,

        yesterday: {
          occupancy: {
            value: r.yd_occ  != null ? Number(Number(r.yd_occ).toFixed(1))   : 0,
            comp:  compOcc   != null ? Number(Number(compOcc).toFixed(1))     : null,
          },
          adr: {
            value: r.yd_adr  != null ? Number(Number(r.yd_adr).toFixed(2))   : 0,
            comp:  compAdr   != null ? Number(Number(compAdr).toFixed(2))     : null,
          },
          revpar: {
            value: r.yd_revpar  != null ? Number(Number(r.yd_revpar).toFixed(2))  : 0,
            comp:  compRevpar   != null ? Number(Number(compRevpar).toFixed(2))    : null,
          },
          revenue: {
            value: r.yd_revenue  != null ? Number(Number(r.yd_revenue).toFixed(2))  : 0,
            comp:  compRevenue   != null ? Number(Number(compRevenue).toFixed(2))    : null,
          },
        },

        mtd: {
          revpar:     Number(mtdRevpar.toFixed(2)),
          occupancy:  Number(mtdOcc.toFixed(1)),
          adr:        Number(mtdAdr.toFixed(2)),
          revenue:    Number(mtdRevenue.toFixed(2)),
          daysElapsed,
          daysInMonth,
          projectedRevpar:    Number((dailyRevpar  * daysInMonth).toFixed(2)),
          projectedOccupancy: Number((dailyOcc     * daysInMonth).toFixed(1)),
          projectedRevenue:   Number((dailyRevenue * daysInMonth).toFixed(2)),
        },

        tonight: {
          occupancy:  r.tn_occ     != null ? Number(Number(r.tn_occ).toFixed(1))     : 0,
          adr:        r.tn_adr     != null ? Number(Number(r.tn_adr).toFixed(2))     : 0,
          revenue:    r.tn_revenue != null ? Number(Number(r.tn_revenue).toFixed(2)) : 0,
          roomsSold:  r.tn_sold    != null ? Number(r.tn_sold)  : 0,
          totalRooms: r.tn_total   != null ? Number(r.tn_total) : 0,
        },

        pickup7d: parseInt(pickupRows[0]?.cnt ?? "0", 10),
      };
    },
    300_000
  );
}

/* ============================================================
 * Pending Approvals
 * ============================================================ */

export interface ApprovalRow {
  id: string;
  hotelId: string;
  roomTypeId: string;
  stayDate: string;         // ISO yyyy-mm-dd
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
        ORDER BY violation_severity DESC, stay_date ASC
        LIMIT 100
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
    60_000
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
    300_000
  );
}

/* ============================================================
 * Publishing Health  (live counts from auto_publishing_rate_reviews)
 * ============================================================ */

export interface PublishingHealthData {
  published24h: number;   // approved in last 24 h
  pending: number;        // currently pending
  rejected24h: number;    // rejected in last 24 h
  successRate: number;    // % approved / (approved + rejected) last 24 h
}

export async function getPublishingHealth(hotelId: string): Promise<PublishingHealthData> {
  return cached(
    "publishingHealth",
    { hotelId },
    async () => {
      const rows = await sql<{
        published_24h: string;
        pending: string;
        rejected_24h: string;
      }>`
        SELECT
          COUNT(*) FILTER (
            WHERE status = 'approved'
              AND updated_at >= NOW() - INTERVAL '24 hours'
          )::text AS published_24h,
          COUNT(*) FILTER (WHERE status = 'pending')::text AS pending,
          COUNT(*) FILTER (
            WHERE status = 'rejected'
              AND updated_at >= NOW() - INTERVAL '24 hours'
          )::text AS rejected_24h
        FROM auto_publishing_rate_reviews
        WHERE hotel_id = ${hotelId}
      `;

      const r = rows[0] ?? {};
      const pub  = parseInt(r.published_24h ?? "0", 10);
      const rej  = parseInt(r.rejected_24h  ?? "0", 10);
      const pend = parseInt(r.pending       ?? "0", 10);
      const total = pub + rej;
      const successRate = total > 0 ? Math.round((pub / total) * 100) : 100;

      return { published24h: pub, pending: pend, rejected24h: rej, successRate };
    },
    60_000
  );
}

/* ============================================================
 * Verification Snapshot  (raw DB numbers for cross-checking the UI)
 * ============================================================ */

export interface VerificationSnapshot {
  asOf: string;             // server UTC timestamp when this ran
  hotelId: string;
  yesterday: {
    date: string;
    occ: number | null;     // %
    adr: number | null;     // $
    revpar: number | null;  // $
    revenue: number | null; // $
    roomsSold: number;
    totalRooms: number;
  };
  avg30: {
    occ: number | null;
    adr: number | null;
    revpar: number | null;
    revenuePerDay: number | null;
  };
  mtd: {
    fromDate: string;
    toDate: string;         // yesterday (last confirmed night)
    daysElapsed: number;
    occ: number | null;
    adr: number | null;
    revpar: number | null;
    revenue: number | null;
    projectedRevpar: number | null;
    projectedRevenue: number | null;
  };
  tonight: {
    date: string;
    roomsSold: number;
    totalRooms: number;
    occ: number | null;
    adr: number | null;
    revenue: number | null;
  };
  pendingApprovals: number;
  insights: number;
  pickup7d: number;
}

export async function getVerificationSnapshot(hotelId: string): Promise<VerificationSnapshot> {
  // NOT cached — always fresh so the verification page shows real-time DB state
  const rows = await sql<{
    as_of: string;
    yd_date: string;
    yd_occ: string | null;
    yd_adr: string | null;
    yd_revpar: string | null;
    yd_revenue: string | null;
    yd_sold: string;
    yd_total: string;
    avg_occ: string | null;
    avg_adr: string | null;
    avg_revpar: string | null;
    avg_rev_per_day: string | null;
    mtd_from: string;
    mtd_to: string;
    mtd_days: string;
    mtd_occ: string | null;
    mtd_adr: string | null;
    mtd_revpar: string | null;
    mtd_revenue: string | null;
    tn_date: string;
    tn_sold: string;
    tn_total: string;
    tn_occ: string | null;
    tn_adr: string | null;
    tn_revenue: string | null;
  }>`
    WITH
    sp_latest AS (
      SELECT DISTINCT ON (hotel_id, date, room_type_code)
        hotel_id, date, room_type_code,
        COALESCE(suggested_price, base_rate) AS price
      FROM suggested_prices
      WHERE hotel_id = ${hotelId}
      ORDER BY hotel_id, date, room_type_code, updated_at DESC
    ),
    di_priced AS (
      SELECT
        di.inventory_date,
        di.actual_occupancy                                          AS sold,
        (di.available_count + di.out_of_service_count
          + di.actual_occupancy)                                    AS capacity,
        di.actual_occupancy * COALESCE(sp.price, 0)                AS revenue
      FROM daily_inventory di
      LEFT JOIN sp_latest sp
        ON sp.hotel_id = di.hotel_id
       AND sp.date = di.inventory_date
       AND sp.room_type_code = di.room_type_code
      WHERE di.hotel_id = ${hotelId}
    ),
    yd AS (
      SELECT
        (CURRENT_DATE - INTERVAL '1 day')::text               AS yd_date,
        SUM(sold)::float / NULLIF(SUM(capacity), 0) * 100     AS occ,
        CASE WHEN SUM(sold) > 0
          THEN SUM(revenue) / SUM(sold) END                   AS adr,
        SUM(revenue) / NULLIF(SUM(capacity), 0)               AS revpar,
        SUM(revenue)                                          AS revenue,
        SUM(sold)                                             AS sold,
        SUM(capacity)                                         AS total
      FROM di_priced
      WHERE inventory_date = CURRENT_DATE - INTERVAL '1 day'
    ),
    avg30 AS (
      SELECT
        SUM(sold)::float / NULLIF(SUM(capacity), 0) * 100     AS occ,
        CASE WHEN SUM(sold) > 0
          THEN SUM(revenue) / SUM(sold) END                   AS adr,
        SUM(revenue) / NULLIF(SUM(capacity), 0)               AS revpar,
        SUM(revenue) / NULLIF(COUNT(DISTINCT inventory_date), 0) AS rev_per_day
      FROM di_priced
      WHERE inventory_date >= CURRENT_DATE - INTERVAL '31 days'
        AND inventory_date <  CURRENT_DATE - INTERVAL '1 day'
    ),
    mtd AS (
      SELECT
        date_trunc('month', CURRENT_DATE)::date::text         AS mtd_from,
        (CURRENT_DATE - INTERVAL '1 day')::date::text         AS mtd_to,
        COUNT(DISTINCT inventory_date)                        AS days,
        SUM(sold)::float / NULLIF(SUM(capacity), 0) * 100    AS occ,
        CASE WHEN SUM(sold) > 0
          THEN SUM(revenue) / SUM(sold) END                  AS adr,
        SUM(revenue) / NULLIF(SUM(capacity), 0)              AS revpar,
        SUM(revenue)                                         AS revenue
      FROM di_priced
      WHERE inventory_date >= date_trunc('month', CURRENT_DATE)
        AND inventory_date <  CURRENT_DATE
    ),
    tn AS (
      SELECT
        CURRENT_DATE::text                                     AS tn_date,
        SUM(sold)::float / NULLIF(SUM(capacity), 0) * 100    AS occ,
        CASE WHEN SUM(sold) > 0
          THEN SUM(revenue) / SUM(sold) END                  AS adr,
        SUM(revenue)                                         AS revenue,
        SUM(sold)                                            AS sold,
        SUM(capacity)                                        AS total
      FROM di_priced
      WHERE inventory_date = CURRENT_DATE
    )
    SELECT
      NOW()::text                       AS as_of,
      yd.yd_date,
      yd.occ::text                      AS yd_occ,
      yd.adr::text                      AS yd_adr,
      yd.revpar::text                   AS yd_revpar,
      yd.revenue::text                  AS yd_revenue,
      COALESCE(yd.sold, 0)::text        AS yd_sold,
      COALESCE(yd.total, 0)::text       AS yd_total,
      avg30.occ::text                   AS avg_occ,
      avg30.adr::text                   AS avg_adr,
      avg30.revpar::text                AS avg_revpar,
      avg30.rev_per_day::text           AS avg_rev_per_day,
      mtd.mtd_from,
      mtd.mtd_to,
      mtd.days::text                    AS mtd_days,
      mtd.occ::text                     AS mtd_occ,
      mtd.adr::text                     AS mtd_adr,
      mtd.revpar::text                  AS mtd_revpar,
      mtd.revenue::text                 AS mtd_revenue,
      tn.tn_date,
      COALESCE(tn.sold, 0)::text        AS tn_sold,
      COALESCE(tn.total, 0)::text       AS tn_total,
      tn.occ::text                      AS tn_occ,
      tn.adr::text                      AS tn_adr,
      tn.revenue::text                  AS tn_revenue
    FROM yd, avg30, mtd, tn
  `;

  const [pendingRes, insightsRes, pickupRes] = await Promise.all([
    sql<{ cnt: string }>`
      SELECT COUNT(*) AS cnt FROM auto_publishing_rate_reviews
      WHERE hotel_id = ${hotelId} AND status = 'pending'
    `,
    sql<{ cnt: string }>`
      SELECT COUNT(*) AS cnt FROM insights i
      WHERE i.hotel_id = (
        SELECT id FROM hotels WHERE hotel_id = ${hotelId} AND deleted_at IS NULL LIMIT 1
      )
        AND i.created_at >= NOW() - INTERVAL '30 days'
        AND (i.action_taken IS NULL OR i.action_taken = false)
    `,
    sql<{ cnt: string }>`
      SELECT COUNT(*) AS cnt FROM auto_publishing_rate_reviews
      WHERE hotel_id = ${hotelId}
        AND created_at >= CURRENT_DATE - INTERVAL '7 days'
    `,
  ]);

  const v = rows[0] ?? {};
  const mtdDays    = parseInt(v.mtd_days ?? "1", 10) || 1;
  const mtdRevpar  = v.mtd_revpar  != null ? Number(v.mtd_revpar)  : null;
  const mtdRevenue = v.mtd_revenue != null ? Number(v.mtd_revenue) : null;
  const daysInMonth = new Date(
    new Date().getFullYear(), new Date().getMonth() + 1, 0
  ).getDate();

  return {
    asOf: v.as_of ?? new Date().toISOString(),
    hotelId,
    yesterday: {
      date:     v.yd_date ?? "",
      occ:      v.yd_occ     != null ? Number(Number(v.yd_occ).toFixed(2))     : null,
      adr:      v.yd_adr     != null ? Number(Number(v.yd_adr).toFixed(2))     : null,
      revpar:   v.yd_revpar  != null ? Number(Number(v.yd_revpar).toFixed(2))  : null,
      revenue:  v.yd_revenue != null ? Number(Number(v.yd_revenue).toFixed(2)) : null,
      roomsSold:  parseInt(v.yd_sold  ?? "0", 10),
      totalRooms: parseInt(v.yd_total ?? "0", 10),
    },
    avg30: {
      occ:          v.avg_occ         != null ? Number(Number(v.avg_occ).toFixed(2))         : null,
      adr:          v.avg_adr         != null ? Number(Number(v.avg_adr).toFixed(2))         : null,
      revpar:       v.avg_revpar      != null ? Number(Number(v.avg_revpar).toFixed(2))      : null,
      revenuePerDay: v.avg_rev_per_day != null ? Number(Number(v.avg_rev_per_day).toFixed(2)) : null,
    },
    mtd: {
      fromDate:         v.mtd_from ?? "",
      toDate:           v.mtd_to   ?? "",
      daysElapsed:      mtdDays,
      occ:              v.mtd_occ     != null ? Number(Number(v.mtd_occ).toFixed(2))     : null,
      adr:              v.mtd_adr     != null ? Number(Number(v.mtd_adr).toFixed(2))     : null,
      revpar:           mtdRevpar     != null ? Number(mtdRevpar.toFixed(2))             : null,
      revenue:          mtdRevenue    != null ? Number(mtdRevenue.toFixed(2))            : null,
      projectedRevpar:  mtdRevpar     != null ? Number(((mtdRevpar  / mtdDays) * daysInMonth).toFixed(2)) : null,
      projectedRevenue: mtdRevenue    != null ? Number(((mtdRevenue / mtdDays) * daysInMonth).toFixed(2)) : null,
    },
    tonight: {
      date:       v.tn_date   ?? "",
      roomsSold:  parseInt(v.tn_sold  ?? "0", 10),
      totalRooms: parseInt(v.tn_total ?? "0", 10),
      occ:        v.tn_occ     != null ? Number(Number(v.tn_occ).toFixed(2))     : null,
      adr:        v.tn_adr     != null ? Number(Number(v.tn_adr).toFixed(2))     : null,
      revenue:    v.tn_revenue != null ? Number(Number(v.tn_revenue).toFixed(2)) : null,
    },
    pendingApprovals: parseInt(pendingRes[0]?.cnt  ?? "0", 10),
    insights:         parseInt(insightsRes[0]?.cnt ?? "0", 10),
    pickup7d:         parseInt(pickupRes[0]?.cnt   ?? "0", 10),
  };
}
