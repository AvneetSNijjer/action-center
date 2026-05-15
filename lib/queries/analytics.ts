/**
 * Analytics page queries — all live from daily_inventory + suggested_prices.
 *
 * What's available in the DB:
 *   ✅ KPI trend         — daily_inventory (RevPAR / ADR / Occ per week)
 *   ✅ Booking pace      — daily_inventory.actual_occupancy vs 4-wk DOW rolling avg
 *                          NOTE: actual_pickup_last_day = 0 in all rows (PMS not sending);
 *                          using occupancy pace as documented fallback.
 *   ✅ Room type mix     — daily_inventory.room_type_code breakdown (channel/segment proxy)
 *   ✅ Pricing audit     — suggested_prices where approved_at IS NOT NULL
 *   ❌ True channel mix  — no booking_source column in DB
 *   ❌ True segment mix  — no rate_plan_code → segment mapping in DB
 */

import { sql, cached } from "@/lib/db";

/* ── KPI Trend ─────────────────────────────────────────────────────────── */

export interface KpiTrendPoint {
  label:        string;   // "Mar 3", "Mar 10" …
  weekStart:    string;   // ISO date
  revpar:       number;
  adr:          number;
  occupancy:    number;   // %
  revenue:      number;
  nights:       number;   // nights with data in the week
}

export async function getKpiTrend(
  hotelId: string,
  days: 30 | 90 | 365 = 90
): Promise<KpiTrendPoint[]> {
  return cached(
    "kpiTrend",
    { hotelId, days },
    async () => {
      const rows = await sql<{
        week_start: string;
        revpar:     string | null;
        adr:        string | null;
        occupancy:  string | null;
        revenue:    string | null;
        nights:     string;
      }>`
        WITH sp_latest AS (
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
            di.actual_occupancy                                              AS sold,
            (di.available_count + di.out_of_service_count + di.actual_occupancy) AS capacity,
            di.actual_occupancy * COALESCE(sp.price, di.current_price, 0)   AS revenue
          FROM daily_inventory di
          LEFT JOIN sp_latest sp
            ON sp.hotel_id = di.hotel_id
           AND sp.date = di.inventory_date
           AND sp.room_type_code = di.room_type_code
          WHERE di.hotel_id = ${hotelId}
            AND di.inventory_date >= CURRENT_DATE - ${days}::int
            AND di.inventory_date <  CURRENT_DATE
            AND di.actual_occupancy > 0
        )
        SELECT
          date_trunc('week', inventory_date)::date                         AS week_start,
          SUM(revenue) / NULLIF(SUM(capacity), 0)                         AS revpar,
          CASE WHEN SUM(sold) > 0 THEN SUM(revenue) / SUM(sold) END       AS adr,
          SUM(sold)::float / NULLIF(SUM(capacity), 0) * 100               AS occupancy,
          SUM(revenue)                                                     AS revenue,
          COUNT(DISTINCT inventory_date)                                   AS nights
        FROM di_priced
        GROUP BY week_start
        ORDER BY week_start
      `;

      return rows.map((r) => {
        // week_start comes back as a full ISO timestamp from date_trunc — parse directly
        const dt = new Date(r.week_start);
        return {
          label:     dt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
          weekStart: dt.toISOString().slice(0, 10),
          revpar:    Math.round(parseFloat(r.revpar    ?? "0")),
          adr:       Math.round(parseFloat(r.adr       ?? "0")),
          occupancy: parseFloat(parseFloat(r.occupancy ?? "0").toFixed(1)),
          revenue:   Math.round(parseFloat(r.revenue   ?? "0")),
          nights:    parseInt(r.nights, 10),
        };
      });
    },
    300_000
  );
}

/* ── Booking Pace (Occupancy Pace fallback) ────────────────────────────── */
//
// NOTE: actual_pickup_last_day = 0 for all hotels — the PMS feed is not
// sending daily pickup increments yet. We fall back to comparing each day's
// actual occupancy against the 4-week same-DOW rolling average occupancy.
// This answers "are we landing where we expected?" using realised occupancy
// rather than just last-day pickup.

export interface BookingPaceRow {
  stayDate:       string;   // "Apr 19"
  stayDateIso:    string;
  dow:            string;   // "Fri"
  actualOcc:      number;   // rooms sold that night
  expectedOcc:    number;   // 4-wk same-DOW rolling avg sold rooms
  actualOccPct:   number;   // occupancy % that night
  expectedOccPct: number;   // expected occupancy %
  variancePct:    number;   // actual vs expected %
  fallbackMethod: "occupancy_pace";
}

