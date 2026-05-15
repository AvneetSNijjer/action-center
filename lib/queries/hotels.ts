/**
 * Hotel list + single-hotel queries.
 *
 * For the hotel selector: lists all hotels (superuser) or only the
 * hotels belonging to a specific user.
 *
 * KPIs are computed over the last 30 days using the validated formula:
 *   occupancy = actual_occupancy / (available_count + out_of_service_count + actual_occupancy)
 *   revenue   = actual_occupancy × COALESCE(suggested_price, base_rate)
 */

import { sql, cached } from "@/lib/db";
import { MERITON_KENT_HOTEL_ID } from "@/lib/insights-engine";
import { splitLocation } from "@/lib/utils";

/** Showcase fixture hotel — appears in admin view for demo presentations. */
const MERITON_KENT_FIXTURE: HotelRow = {
  id: MERITON_KENT_HOTEL_ID,
  name: "Meriton Kent Hotel ★ Demo",
  location: "London, UK",
  city: "London",
  state: "UK",
  occupancy: 73.4,
  adr: 312.5,
  revpar: 229.4,
  pendingApprovals: 5,
};

export interface HotelRow {
  id: string;          // hotel_id string, e.g. "AI3786"
  name: string;
  city: string;
  state: string;
  location: string;    // raw from DB
  // KPIs
  occupancy: number | null;   // %
  adr: number | null;         // $
  revpar: number | null;      // $
  pendingApprovals: number;
}

// Re-export from utils so server code can import from either place,
// while client components import directly from @/lib/utils (no pg dependency).
export { splitLocation } from "@/lib/utils";

type HotelDbRow = {
  hotel_id: string;
  name: string;
  location: string;
  occupancy: string | null;
  adr: string | null;
  revpar: string | null;
  pending_approvals: string;
};

function mapRow(r: HotelDbRow): HotelRow {
  const { city, state } = splitLocation(r.location);
  return {
    id: r.hotel_id,
    name: r.name,
    location: r.location,
    city,
    state,
    occupancy: r.occupancy != null ? Number(Number(r.occupancy).toFixed(1)) : null,
    adr: r.adr != null ? Number(Number(r.adr).toFixed(2)) : null,
    revpar: r.revpar != null ? Number(Number(r.revpar).toFixed(2)) : null,
    pendingApprovals: parseInt(r.pending_approvals ?? "0", 10) || 0,
  };
}

const ALL_HOTELS_QUERY = `
  WITH kpis AS (
    SELECT
      di.hotel_id,
      SUM(di.actual_occupancy)::float /
        NULLIF(SUM(di.available_count + di.out_of_service_count + di.actual_occupancy), 0) * 100
        AS occupancy,
      AVG(COALESCE(sp.suggested_price, sp.base_rate))
        AS adr,
      SUM(di.actual_occupancy * COALESCE(sp.suggested_price, sp.base_rate)) /
        NULLIF(SUM(di.available_count + di.out_of_service_count + di.actual_occupancy), 0)
        AS revpar
    FROM daily_inventory di
    LEFT JOIN suggested_prices sp
      ON sp.hotel_id = di.hotel_id
     AND sp.date = di.inventory_date
     AND sp.room_type_code = di.room_type_code
    WHERE di.inventory_date >= CURRENT_DATE - INTERVAL '30 days'
      AND di.inventory_date < CURRENT_DATE
    GROUP BY di.hotel_id
  ),
  pending AS (
    SELECT hotel_id, COUNT(*) AS cnt
    FROM auto_publishing_rate_reviews
    WHERE status = 'pending'
    GROUP BY hotel_id
  )
  SELECT
    h.hotel_id,
    h.name,
    COALESCE(h.location, '') AS location,
    k.occupancy,
    k.adr,
    k.revpar,
    COALESCE(p.cnt, 0) AS pending_approvals
  FROM hotels h
  LEFT JOIN kpis k ON k.hotel_id = h.hotel_id
  LEFT JOIN pending p ON p.hotel_id = h.hotel_id
  WHERE h.deleted_at IS NULL
  ORDER BY h.name
`;

