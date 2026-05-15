/**
 * Forecast & Demand queries — live DB data.
 *
 * Schema notes:
 *   daily_inventory:      hotel_id = STRING (hotel_id code), inventory_date
 *   suggested_prices:     hotel_id = STRING, date
 *   competitor_rates:     hotel_id = INTEGER FK → hotels.id, competitor_id = FK → hotel_comp_set.id
 *   hotel_comp_set:       hotel_id = INTEGER FK → hotels.id
 *   events:               hotel_id = STRING (direct match)
 *   daily_hotel_demand:   hotel_id = STRING (direct match)
 *   expected_booking_curves: hotel_id = INTEGER FK → hotels.id
 */

import { sql, cached } from "@/lib/db";

/* ============================================================
 * 1) Demand Heatmap — next 91 days
 * ============================================================ */

export interface HeatmapCell {
  date: string;       // ISO yyyy-mm-dd
  dow: number;        // 0 = Sun, 6 = Sat
  occupancy: number;  // 0–1 fraction
  paceIndex: number;  // deviation from hotel average (normalised)
  suggestedPrice: number;
  roomsSold: number;
  totalRooms: number;
}

export async function getHeatmapData(hotelId: string): Promise<HeatmapCell[]> {
  return cached("heatmap", { hotelId }, async () => {
    const full = await sql<{
      d: string;
      dow: string;
      total_sold: string;
      total_cap: string;
      avg_price: string | null;
      pace_index: string;
    }>`
      WITH daily AS (
        SELECT
          di.inventory_date                                              AS d,
          EXTRACT(DOW FROM di.inventory_date)::int                      AS dow,
          SUM(di.actual_occupancy)                                       AS total_sold,
          SUM(di.available_count + di.out_of_service_count + di.actual_occupancy) AS total_cap,
          AVG(
            COALESCE(sp.suggested_price, sp.base_rate, di.current_price)
          )                                                              AS avg_price
        FROM daily_inventory di
        LEFT JOIN suggested_prices sp
          ON sp.hotel_id = di.hotel_id
         AND sp.date     = di.inventory_date
         AND sp.room_type_code = di.room_type_code
        WHERE di.hotel_id = ${hotelId}
          AND di.inventory_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
        GROUP BY di.inventory_date
      ),
      overall_avg AS (
        SELECT COALESCE(AVG(
          CASE WHEN total_cap > 0 THEN total_sold::float / total_cap ELSE NULL END
        ), 0) AS avg_occ
        FROM daily
      )
      SELECT
        d::text,
        dow::text,
        total_sold::text,
        total_cap::text,
        avg_price::text,
        (
          CASE WHEN oa.avg_occ > 0 AND total_cap > 0
            THEN (total_sold::float / total_cap - oa.avg_occ) / oa.avg_occ
          ELSE 0
          END
        )::text AS pace_index
      FROM daily, overall_avg oa
      ORDER BY d ASC
    `;

    return full.map((r) => {
      const totalCap = Number(r.total_cap) || 1;
      const totalSold = Number(r.total_sold) || 0;
      return {
        date: r.d,
        dow: Number(r.dow),
        occupancy: Number((totalSold / totalCap).toFixed(3)),
        paceIndex: Number(Number(r.pace_index).toFixed(3)),
        suggestedPrice: Math.round(Number(r.avg_price) || 0),
        roomsSold: totalSold,
        totalRooms: totalCap,
      };
    });
  });
}

/* ============================================================
 * 2) Pickup Curve
 *    Target: next Saturday (or nearest future weekend) 10–30 days out.
 *    OTB: today's actual_occupancy from daily_inventory.
 *    STLY: same date -364 days.
 *    Daily pickup: actual_pickup_last_day for next 21 stay dates.
 * ============================================================ */

export interface PickupCurveData {
  targetDate: string;        // ISO yyyy-mm-dd
  daysUntilStay: number;
  totalRooms: number;
  // Today's OTB
  otbRooms: number;
  otbOccupancy: number;
  // STLY
  stlyRooms: number | null;
  stlyOccupancy: number | null;
  stlyAvailable: boolean;
  // Pace: OTB vs STLY (%) or OTB vs 30d avg
  paceVsComp: number | null;
  compLabel: string;
  // Daily pickup for next 14 stay dates (for bar chart)
  dailyPickup: Array<{
    date: string;
    dow: number;
    pickup: number;   // actual_pickup_last_day
    otb: number;      // actual_occupancy
    capacity: number;
  }>;
}

