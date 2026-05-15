/**
 * Strategy & pricing configuration queries.
 */

import { sql, cached } from "@/lib/db";

/* ============================================================
 * Pricing Config
 * ============================================================ */

export interface PricingConfigRow {
  hotelId: string;
  // Aggregated across room types (min/max/avg)
  floorPrice: number;
  ceilingPrice: number;
  baseElasticity: number;
  minElasticity: number;
  occupancySensitivity: number;
  pickupSensitivity: number;
  roomTypeCount: number;
}

export async function getPricingConfig(hotelId: string): Promise<PricingConfigRow | null> {
  return cached(
    "pricingConfig",
    { hotelId },
    async () => {
      const rows = await sql<{
        floor_price: string | null;
        ceiling_price: string | null;
        base_elasticity: string | null;
        min_elasticity: string | null;
        occupancy_sensitivity_factor: string | null;
        pickup_sensitivity_factor: string | null;
        room_type_count: string;
      }>`
        SELECT
          MIN(pc.floor_price)::text AS floor_price,
          MAX(pc.ceiling_price)::text AS ceiling_price,
          AVG(pc.base_elasticity)::text AS base_elasticity,
          AVG(pc.min_elasticity)::text AS min_elasticity,
          AVG(pc.occupancy_sensitivity_factor)::text AS occupancy_sensitivity_factor,
          AVG(pc.pickup_sensitivity_factor)::text AS pickup_sensitivity_factor,
          COUNT(*)::text AS room_type_count
        FROM pricing_configuration pc
        WHERE pc.hotel_id = (
          SELECT id FROM hotels WHERE hotel_id = ${hotelId} AND deleted_at IS NULL LIMIT 1
        )
      `;

      if (!rows.length || rows[0].room_type_count === "0") return null;
      const r = rows[0];
      return {
        hotelId,
        floorPrice: r.floor_price != null ? Number(r.floor_price) : 0,
        ceilingPrice: r.ceiling_price != null ? Number(r.ceiling_price) : 0,
        baseElasticity: r.base_elasticity != null ? Number(Number(r.base_elasticity).toFixed(3)) : 0,
        minElasticity: r.min_elasticity != null ? Number(Number(r.min_elasticity).toFixed(3)) : 0,
        occupancySensitivity:
          r.occupancy_sensitivity_factor != null
            ? Number(Number(r.occupancy_sensitivity_factor).toFixed(3))
            : 0,
        pickupSensitivity:
          r.pickup_sensitivity_factor != null
            ? Number(Number(r.pickup_sensitivity_factor).toFixed(3))
            : 0,
        roomTypeCount: parseInt(r.room_type_count, 10),
      };
    },
    300_000 // 5-minute cache
  );
}

/* ============================================================
 * Strategy Profiles
 * ============================================================ */

export interface StrategyProfileRow {
  knobName: string;
  profileName: string;
  displayName: string;
  description: string;
  meta: Record<string, unknown>;
  isActive: boolean;
  sortOrder: number;
}

export async function getStrategyProfiles(): Promise<StrategyProfileRow[]> {
  return cached(
    "strategyProfiles",
    undefined,
    async () => {
      const rows = await sql<{
        knob_name: string;
        profile_name: string;
        display_name: string;
        description: string | null;
        meta: unknown;
        is_active: boolean;
        sort_order: number;
      }>`
        SELECT
          knob_name,
          profile_name,
          display_name,
          COALESCE(description, '') AS description,
          meta,
          is_active,
          sort_order
        FROM pricing_strategy_profiles
        WHERE is_active = true
        ORDER BY knob_name, sort_order
      `;

      return rows.map((r) => ({
        knobName: r.knob_name,
        profileName: r.profile_name,
        displayName: r.display_name,
        description: r.description ?? "",
        meta: (r.meta as Record<string, unknown>) ?? {},
        isActive: r.is_active,
        sortOrder: r.sort_order,
      }));
    },
    600_000 // 10-minute cache (profiles rarely change)
  );
}

