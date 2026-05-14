/**
 * Action Center queries — morning briefing, pending approvals, insights.
 *
 * Key schema facts:
 *   - daily_inventory uses `inventory_date` (not `date`)
 *   - Real occupancy only from ~Dec 2025 onward (~95% of rows are 0-occupancy future inventory)
 *   - STLY is NEVER available (dataset started ~May 2025, real data from Dec 2025)
 *   - MTD must cap at < CURRENT_DATE (future rows exist in daily_inventory)
 *
 * Comparison baseline — tiered fallback (pick first with data):
 *   Tier 1: STLY exact -364 days (SUM(sold) > 0) — currently always unavailable
 *   Tier 2: 90d same day-of-week avg (12 weeks, only sold>0 nights) — label "90d same-day avg"
 *   Tier 3: 30d rolling avg (any day, sold>0) — label "30d avg"
 *   Tier 4: No comparison shown (hotel too new / no history at all)
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
      const rows = await sql<{
        yd_occ:       string | null;
        yd_adr:       string | null;
        yd_revpar:    string | null;
        yd_revenue:   string | null;
        yd_has_data:  string;  // "1" if yesterday had actual bookings
        // Tier 1: STLY (exact -364 days)
        stly_occ:     string | null;
        stly_adr:     string | null;
        stly_revpar:  string | null;
        stly_revenue: string | null;
        stly_has_data:string;  // "1" if STLY had real bookings
        // Tier 2: 90-day same-DOW average (12 weeks, sold>0 nights only)
        avg90_occ:    string | null;
        avg90_adr:    string | null;
        avg90_revpar: string | null;
        avg90_revenue:string | null;
        avg90_nights: string;  // count of qualifying nights
        // Tier 3: 30-day rolling average
        avg30_occ:    string | null;
        avg30_adr:    string | null;
        avg30_revpar: string | null;
        avg30_revenue:string | null;
        avg30_nights: string;
        // MTD
        mtd_occ:      string | null;
        mtd_adr:      string | null;
        mtd_revpar:   string | null;
        mtd_revenue:  string | null;
        mtd_days:     string;
        // Tonight on-the-books (CURRENT_DATE)
        tn_occ:       string | null;
        tn_adr:       string | null;
        tn_revenue:   string | null;
        tn_sold:      string | null;
        tn_total:     string | null;
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
            di.actual_occupancy * COALESCE(sp.price, di.current_price, 0) AS revenue
          FROM daily_inventory di
          LEFT JOIN sp_latest sp
            ON sp.hotel_id = di.hotel_id
           AND sp.date = di.inventory_date
           AND sp.room_type_code = di.room_type_code
          WHERE di.hotel_id = ${hotelId}
        ),
        /* ── YESTERDAY ── */
        yd AS (
          SELECT
            SUM(sold)::float / NULLIF(SUM(capacity), 0) * 100         AS occ,
            CASE WHEN SUM(sold) > 0 THEN SUM(revenue)/SUM(sold) END   AS adr,
            SUM(revenue) / NULLIF(SUM(capacity), 0)                   AS revpar,
            SUM(revenue)                                               AS revenue,
            COALESCE(SUM(sold), 0)                                     AS total_sold
          FROM di_priced
          WHERE inventory_date = CURRENT_DATE - 1
        ),
        /* ── TIER 1: STLY (exact -364 days) ── */
        stly AS (
          SELECT
            SUM(sold)::float / NULLIF(SUM(capacity), 0) * 100         AS occ,
            CASE WHEN SUM(sold) > 0 THEN SUM(revenue)/SUM(sold) END   AS adr,
            SUM(revenue) / NULLIF(SUM(capacity), 0)                   AS revpar,
            SUM(revenue)                                               AS revenue,
            COALESCE(SUM(sold), 0)                                     AS total_sold
          FROM di_priced
          WHERE inventory_date = (CURRENT_DATE - 1) - 364
        ),
        /* ── TIER 2: 90d same day-of-week avg (only nights with real bookings) ── */
        avg90dow AS (
          SELECT
            SUM(sold)::float / NULLIF(SUM(capacity), 0) * 100         AS occ,
            CASE WHEN SUM(sold) > 0 THEN SUM(revenue)/SUM(sold) END   AS adr,
            SUM(revenue) / NULLIF(SUM(capacity), 0)                   AS revpar,
            SUM(revenue) / NULLIF(COUNT(DISTINCT inventory_date), 0)  AS revenue,
            COUNT(DISTINCT inventory_date)                             AS nights
          FROM di_priced
          WHERE inventory_date >= CURRENT_DATE - 91
            AND inventory_date < CURRENT_DATE - 1
            AND EXTRACT(DOW FROM inventory_date)
                = EXTRACT(DOW FROM CURRENT_DATE - 1)
            AND sold > 0
        ),
        /* ── TIER 3: 30d rolling avg (any day, sold>0) ── */
        avg30 AS (
          SELECT
            SUM(sold)::float / NULLIF(SUM(capacity), 0) * 100         AS occ,
            CASE WHEN SUM(sold) > 0 THEN SUM(revenue)/SUM(sold) END   AS adr,
            SUM(revenue) / NULLIF(SUM(capacity), 0)                   AS revpar,
            SUM(revenue) / NULLIF(COUNT(DISTINCT inventory_date), 0)  AS revenue,
            COUNT(DISTINCT inventory_date)                             AS nights
          FROM di_priced
          WHERE inventory_date >= CURRENT_DATE - 31
            AND inventory_date < CURRENT_DATE - 1
            AND sold > 0
        ),
        /* ── MTD (cap at yesterday to exclude today's partial data) ── */
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
        /* ── TONIGHT ON-THE-BOOKS ── */
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
          yd.occ::text          AS yd_occ,
          yd.adr::text          AS yd_adr,
          yd.revpar::text       AS yd_revpar,
          yd.revenue::text      AS yd_revenue,
          CASE WHEN yd.total_sold > 0 THEN '1' ELSE '0' END  AS yd_has_data,
          stly.occ::text        AS stly_occ,
          stly.adr::text        AS stly_adr,
          stly.revpar::text     AS stly_revpar,
          stly.revenue::text    AS stly_revenue,
          CASE WHEN stly.total_sold > 0 THEN '1' ELSE '0' END AS stly_has_data,
          avg90dow.occ::text    AS avg90_occ,
          avg90dow.adr::text    AS avg90_adr,
          avg90dow.revpar::text AS avg90_revpar,
          avg90dow.revenue::text AS avg90_revenue,
          COALESCE(avg90dow.nights, 0)::text AS avg90_nights,
          avg30.occ::text       AS avg30_occ,
          avg30.adr::text       AS avg30_adr,
          avg30.revpar::text    AS avg30_revpar,
          avg30.revenue::text   AS avg30_revenue,
          COALESCE(avg30.nights, 0)::text AS avg30_nights,
          mtd.occ::text         AS mtd_occ,
          mtd.adr::text         AS mtd_adr,
          mtd.revpar::text      AS mtd_revpar,
          mtd.revenue::text     AS mtd_revenue,
          mtd.days::text        AS mtd_days,
          tn.occ::text          AS tn_occ,
          tn.adr::text          AS tn_adr,
          tn.revenue::text      AS tn_revenue,
          tn.sold::text         AS tn_sold,
          tn.total::text        AS tn_total
        FROM yd, stly, avg90dow, avg30, mtd, tn
      `;

      const r = rows[0] ?? {};

      // ── Tiered comparison label + values ──
      // Tier 1: STLY
      // Tier 2: 90d same-DOW (≥4 qualifying nights required)
      // Tier 3: 30d rolling avg (≥7 qualifying nights)
      // Tier 4: null (too new, no comparison)
      const useStly  = r.stly_has_data === "1";
      const use90d   = !useStly && Number(r.avg90_nights ?? "0") >= 4;
      const use30d   = !useStly && !use90d && Number(r.avg30_nights ?? "0") >= 7;

      const compLabel = useStly ? "STLY"
                      : use90d  ? "90d same-day avg"
                      : use30d  ? "30d avg"
                      : "since launch";

      const compOcc     = useStly ? r.stly_occ     : use90d ? r.avg90_occ     : use30d ? r.avg30_occ     : null;
      const compAdr     = useStly ? r.stly_adr     : use90d ? r.avg90_adr     : use30d ? r.avg30_adr     : null;
      const compRevpar  = useStly ? r.stly_revpar  : use90d ? r.avg90_revpar  : use30d ? r.avg30_revpar  : null;
      const compRevenue = useStly ? r.stly_revenue : use90d ? r.avg90_revenue : use30d ? r.avg30_revenue : null;

      // ── Date metadata ──
      const now = new Date();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const daysElapsed = Math.max(1, parseInt(r.mtd_days ?? "1", 10));

      const mtdRevpar  = r.mtd_revpar  != null ? Number(r.mtd_revpar)  : 0;
      const mtdOcc     = r.mtd_occ     != null ? Number(r.mtd_occ)     : 0;
      const mtdAdr     = r.mtd_adr     != null ? Number(r.mtd_adr)     : 0;
      const mtdRevenue = r.mtd_revenue != null ? Number(r.mtd_revenue) : 0;

      // RevPAR and Occupancy are already per-night averages — projecting them forward
      // means "if the current daily rate continues, the EOM average will be the same."
      // Only Revenue (a cumulative total) scales linearly with more nights.
      const dailyRevenue = daysElapsed > 0 ? mtdRevenue / daysElapsed : 0;

      const dateLabel = now.toLocaleDateString("en-US", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
      });

      const pickupRows = await sql<{ cnt: string }>`
        SELECT COUNT(*) AS cnt
        FROM auto_publishing_rate_reviews
        WHERE hotel_id = ${hotelId}
          AND created_at >= CURRENT_DATE - INTERVAL '7 days'
      `;

      return {
        hotelId,
        date: dateLabel,
        compLabel,
        yesterday: {
          occupancy: { value: Number(Number(r.yd_occ     ?? 0).toFixed(1)), comp: compOcc     != null ? Number(Number(compOcc).toFixed(1))     : null },
          adr:       { value: Number(Number(r.yd_adr     ?? 0).toFixed(2)), comp: compAdr     != null ? Number(Number(compAdr).toFixed(2))     : null },
          revpar:    { value: Number(Number(r.yd_revpar  ?? 0).toFixed(2)), comp: compRevpar  != null ? Number(Number(compRevpar).toFixed(2))  : null },
          revenue:   { value: Number(Number(r.yd_revenue ?? 0).toFixed(2)), comp: compRevenue != null ? Number(Number(compRevenue).toFixed(2)) : null },
        },
        mtd: {
          revpar:     Number(mtdRevpar.toFixed(2)),
          occupancy:  Number(mtdOcc.toFixed(1)),
          adr:        Number(mtdAdr.toFixed(2)),
          revenue:    Number(mtdRevenue.toFixed(2)),
          daysElapsed,
          daysInMonth,
          projectedRevpar:    Number(mtdRevpar.toFixed(2)),    // EOM RevPAR = current nightly avg
          projectedOccupancy: Number(mtdOcc.toFixed(1)),       // EOM Occ % = current nightly avg
          projectedRevenue:   Number((dailyRevenue * daysInMonth).toFixed(2)), // daily revenue × days
        },
        tonight: {
          occupancy:  Number(Number(r.tn_occ     ?? 0).toFixed(1)),
          adr:        Number(Number(r.tn_adr     ?? 0).toFixed(2)),
          revenue:    Number(Number(r.tn_revenue ?? 0).toFixed(2)),
          roomsSold:  Number(r.tn_sold  ?? 0),
          totalRooms: Number(r.tn_total ?? 0),
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
      projectedRevpar:  mtdRevpar     != null ? Number(mtdRevpar.toFixed(2))                             : null, // RevPAR is a nightly avg, EOM = same
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