export async function getBookingPace(hotelId: string): Promise<BookingPaceRow[]> {
  return cached(
    "bookingPace",
    { hotelId },
    async () => {
      const rows = await sql<{
        inventory_date: string;
        actual_sold:    string | null;
        capacity:       string | null;
        actual_occ_pct: string | null;
        avg_sold:       string | null;
        avg_occ_pct:    string | null;
      }>`
        WITH daily AS (
          SELECT
            inventory_date,
            SUM(actual_occupancy)                                                             AS actual_sold,
            SUM(available_count + out_of_service_count + actual_occupancy)                   AS capacity,
            ROUND(
              SUM(actual_occupancy)::numeric
              / NULLIF(SUM(available_count + out_of_service_count + actual_occupancy), 0) * 100,
              1
            )                                                                                AS actual_occ_pct
          FROM daily_inventory
          WHERE hotel_id = ${hotelId}
            AND actual_occupancy >= 0
            AND inventory_date >= CURRENT_DATE - 60
            AND inventory_date <  CURRENT_DATE
          GROUP BY inventory_date
        ),
        with_rolling AS (
          SELECT
            inventory_date,
            actual_sold,
            capacity,
            actual_occ_pct,
            -- 4-week same-DOW rolling average (look back only, exclude current row)
            AVG(actual_sold) OVER (
              PARTITION BY EXTRACT(DOW FROM inventory_date)
              ORDER BY inventory_date
              ROWS BETWEEN 4 PRECEDING AND 1 PRECEDING
            )                                                                                AS avg_sold,
            AVG(actual_occ_pct) OVER (
              PARTITION BY EXTRACT(DOW FROM inventory_date)
              ORDER BY inventory_date
              ROWS BETWEEN 4 PRECEDING AND 1 PRECEDING
            )                                                                                AS avg_occ_pct
          FROM daily
        )
        SELECT *
        FROM with_rolling
        WHERE inventory_date >= CURRENT_DATE - 28
          AND avg_sold IS NOT NULL
        ORDER BY inventory_date
        LIMIT 28
      `;

      return rows.map((r) => {
        // inventory_date from pg comes as a full Date object or ISO string
        const dt           = new Date(r.inventory_date);
        const actual       = Math.round(parseFloat(r.actual_sold    ?? "0"));
        const expected     = Math.round(parseFloat(r.avg_sold       ?? String(actual)));
        const actualPct    = parseFloat(parseFloat(r.actual_occ_pct ?? "0").toFixed(1));
        const expectedPct  = parseFloat(parseFloat(r.avg_occ_pct    ?? String(actualPct)).toFixed(1));
        const variance     = expectedPct > 0
          ? parseFloat((((actualPct - expectedPct) / expectedPct) * 100).toFixed(1))
          : 0;

        return {
          stayDate:       dt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
          stayDateIso:    dt.toISOString().slice(0, 10),
          dow:            dt.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
          actualOcc:      actual,
          expectedOcc:    expected,
          actualOccPct:   actualPct,
          expectedOccPct: expectedPct,
          variancePct:    variance,
          fallbackMethod: "occupancy_pace" as const,
        };
      });
    },
    180_000
  );
}

/* ── Room Type Mix ─────────────────────────────────────────────────────── */
//
// Used as a proxy for channel mix and segment mix since the PMS feed does
// not include booking_source or rate_plan_code → segment mapping.

export interface RoomTypeMixRow {
  roomTypeCode:  string;
  category:      string;   // grouped label: "Standard", "Superior", etc.
  soldNights:    number;
  capacity:      number;
  occupancyPct:  number;
  sharePct:      number;   // % of total sold nights
}

/** Map raw room type codes to display categories. */
function categoriseRoomType(code: string): string {
  const c = code.toUpperCase();
  if (c.startsWith("SC") || c.startsWith("SS")) return "Standard";
  if (c.startsWith("CC")) return "Club";
  if (c.startsWith("WA") || c.startsWith("WS") || c.startsWith("WR")) return "Superior";
  if (c.startsWith("PW") || c.startsWith("SG") || c.startsWith("RBL") || c.startsWith("RBR")) return "Premium";
  return "Other";
}