/* ============================================================
 * Strategy Performance — live MTD KPIs
 * Replaces STRATEGY_ACTUALS mock with real DB aggregates.
 *
 * Formula matches Ampliphi:
 *   revenue   = SUM(actual_occupancy × COALESCE(suggested_price, base_rate, current_price))
 *   occupancy = SUM(actual_occupancy) / SUM(available + out_of_service + actual_occupancy) × 100
 *   ADR       = revenue / SUM(actual_occupancy)
 * ============================================================ */

export interface StrategyPerformanceRow {
  hotelId: string;
  mtdRevenue: number;
  mtdOccupancy: number;        // 0–100
  currentAdr: number;
  daysIntoMonth: number;
  daysInMonth: number;
  /** Projected EOM revenue at current daily run-rate. */
  forecastEomRevenue: number;
  /** Direct-booking share is unavailable from PMS feed — null until channel data lands. */
  directBookingShare: number | null;
  /** Sample size: how many distinct dates contributed. */
  samples: number;
}

export async function getStrategyPerformance(hotelId: string): Promise<StrategyPerformanceRow | null> {
  return cached(
    "strategyPerformance",
    { hotelId },
    async () => {
      const rows = await sql<{
        total_revenue: string | null;
        total_sold: string | null;
        total_capacity: string | null;
        days_into_month: string;
        days_in_month: string;
        samples: string;
      }>`
        WITH mtd AS (
          SELECT
            SUM(di.actual_occupancy * COALESCE(sp.suggested_price, sp.base_rate, di.current_price))::float
              AS total_revenue,
            SUM(di.actual_occupancy)::int                                            AS total_sold,
            SUM(di.available_count + di.out_of_service_count + di.actual_occupancy)::int
              AS total_capacity,
            COUNT(DISTINCT di.inventory_date)::int                                   AS samples
          FROM daily_inventory di
          LEFT JOIN suggested_prices sp
            ON sp.hotel_id = di.hotel_id
           AND sp.date     = di.inventory_date
           AND sp.room_type_code = di.room_type_code
          WHERE di.hotel_id = ${hotelId}
            AND di.inventory_date >= DATE_TRUNC('month', CURRENT_DATE)
            AND di.inventory_date <  CURRENT_DATE
        )
        SELECT
          mtd.total_revenue::text,
          mtd.total_sold::text,
          mtd.total_capacity::text,
          (CURRENT_DATE - DATE_TRUNC('month', CURRENT_DATE)::date)::text             AS days_into_month,
          (EXTRACT(DAY FROM (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')))::text
                                                                                     AS days_in_month,
          mtd.samples::text
        FROM mtd
      `;

      if (!rows.length) return null;
      const r = rows[0];

      const revenue        = Number(r.total_revenue ?? 0) || 0;
      const sold           = Number(r.total_sold ?? 0) || 0;
      const capacity       = Number(r.total_capacity ?? 0) || 0;
      const daysIntoMonth  = Math.max(1, parseInt(r.days_into_month ?? "1", 10));
      const daysInMonth    = parseInt(r.days_in_month ?? "30", 10);
      const samples        = parseInt(r.samples ?? "0", 10);

      // Nightly averages from the to-date window
      const mtdOccupancy = capacity > 0 ? (sold / capacity) * 100 : 0;
      const currentAdr   = sold > 0    ? revenue / sold           : 0;
      const dailyRunRate = daysIntoMonth > 0 ? revenue / daysIntoMonth : 0;
      const eomForecast  = dailyRunRate * daysInMonth;

      return {
        hotelId,
        mtdRevenue:         Number(revenue.toFixed(2)),
        mtdOccupancy:       Number(mtdOccupancy.toFixed(1)),
        currentAdr:         Number(currentAdr.toFixed(2)),
        daysIntoMonth,
        daysInMonth,
        forecastEomRevenue: Number(eomForecast.toFixed(2)),
        directBookingShare: null, // PMS does not surface booking_source — honest null
        samples,
      };
    },
    300_000 // 5-minute cache
  );
}