export async function getPickupCurveData(hotelId: string): Promise<PickupCurveData | null> {
  return cached("pickupCurve", { hotelId }, async () => {
    // Find next Saturday (or Friday) 10–30 days out
    const targetRows = await sql<{ target_date: string; days_out: string }>`
      SELECT
        d::text AS target_date,
        (d - CURRENT_DATE)::text AS days_out
      FROM generate_series(
        CURRENT_DATE + INTERVAL '10 days',
        CURRENT_DATE + INTERVAL '30 days',
        INTERVAL '1 day'
      ) d
      WHERE EXTRACT(DOW FROM d) IN (5, 6)   -- Fri or Sat
      LIMIT 1
    `;

    if (!targetRows.length) return null;
    const targetDate = targetRows[0].target_date;
    const daysUntilStay = Number(targetRows[0].days_out);

    const stlyDate = new Date(targetDate);
    stlyDate.setDate(stlyDate.getDate() - 364);
    const stlyDateStr = stlyDate.toISOString().slice(0, 10);

    // OTB for target date
    const otbRows = await sql<{
      sold: string;
      capacity: string;
      avg_price: string | null;
    }>`
      SELECT
        SUM(di.actual_occupancy)::text AS sold,
        SUM(di.available_count + di.out_of_service_count + di.actual_occupancy)::text AS capacity,
        AVG(COALESCE(sp.suggested_price, sp.base_rate, di.current_price))::text AS avg_price
      FROM daily_inventory di
      LEFT JOIN suggested_prices sp
        ON sp.hotel_id = di.hotel_id AND sp.date = di.inventory_date
       AND sp.room_type_code = di.room_type_code
      WHERE di.hotel_id = ${hotelId}
        AND di.inventory_date = ${targetDate}::date
    `;

    // STLY for same DOW last year
    const stlyRows = await sql<{ sold: string; capacity: string }>`
      SELECT
        SUM(actual_occupancy)::text AS sold,
        SUM(available_count + out_of_service_count + actual_occupancy)::text AS capacity
      FROM daily_inventory
      WHERE hotel_id = ${hotelId}
        AND inventory_date = ${stlyDateStr}::date
    `;

    // Daily pickup for next 14 stay dates (bar chart)
    const pickupRows = await sql<{
      inventory_date: string;
      dow: string;
      pickup: string | null;
      sold: string;
      capacity: string;
    }>`
      SELECT
        di.inventory_date::text,
        EXTRACT(DOW FROM di.inventory_date)::text AS dow,
        SUM(di.actual_pickup_last_day)::text AS pickup,
        SUM(di.actual_occupancy)::text AS sold,
        SUM(di.available_count + di.out_of_service_count + di.actual_occupancy)::text AS capacity
      FROM daily_inventory di
      WHERE di.hotel_id = ${hotelId}
        AND di.inventory_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '13 days'
      GROUP BY di.inventory_date
      ORDER BY di.inventory_date ASC
    `;

    const otb = otbRows[0] ?? { sold: "0", capacity: "0" };
    const otbRooms = Number(otb.sold) || 0;
    const totalRooms = Number(otb.capacity) || 0;
    const otbOccupancy = totalRooms > 0 ? otbRooms / totalRooms : 0;

    const stlyRow = stlyRows[0];
    const stlyRooms = stlyRow ? (Number(stlyRow.sold) || null) : null;
    const stlyCap = stlyRow ? (Number(stlyRow.capacity) || totalRooms) : totalRooms;
    const stlyAvailable = stlyRooms !== null && stlyRooms > 0;
    const stlyOccupancy = stlyAvailable ? stlyRooms! / stlyCap : null;

    let paceVsComp: number | null = null;
    let compLabel = "vs 30d avg";

    if (stlyAvailable && stlyOccupancy !== null) {
      paceVsComp = ((otbOccupancy - stlyOccupancy) / stlyOccupancy) * 100;
      compLabel = "vs STLY";
    }

    const dailyPickup = pickupRows.map((r) => ({
      date: r.inventory_date,
      dow: Number(r.dow),
      pickup: Number(r.pickup) || 0,
      otb: Number(r.sold) || 0,
      capacity: Number(r.capacity) || 0,
    }));

    return {
      targetDate,
      daysUntilStay,
      totalRooms,
      otbRooms,
      otbOccupancy,
      stlyRooms,
      stlyOccupancy,
      stlyAvailable,
      paceVsComp,
      compLabel,
      dailyPickup,
    };
  });
}