const USER_HOTELS_QUERY = `
  WITH kpis AS (
    SELECT
      di.hotel_id,
      SUM(di.actual_occupancy)::float /
        NULLIF(SUM(di.available_count + di.out_of_service_count + di.actual_occupancy), 0) * 100
        AS occupancy,
      AVG(COALESCE(sp.suggested_price, sp.base_rate))
        AS adr,
      SUM(di.actual_occupancy * COALESCE(sp.suggested_price, sp.base_rate)) /
        NULLIF(SUM(di.available_count + di.out_of_service_count + di.actual_occupancy), 0)
        AS revpar
    FROM daily_inventory di
    LEFT JOIN suggested_prices sp
      ON sp.hotel_id = di.hotel_id
     AND sp.date = di.inventory_date
     AND sp.room_type_code = di.room_type_code
    WHERE di.inventory_date >= CURRENT_DATE - INTERVAL '30 days'
      AND di.inventory_date < CURRENT_DATE
    GROUP BY di.hotel_id
  ),
  pending AS (
    SELECT hotel_id, COUNT(*) AS cnt
    FROM auto_publishing_rate_reviews
    WHERE status = 'pending'
    GROUP BY hotel_id
  )
  SELECT
    h.hotel_id,
    h.name,
    COALESCE(h.location, '') AS location,
    k.occupancy,
    k.adr,
    k.revpar,
    COALESCE(p.cnt, 0) AS pending_approvals
  FROM hotels h
  JOIN user_hotels uh ON uh.hotel_id = h.hotel_id AND uh.user_id = $1
  LEFT JOIN kpis k ON k.hotel_id = h.hotel_id
  LEFT JOIN pending p ON p.hotel_id = h.hotel_id
  WHERE h.deleted_at IS NULL
  ORDER BY h.name
`;

/**
 * List hotels. If userId is provided (and not superuser), only return
 * hotels that user has access to via user_hotels.
 */
export async function listHotels(
  userId?: number,
  isSuperuser = false
): Promise<HotelRow[]> {
  return cached(
    "listHotels",
    { userId: userId ?? "all", isSuperuser },
    async () => {
      let rows: HotelDbRow[];
      if (!isSuperuser && userId != null) {
        rows = await sql<HotelDbRow>`
          WITH kpis AS (
            SELECT
              di.hotel_id,
              SUM(di.actual_occupancy)::float /
                NULLIF(SUM(di.available_count + di.out_of_service_count + di.actual_occupancy), 0) * 100
                AS occupancy,
              AVG(COALESCE(sp.suggested_price, sp.base_rate))
                AS adr,
              SUM(di.actual_occupancy * COALESCE(sp.suggested_price, sp.base_rate)) /
                NULLIF(SUM(di.available_count + di.out_of_service_count + di.actual_occupancy), 0)
                AS revpar
            FROM daily_inventory di
            LEFT JOIN suggested_prices sp
              ON sp.hotel_id = di.hotel_id
             AND sp.date = di.inventory_date
             AND sp.room_type_code = di.room_type_code
            WHERE di.inventory_date >= CURRENT_DATE - INTERVAL '30 days'
              AND di.inventory_date < CURRENT_DATE
            GROUP BY di.hotel_id
          ),
          pending AS (
            SELECT hotel_id, COUNT(*) AS cnt
            FROM auto_publishing_rate_reviews
            WHERE status = 'pending'
            GROUP BY hotel_id
          )
          SELECT
            h.hotel_id,
            h.name,
            COALESCE(h.location, '') AS location,
            k.occupancy,
            k.adr,
            k.revpar,
            COALESCE(p.cnt, 0) AS pending_approvals
          FROM hotels h
          JOIN user_hotels uh ON uh.hotel_id = h.hotel_id AND uh.user_id = ${userId}
          LEFT JOIN kpis k ON k.hotel_id = h.hotel_id
          LEFT JOIN pending p ON p.hotel_id = h.hotel_id
          WHERE h.deleted_at IS NULL
          ORDER BY h.name
        `;
      } else {
        rows = await sql<HotelDbRow>`
          WITH kpis AS (
            SELECT
              di.hotel_id,
              SUM(di.actual_occupancy)::float /
                NULLIF(SUM(di.available_count + di.out_of_service_count + di.actual_occupancy), 0) * 100
                AS occupancy,
              AVG(COALESCE(sp.suggested_price, sp.base_rate))
                AS adr,
              SUM(di.actual_occupancy * COALESCE(sp.suggested_price, sp.base_rate)) /
                NULLIF(SUM(di.available_count + di.out_of_service_count + di.actual_occupancy), 0)
                AS revpar
            FROM daily_inventory di
            LEFT JOIN suggested_prices sp
              ON sp.hotel_id = di.hotel_id
             AND sp.date = di.inventory_date
             AND sp.room_type_code = di.room_type_code
            WHERE di.inventory_date >= CURRENT_DATE - INTERVAL '30 days'
              AND di.inventory_date < CURRENT_DATE
            GROUP BY di.hotel_id
          ),
          pending AS (
            SELECT hotel_id, COUNT(*) AS cnt
            FROM auto_publishing_rate_reviews
            WHERE status = 'pending'
            GROUP BY hotel_id
          )
          SELECT
            h.hotel_id,
            h.name,
            COALESCE(h.location, '') AS location,
            k.occupancy,
            k.adr,
            k.revpar,
            COALESCE(p.cnt, 0) AS pending_approvals
          FROM hotels h
          LEFT JOIN kpis k ON k.hotel_id = h.hotel_id
          LEFT JOIN pending p ON p.hotel_id = h.hotel_id
          WHERE h.deleted_at IS NULL
          ORDER BY h.name
        `;
      }
      const mapped = rows.map(mapRow);
      // Prepend Meriton Kent fixture for admin/superuser view only
      if (isSuperuser || userId == null) {
        return [MERITON_KENT_FIXTURE, ...mapped];
      }
      return mapped;
    },
    60_000 // 1-minute cache for the hotel list
  );
}