/* ============================================================
 * Simulator Config — drives the Day Simulator (was 100% hardcoded)
 *
 * Sources:
 *   • Room count        ← COUNT of pricing_configuration rows
 *   • Elasticity        ← AVG(base_elasticity) from pricing_configuration
 *   • Floor / Ceiling   ← MIN(floor_price), MAX(ceiling_price)
 *   • DOW base prices   ← AVG(suggested OR base OR current_price) by DOW (last 90d)
 *   • DOW base occ      ← AVG(occupancy) by DOW (last 90d)
 *   • Events            ← events table, hotel_id, next 90 days
 * ============================================================ */

export interface SimulatorEvent {
  date: string;          // YYYY-MM-DD
  name: string;
  boost: number;         // 0..1, derived from local_rank
  tag: string;
}

export interface SimulatorConfigData {
  hotelId: string;
  totalRooms: number;
  baseElasticity: number;      // Negative number, e.g. -0.5
  floorPrice: number;
  ceilingPrice: number;
  /** Index 0=Sun..6=Sat. */
  dowBasePrice: number[];
  /** Index 0=Sun..6=Sat. Values are 0..1. */
  dowBaseOccupancy: number[];
  /** Upcoming events keyed by YYYY-MM-DD. */
  events: SimulatorEvent[];
  /** Server's notion of "today" — drives the chip strip. */
  todayIso: string;
}