/* ============================================================
 * 3) Comp-Set Rate Ladder — next 7 nights
 *    Uses integer FK: competitor_rates.hotel_id → hotels.id
 * ============================================================ */

export interface CompSetRow {
  date: string;         // ISO yyyy-mm-dd
  dow: string;          // "Mon", "Tue", …
  myRate: number | null;
  competitors: Array<{
    name: string;
    rate: number | null;
    isMyHotel: boolean;
    hotelClass: string | null;
  }>;
  median: number | null;
  gap: number | null;   // % gap: (myRate - median) / median * 100
}

export async function getCompSetData(hotelId: string): Promise<CompSetRow[]> {
  return cached("compSet", { hotelId }, async () => {
    // Get cheapest rate per competitor per date
    const rows = await sql<{
      stay_date: string;
      competitor_name: string;
      is_my_hotel: string;
      hotel_class: string | null;
      best_rate: string | null;
    }>`
      SELECT
        cr.stay_date::text,
        hcs.competitor_name,
        hcs.is_my_hotel::text,
        hcs.hotel_class,
        MIN(cr.rate_value)::text AS best_rate
      FROM hotel_comp_set hcs
      JOIN hotels h ON h.id = hcs.hotel_id
      JOIN competitor_rates cr
        ON cr.competitor_id = hcs.id
       AND cr.hotel_id      = h.id
       AND cr.stay_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '6 days'
       AND cr.last_seen_at IS NOT NULL
       AND cr.rate_value IS NOT NULL
      WHERE h.hotel_id = ${hotelId}
      GROUP BY cr.stay_date, hcs.competitor_name, hcs.is_my_hotel, hcs.hotel_class
      ORDER BY cr.stay_date, MIN(cr.rate_value) NULLS LAST
    `;

    if (!rows.length) return [];

    // Group by date
    const byDate = new Map<
      string,
      Array<{ name: string; rate: number | null; isMyHotel: boolean; hotelClass: string | null }>
    >();
    for (const r of rows) {
      const comps = byDate.get(r.stay_date) ?? [];
      comps.push({
        name: r.competitor_name,
        rate: r.best_rate !== null ? Number(r.best_rate) : null,
        isMyHotel: r.is_my_hotel === "true",
        hotelClass: r.hotel_class ?? null,
      });
      byDate.set(r.stay_date, comps);
    }

    const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    return Array.from(byDate.entries()).map(([date, comps]) => {
      const myEntry = comps.find((c) => c.isMyHotel);
      const compRates = comps
        .filter((c) => !c.isMyHotel && c.rate !== null)
        .map((c) => c.rate as number);

      const sorted = [...compRates].sort((a, b) => a - b);
      const median =
        sorted.length > 0
          ? sorted.length % 2 === 1
            ? sorted[Math.floor(sorted.length / 2)]
            : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
          : null;

      const myRate = myEntry?.rate ?? null;
      const gap =
        myRate !== null && median !== null && median > 0
          ? ((myRate - median) / median) * 100
          : null;

      const d = new Date(date + "T00:00:00Z");
      const dow = DOW_LABELS[d.getUTCDay()];

      return { date, dow, myRate, competitors: comps, median, gap };
    });
  });
}

/* ============================================================
 * 4) Upcoming Events — next 30 days
 *    events.hotel_id = STRING (direct match)
 *    daily_hotel_demand.hotel_id = STRING (direct match)
 * ============================================================ */