/**
 * Single hotel with KPIs.
 */
export async function getHotel(hotelId: string): Promise<HotelRow | null> {
  return cached(
    "getHotel",
    { hotelId },
    async () => {
      const rows = await sql<HotelDbRow>`
        WITH kpis AS (
          SELECT
            di.hotel_id,
            SUM(di.actual_occupancy)::float /
              NULLIF(SUM(di.available_count + di.out_of_service_count + di.actual_occupancy), 0) * 100
              AS occupancy,
            AVG(COALESCE(sp.suggested_price, sp.base_rate))
              AS adr,
            SUM(di.actual_occupancy * COALESCE(sp.suggested_price, sp.base_rate)) /
              NULLIF(SUM(di.available_count + di.out_of_service_count + di.actual_occupancy), 0)
              AS revpar
          FROM daily_inventory di
          LEFT JOIN suggested_prices sp
            ON sp.hotel_id = di.hotel_id
           AND sp.date = di.inventory_date
           AND sp.room_type_code = di.room_type_code
          WHERE di.hotel_id = ${hotelId}
            AND di.inventory_date >= CURRENT_DATE - INTERVAL '30 days'
            AND di.inventory_date < CURRENT_DATE
          GROUP BY di.hotel_id
        ),
        pending AS (
          SELECT COUNT(*) AS cnt
          FROM auto_publishing_rate_reviews
          WHERE hotel_id = ${hotelId}
            AND status = 'pending'
        )
        SELECT
          h.hotel_id,
          h.name,
          COALESCE(h.location, '') AS location,
          k.occupancy,
          k.adr,
          k.revpar,
          COALESCE((SELECT cnt FROM pending), 0) AS pending_approvals
        FROM hotels h
        LEFT JOIN kpis k ON k.hotel_id = h.hotel_id
        WHERE h.hotel_id = ${hotelId}
          AND h.deleted_at IS NULL
        LIMIT 1
      `;

      if (!rows.length) return null;
      return mapRow(rows[0]);
    },
    60_000
  );
}