export async function getRoomTypeMix(
  hotelId: string,
  days: 30 | 90 | 365 = 90
): Promise<RoomTypeMixRow[]> {
  return cached(
    "roomTypeMix",
    { hotelId, days },
    async () => {
      const rows = await sql<{
        room_type_code: string;
        sold_nights:    string;
        capacity:       string;
        occupancy_pct:  string;
      }>`
        SELECT
          room_type_code,
          SUM(actual_occupancy)                                                              AS sold_nights,
          SUM(available_count + out_of_service_count + actual_occupancy)                    AS capacity,
          ROUND(
            SUM(actual_occupancy)::numeric
            / NULLIF(SUM(available_count + out_of_service_count + actual_occupancy), 0) * 100,
            1
          )                                                                                 AS occupancy_pct
        FROM daily_inventory
        WHERE hotel_id = ${hotelId}
          AND actual_occupancy > 0
          AND inventory_date >= CURRENT_DATE - ${days}::int
          AND inventory_date <  CURRENT_DATE
        GROUP BY room_type_code
        ORDER BY sold_nights DESC
      `;

      const totalSold = rows.reduce((s, r) => s + parseInt(r.sold_nights, 10), 0);
      return rows.map((r) => ({
        roomTypeCode:  r.room_type_code,
        category:      categoriseRoomType(r.room_type_code),
        soldNights:    parseInt(r.sold_nights, 10),
        capacity:      parseInt(r.capacity, 10),
        occupancyPct:  parseFloat(r.occupancy_pct),
        sharePct:      totalSold > 0
          ? parseFloat(((parseInt(r.sold_nights, 10) / totalSold) * 100).toFixed(1))
          : 0,
      }));
    },
    300_000
  );
}

/* ── Pricing Audit Trail ───────────────────────────────────────────────── */

export interface PricingDecisionRow {
  id:          string;
  decidedAt:   string;   // human-readable
  roomType:    string;
  stayDate:    string;   // human-readable
  oldPrice:    number;
  newPrice:    number;
  changePct:   number;
  approvedBy:  string;
  source:      "Auto" | "Manual" | "Override";
  reason:      string;
}

export async function getPricingAuditTrail(
  hotelId: string,
  limit = 50
): Promise<PricingDecisionRow[]> {
  return cached(
    "pricingAudit",
    { hotelId, limit },
    async () => {
      const rows = await sql<{
        id:                  string;
        date:                string;
        room_type_code:      string;
        base_rate:           string | null;
        suggested_price:     string | null;
        approved_by:         string | null;
        approved_at:         string | null;
        created_at:          string;
        auto_publish_status: string | null;
        business_explanation: string | null;
        push_summary:        string | null;
        status:              string | null;
      }>`
        SELECT
          id::text,
          date,
          room_type_code,
          base_rate,
          COALESCE(suggested_price, base_rate) AS suggested_price,
          approved_by::text,
          approved_at,
          created_at,
          auto_publish_status,
          business_explanation,
          push_summary,
          status
        FROM suggested_prices
        WHERE hotel_id = ${hotelId}
          AND (
            approved_at IS NOT NULL
            OR auto_publish_status = 'published'
            OR status IN ('approved', 'published')
          )
          AND date >= CURRENT_DATE - 90
        ORDER BY COALESCE(approved_at, created_at) DESC
        LIMIT ${limit}
      `;

      return rows.map((r, i) => {
        const base      = parseFloat(r.base_rate       ?? "0");
        const suggested = parseFloat(r.suggested_price ?? String(base));
        const changePct = base > 0 ? ((suggested - base) / base) * 100 : 0;

        const isAuto    = r.auto_publish_status === "published" && !r.approved_by;
        const isOverride = r.approved_by && !r.auto_publish_status;
        const source: "Auto" | "Manual" | "Override" =
          isAuto ? "Auto" : isOverride ? "Override" : "Manual";

        const decidedRaw = r.approved_at ?? r.created_at;
        const decidedDt  = new Date(decidedRaw);
        const decidedAt  = decidedDt.toLocaleDateString("en-US", {
          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
        });

        const stayDt   = new Date(r.date);
        const stayDate = stayDt.toLocaleDateString("en-US", {
          month: "short", day: "numeric", weekday: "short", timeZone: "UTC",
        });

        const reason = r.business_explanation ?? r.push_summary ?? "Auto-publish threshold";

        return {
          id:         `${r.id}-${i}`,
          decidedAt,
          roomType:   r.room_type_code ?? "—",
          stayDate,
          oldPrice:   Math.round(base),
          newPrice:   Math.round(suggested),
          changePct:  parseFloat(changePct.toFixed(1)),
          approvedBy: r.approved_by ?? "Auto-publish",
          source,
          reason:     reason.length > 80 ? reason.slice(0, 80) + "…" : reason,
        };
      });
    },
    120_000
  );
}