export interface UpcomingEventRow {
  eventId: string;
  title: string;
  category: string;
  startDate: string;   // ISO
  endDate: string;     // ISO
  durationDays: number;
  distanceKm: number;
  rank: number;
  localRank: number;
  phqLabels: string[];
  impact: "high" | "medium" | "low";
  // Pricing context — avg suggested vs base rate across event dates
  avgBaseRate: number | null;
  avgSuggestedPrice: number | null;
  pricingRatio: number | null;    // suggestedPrice / baseRate, null if no data
  // from daily_hotel_demand (if row exists for start date)
  demandFlag: boolean;
}

export async function getUpcomingEvents(hotelId: string): Promise<UpcomingEventRow[]> {
  return cached("upcomingEvents", { hotelId }, async () => {
    const rows = await sql<{
      event_id: string;
      title: string;
      category: string;
      start_dt: string;
      end_dt: string;
      duration_days: string;
      distance_km: string | null;
      rank: string | null;
      local_rank: string | null;
      phq_labels: string | null;
      demand_flag: string | null;
      avg_base_rate: string | null;
      avg_suggested: string | null;
    }>`
      SELECT
        e.event_id,
        e.title,
        e.category,
        e.start::text                              AS start_dt,
        e."end"::text                              AS end_dt,
        GREATEST(1, (e."end"::date - e.start::date) + 1)::text AS duration_days,
        e.distance_km::text,
        e.rank::text,
        e.local_rank::text,
        e.phq_labels::text                         AS phq_labels,
        dhd.price_flag::text                       AS demand_flag,
        -- Pricing signal: avg across all room types for the event date range
        (
          SELECT AVG(sp.base_rate)::text
          FROM suggested_prices sp
          WHERE sp.hotel_id = e.hotel_id
            AND sp.date::date BETWEEN e.start::date AND e."end"::date
            AND sp.base_rate IS NOT NULL
        ) AS avg_base_rate,
        (
          SELECT AVG(COALESCE(sp.suggested_price, sp.base_rate))::text
          FROM suggested_prices sp
          WHERE sp.hotel_id = e.hotel_id
            AND sp.date::date BETWEEN e.start::date AND e."end"::date
            AND sp.base_rate IS NOT NULL
        ) AS avg_suggested
      FROM events e
      LEFT JOIN daily_hotel_demand dhd
        ON dhd.hotel_id = e.hotel_id
       AND dhd.date = e.start::date
      WHERE e.hotel_id = ${hotelId}
        AND e.start >= CURRENT_TIMESTAMP
        AND e.start <= CURRENT_TIMESTAMP + INTERVAL '30 days'
      ORDER BY e.local_rank DESC, e.start ASC
      LIMIT 20
    `;

    return rows.map((r) => {
      const rank      = Number(r.rank) || 0;
      const localRank = Number(r.local_rank) || 0;
      const duration  = Number(r.duration_days) || 1;

      // Parse phq_labels JSON array
      let phqLabels: string[] = [];
      try {
        if (r.phq_labels) {
          const parsed = JSON.parse(r.phq_labels);
          phqLabels = Array.isArray(parsed) ? parsed.map(String) : [];
        }
      } catch { /* ignore */ }

      // Derive impact from local_rank
      const impact: "high" | "medium" | "low" =
        localRank >= 70 ? "high" : localRank >= 50 ? "medium" : "low";

      const avgBase      = r.avg_base_rate     != null ? Number(r.avg_base_rate)  : null;
      const avgSuggested = r.avg_suggested     != null ? Number(r.avg_suggested)  : null;
      const pricingRatio = avgBase && avgBase > 0 && avgSuggested
        ? Number((avgSuggested / avgBase).toFixed(3))
        : null;

      return {
        eventId:          r.event_id,
        title:            r.title,
        category:         r.category,
        startDate:        r.start_dt,
        endDate:          r.end_dt,
        durationDays:     duration,
        distanceKm:       Number(r.distance_km) || 0,
        rank,
        localRank,
        phqLabels,
        impact,
        avgBaseRate:      avgBase,
        avgSuggestedPrice: avgSuggested,
        pricingRatio,
        demandFlag:       r.demand_flag === "true",
      };
    });
  });
}