export async function getSimulatorConfig(hotelId: string): Promise<SimulatorConfigData> {
  return cached(
    "simulatorConfig",
    { hotelId },
    async () => {
      // All 5 DB queries run in parallel — dramatically faster than sequential awaits
      const [cfgRows, invRows, dowRows, eventRows, todayRows] = await Promise.all([
        // 1) Room count + elasticity + floor/ceiling from pricing_configuration
        sql<{
          room_count: string;
          base_elasticity: string | null;
          floor_price: string | null;
          ceiling_price: string | null;
        }>`
          SELECT
            COUNT(*)::text                    AS room_count,
            AVG(pc.base_elasticity)::text     AS base_elasticity,
            MIN(pc.floor_price)::text         AS floor_price,
            MAX(pc.ceiling_price)::text       AS ceiling_price
          FROM pricing_configuration pc
          WHERE pc.hotel_id = (
            SELECT id FROM hotels WHERE hotel_id = ${hotelId} AND deleted_at IS NULL LIMIT 1
          )
        `,
        // 2) Total room inventory (daily average over last 30 days)
        sql<{ total_rooms: string | null }>`
          SELECT
            SUM(
              di.available_count + di.out_of_service_count + di.actual_occupancy
            )::float / NULLIF(COUNT(DISTINCT di.inventory_date), 0)
            AS total_rooms
          FROM daily_inventory di
          WHERE di.hotel_id = ${hotelId}
            AND di.inventory_date BETWEEN CURRENT_DATE - INTERVAL '30 days' AND CURRENT_DATE
        `,
        // 3) DOW averages — pricing & occupancy over ±90 day window
        sql<{
          dow: string;
          avg_price: string | null;
          avg_occ: string | null;
        }>`
          SELECT
            EXTRACT(DOW FROM di.inventory_date)::text AS dow,
            AVG(COALESCE(sp.suggested_price, sp.base_rate, di.current_price))::text AS avg_price,
            AVG(
              CASE
                WHEN (di.available_count + di.out_of_service_count + di.actual_occupancy) > 0
                THEN di.actual_occupancy::float / (di.available_count + di.out_of_service_count + di.actual_occupancy)
                ELSE NULL
              END
            )::text AS avg_occ
          FROM daily_inventory di
          LEFT JOIN suggested_prices sp
            ON sp.hotel_id = di.hotel_id
           AND sp.date = di.inventory_date
           AND sp.room_type_code = di.room_type_code
          WHERE di.hotel_id = ${hotelId}
            AND di.inventory_date BETWEEN CURRENT_DATE - INTERVAL '90 days' AND CURRENT_DATE + INTERVAL '90 days'
          GROUP BY EXTRACT(DOW FROM di.inventory_date)
          ORDER BY EXTRACT(DOW FROM di.inventory_date)
        `,
        // 4) Events for the next 90 days
        sql<{
          start_dt: string;
          title: string;
          rank: string | null;
          local_rank: string | null;
          category: string;
        }>`
          SELECT
            TO_CHAR(e.start, 'YYYY-MM-DD') AS start_dt,
            e.title,
            e.rank::text,
            e.local_rank::text,
            e.category
          FROM events e
          WHERE e.hotel_id = ${hotelId}
            AND e.start >= CURRENT_TIMESTAMP
            AND e.start <= CURRENT_TIMESTAMP + INTERVAL '90 days'
          ORDER BY e.local_rank DESC NULLS LAST, e.start ASC
          LIMIT 30
        `,
        // 5) Server date (so client doesn't need to infer from TZ)
        sql<{ d: string }>`SELECT TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD') AS d`,
      ]);

      // --- Process pricing config ---
      const cfg = cfgRows[0] ?? { room_count: "0", base_elasticity: null, floor_price: null, ceiling_price: null };
      const roomTypeCount  = parseInt(cfg.room_count, 10) || 0;
      const baseElasticity = cfg.base_elasticity ? Number(cfg.base_elasticity) : -0.5;
      const floorPrice     = cfg.floor_price     ? Number(cfg.floor_price)     : 0;
      const ceilingPrice   = cfg.ceiling_price   ? Number(cfg.ceiling_price)   : 0;

      // --- Process room inventory ---
      const totalRooms = Math.round(Number(invRows[0]?.total_rooms ?? 0)) || roomTypeCount * 10 || 100;

      // --- Process DOW averages ---
      const dowBasePrice     = [0, 0, 0, 0, 0, 0, 0];
      const dowBaseOccupancy = [0, 0, 0, 0, 0, 0, 0];
      for (const r of dowRows) {
        const idx = parseInt(r.dow, 10);
        if (idx >= 0 && idx <= 6) {
          dowBasePrice[idx]     = Math.round(Number(r.avg_price ?? 0));
          dowBaseOccupancy[idx] = Number((Number(r.avg_occ ?? 0)).toFixed(3));
        }
      }
      // Fill missing DOWs from median to avoid zeros
      const presentPrices = dowBasePrice.filter((v) => v > 0);
      const presentOccs   = dowBaseOccupancy.filter((v) => v > 0);
      const medianPrice = presentPrices.length
        ? presentPrices.sort((a, b) => a - b)[Math.floor(presentPrices.length / 2)] : 0;
      const medianOcc = presentOccs.length
        ? presentOccs.sort((a, b) => a - b)[Math.floor(presentOccs.length / 2)] : 0;
      for (let i = 0; i < 7; i++) {
        if (dowBasePrice[i] === 0)     dowBasePrice[i]     = medianPrice;
        if (dowBaseOccupancy[i] === 0) dowBaseOccupancy[i] = medianOcc;
      }

      // --- Process events ---
      const events: SimulatorEvent[] = eventRows.map((e) => {
        const localRank = Number(e.local_rank) || 0;
        const boost = Math.min(0.35, (localRank / 100) * 0.35);
        return {
          date:  e.start_dt,
          name:  e.title,
          boost: Number(boost.toFixed(3)),
          tag:   e.category
            ? e.category.split("-").map(w => w[0]?.toUpperCase() + w.slice(1)).join(" ")
            : "Event",
        };
      });

      const todayIso = todayRows[0]?.d ?? new Date().toISOString().slice(0, 10);

      return {
        hotelId,
        totalRooms,
        baseElasticity: Number(baseElasticity.toFixed(3)),
        floorPrice,
        ceilingPrice,
        dowBasePrice,
        dowBaseOccupancy,
        events,
        todayIso,
      };
    },
    300_000
  );
}
