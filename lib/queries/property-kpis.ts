/**
 * Full KPI set for a single property.
 *
 * Occupancy formula (validated):
 *   occupancy = actual_occupancy / (available_count + out_of_service_count + actual_occupancy)
 * Revenue formula:
 *   revenue = actual_occupancy × COALESCE(suggested_price, base_rate)
 *
 * Note: daily_inventory uses `inventory_date` (not `date`) for the date column.
 *       suggested_prices uses `date`.
 */

import { sql, cached } from "@/lib/db";

export interface PropertyKpisRow {
  hotelId: string;
  // 30-day averages
  occupancy: number;     // %
  adr: number;           // $
  revpar: number;        // $
  revenueMtd: number;    // $ month-to-date
  paceVsLy: number;      // % delta vs same period last year
  // 14-day RevPAR sparkline (oldest → newest)
  revparTrend: number[];
  // Pending approval count
  pendingApprovals: number;
}

export async function getPropertyKpis(hotelId: string): Promise<PropertyKpisRow> {
  return cached(
    "propertyKpis",
    { hotelId },
    async () => {
      // 30-day KPIs
      const kpiRows = await sql<{
        occupancy: string | null;
        adr: string | null;
        revpar: string | null;
        revenue_mtd: string | null;
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
          SUM(CASE WHEN di.inventory_date >= date_trunc('month', CURRENT_DATE)
            THEN di.actual_occupancy * COALESCE(sp.suggested_price, sp.base_rate)
            ELSE 0
          END) AS revenue_mtd
        FROM daily_inventory di
        LEFT JOIN suggested_prices sp
          ON sp.hotel_id = di.hotel_id
         AND sp.date = di.inventory_date
         AND sp.room_type_code = di.room_type_code
        WHERE di.hotel_id = ${hotelId}
          AND di.inventory_date >= CURRENT_DATE - INTERVAL '30 days'
          AND di.inventory_date < CURRENT_DATE
      `;

      // Same-period last year revpar for pace calculation
      const lyRows = await sql<{ revpar_ly: string | null }>`
        SELECT
          SUM(di.actual_occupancy * COALESCE(sp.suggested_price, sp.base_rate)) /
            NULLIF(SUM(di.available_count + di.out_of_service_count + di.actual_occupancy), 0)
            AS revpar_ly
        FROM daily_inventory di
        LEFT JOIN suggested_prices sp
          ON sp.hotel_id = di.hotel_id
         AND sp.date = di.inventory_date
         AND sp.room_type_code = di.room_type_code
        WHERE di.hotel_id = ${hotelId}
          AND di.inventory_date >= CURRENT_DATE - INTERVAL '395 days'
          AND di.inventory_date < CURRENT_DATE - INTERVAL '365 days'
      `;

      // 14-day daily RevPAR for sparkline
      const trendRows = await sql<{ inv_date: string; revpar: string | null }>`
        SELECT
          di.inventory_date::text AS inv_date,
          SUM(di.actual_occupancy * COALESCE(sp.suggested_price, sp.base_rate)) /
            NULLIF(SUM(di.available_count + di.out_of_service_count + di.actual_occupancy), 0)
            AS revpar
        FROM daily_inventory di
        LEFT JOIN suggested_prices sp
          ON sp.hotel_id = di.hotel_id
         AND sp.date = di.inventory_date
         AND sp.room_type_code = di.room_type_code
        WHERE di.hotel_id = ${hotelId}
          AND di.inventory_date >= CURRENT_DATE - INTERVAL '14 days'
          AND di.inventory_date < CURRENT_DATE
        GROUP BY di.inventory_date
        ORDER BY di.inventory_date ASC
      `;

      // Pending approvals count
      const pendingRows = await sql<{ cnt: string }>`
        SELECT COUNT(*) AS cnt
        FROM auto_publishing_rate_reviews
        WHERE hotel_id = ${hotelId}
          AND status = 'pending'
      `;

      const k = kpiRows[0] ?? {};
      const ly = lyRows[0] ?? {};
      const revpar = k.revpar != null ? Number(k.revpar) : 0;
      const revparLy = ly.revpar_ly != null ? Number(ly.revpar_ly) : 0;
      const paceVsLy =
        revparLy > 0 ? ((revpar - revparLy) / revparLy) * 100 : 0;

      const revparTrend = trendRows.map((r) =>
        r.revpar != null ? Number(Number(r.revpar).toFixed(2)) : 0
      );

      return {
        hotelId,
        occupancy: k.occupancy != null ? Number(Number(k.occupancy).toFixed(1)) : 0,
        adr: k.adr != null ? Number(Number(k.adr).toFixed(2)) : 0,
        revpar: Number(revpar.toFixed(2)),
        revenueMtd: k.revenue_mtd != null ? Number(Number(k.revenue_mtd).toFixed(2)) : 0,
        paceVsLy: Number(paceVsLy.toFixed(1)),
        revparTrend,
        pendingApprovals: parseInt(pendingRows[0]?.cnt ?? "0", 10),
      };
    },
    120_000 // 2-minute cache
  );
}