/* ── Analytics Header KPIs ─────────────────────────────────────────────── */

export interface AnalyticsHeadlineData {
  hotelName:   string;
  rangeLabel:  string;
  current: {
    revpar:    number;
    adr:       number;
    occupancy: number;
    revenue:   number;
  };
  comp: {
    revpar:    number | null;
    adr:       number | null;
    occupancy: number | null;
    revenue:   number | null;
  };
  compLabel: string;
}

export async function getAnalyticsHeadline(
  hotelId: string,
  hotelName: string,
  days: 30 | 90 | 365 = 90
): Promise<AnalyticsHeadlineData> {
  return cached(
    "analyticsHeadline",
    { hotelId, days },
    async () => {
      const rows = await sql<{
        curr_revpar:    string | null;
        curr_adr:       string | null;
        curr_occ:       string | null;
        curr_revenue:   string | null;
        prev_revpar:    string | null;
        prev_adr:       string | null;
        prev_occ:       string | null;
        prev_revenue:   string | null;
        prev_has_data:  string;
      }>`
        WITH sp_latest AS (
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
            di.actual_occupancy                                              AS sold,
            (di.available_count + di.out_of_service_count + di.actual_occupancy) AS capacity,
            di.actual_occupancy * COALESCE(sp.price, di.current_price, 0)   AS revenue
          FROM daily_inventory di
          LEFT JOIN sp_latest sp
            ON sp.hotel_id = di.hotel_id
           AND sp.date = di.inventory_date
           AND sp.room_type_code = di.room_type_code
          WHERE di.hotel_id = ${hotelId}
            AND di.actual_occupancy > 0
        ),
        curr AS (
          SELECT
            SUM(revenue) / NULLIF(SUM(capacity), 0)                        AS revpar,
            CASE WHEN SUM(sold) > 0 THEN SUM(revenue) / SUM(sold) END      AS adr,
            SUM(sold)::float / NULLIF(SUM(capacity), 0) * 100              AS occ,
            SUM(revenue)                                                    AS revenue
          FROM di_priced
          WHERE inventory_date >= CURRENT_DATE - ${days}::int
            AND inventory_date <  CURRENT_DATE
        ),
        prev AS (
          SELECT
            SUM(revenue) / NULLIF(SUM(capacity), 0)                        AS revpar,
            CASE WHEN SUM(sold) > 0 THEN SUM(revenue) / SUM(sold) END      AS adr,
            SUM(sold)::float / NULLIF(SUM(capacity), 0) * 100              AS occ,
            SUM(revenue)                                                    AS revenue,
            COALESCE(SUM(sold), 0)                                         AS total_sold
          FROM di_priced
          WHERE inventory_date >= CURRENT_DATE - (${days}::int * 2)
            AND inventory_date <  CURRENT_DATE - ${days}::int
        )
        SELECT
          curr.revpar  AS curr_revpar,
          curr.adr     AS curr_adr,
          curr.occ     AS curr_occ,
          curr.revenue AS curr_revenue,
          prev.revpar  AS prev_revpar,
          prev.adr     AS prev_adr,
          prev.occ     AS prev_occ,
          prev.revenue AS prev_revenue,
          CASE WHEN prev.total_sold > 0 THEN '1' ELSE '0' END AS prev_has_data
        FROM curr, prev
      `;

      const r = rows[0] ?? {};
      const fromDate = new Date(Date.now() - days * 86400000);
      const rangeLabel = `${fromDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} (last ${days} days)`;

      const hasPrev = r.prev_has_data === "1";

      return {
        hotelName,
        rangeLabel,
        current: {
          revpar:    Math.round(parseFloat(r.curr_revpar  ?? "0")),
          adr:       Math.round(parseFloat(r.curr_adr     ?? "0")),
          occupancy: parseFloat(parseFloat(r.curr_occ     ?? "0").toFixed(1)),
          revenue:   Math.round(parseFloat(r.curr_revenue ?? "0")),
        },
        comp: {
          revpar:    hasPrev ? Math.round(parseFloat(r.prev_revpar  ?? "0")) : null,
          adr:       hasPrev ? Math.round(parseFloat(r.prev_adr     ?? "0")) : null,
          occupancy: hasPrev ? parseFloat(parseFloat(r.prev_occ     ?? "0").toFixed(1)) : null,
          revenue:   hasPrev ? Math.round(parseFloat(r.prev_revenue ?? "0")) : null,
        },
        compLabel: hasPrev ? `Prior ${days}d` : "No prior period data",
      };
    },
    300_000
  );
}
