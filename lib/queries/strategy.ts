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
