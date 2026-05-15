/**
 * Rule-based Insights Engine
 *
 * Generates actionable insights by querying live DB data.
 * No LLM — pure SQL + template strings with real numbers.
 *
 * Rules:
 *   1. Competitor rate spike / drop (±15% in last 24h)
 *   2. Pickup pace anomaly (OTB vs 7-day avg)
 *   3. Stale pricing (suggested_price not updated >48h for next 7 nights)
 *   4. Event + pricing opportunity (high-impact event + outlier rate)
 *   5. Combined: competitor drop + your rate above theirs
 */

import { sql } from "@/lib/db";
import type { InsightRow } from "@/lib/queries/action-center";

/* ────────────────────────────────────────────────────────────
 * Rule 1 — Competitor rate movement ≥ 15%
 * competitor_rates.hotel_id = INT → join via hotels
 * ──────────────────────────────────────────────────────────── */
async function ruleCompetitorMove(hotelId: string): Promise<InsightRow[]> {
  try {
    const rows = await sql<{
      competitor_name: string;
      stay_date: string;
      rate_value: string;
      previous_rate: string;
      pct_change: string;
      direction: string;
    }>`
      SELECT
        hcs.competitor_name,
        cr.stay_date::text,
        cr.rate_value::text,
        cr.previous_rate::text,
        (
          (cr.rate_value - cr.previous_rate)::float / NULLIF(cr.previous_rate, 0) * 100
        )::text AS pct_change,
        CASE
          WHEN cr.rate_value > cr.previous_rate THEN 'up'
          ELSE 'down'
        END AS direction
      FROM competitor_rates cr
      JOIN hotel_comp_set hcs ON hcs.id = cr.competitor_id
      JOIN hotels h ON h.id = hcs.hotel_id
      WHERE h.hotel_id = ${hotelId}
        AND cr.previous_rate IS NOT NULL
        AND cr.previous_rate > 0
        AND cr.rate_value IS NOT NULL
        AND ABS((cr.rate_value - cr.previous_rate)::float / cr.previous_rate) >= 0.15
        AND cr.last_seen_at >= NOW() - INTERVAL '24 hours'
        AND cr.stay_date >= CURRENT_DATE
      ORDER BY ABS((cr.rate_value - cr.previous_rate)::float / cr.previous_rate) DESC
      LIMIT 3
    `;

    // Deduplicate: one insight per date (take the largest move)
    const byDate = new Map<string, typeof rows[0]>();
    for (const r of rows) {
      const dateKey = String(r.stay_date).slice(0, 10);
      const existing = byDate.get(dateKey);
      if (!existing || Math.abs(Number(r.pct_change)) > Math.abs(Number(existing.pct_change))) {
        byDate.set(dateKey, r);
      }
    }

    return Array.from(byDate.values()).map((r, idx) => {
      const pct = Math.abs(Number(r.pct_change)).toFixed(0);
      const dir = r.direction === "up" ? "raised" : "cut";
      const dateStr = String(r.stay_date).slice(0, 10);
      const date = new Date(dateStr + "T00:00:00Z").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
      const numPct = Number(pct);
      const severity = numPct >= 20 ? 0.9 : 0.7;

      // For very large moves (>80%) add context — likely a peak/event surge, not a data error
      const contextNote = numPct > 80
        ? ` This is likely a peak-demand surge pricing move for that date.`
        : "";

      return {
        id: `comp-move-${idx}`,
        hotelId,
        insightType: "competitor_rate_change",
        title: `${r.competitor_name} ${dir} rate ${pct}% for ${date}`,
        description: `${r.competitor_name} moved from $${Number(r.previous_rate).toFixed(0)} → $${Number(r.rate_value).toFixed(0)} (${r.direction === "up" ? "+" : "-"}${pct}%) for ${date}. Review your position to stay competitive.${contextNote}`,
        dateStart: dateStr,
        dateEnd: dateStr,
        confidenceScore: severity,
        actionTaken: false,
        createdAt: new Date().toISOString(),
      };
    });
  } catch {
    return [];
  }
}

/* ────────────────────────────────────────────────────────────
 * Rule 2 — Booking pace anomaly
 *
 * Primary: uses actual_pickup_last_day (last-day booking increments).
 * Fallback: if pickup data is all-zero (PMS not sending increments),
 *   compares tonight's OTB occupancy against the 30-day same-DOW
 *   average to detect anomalous demand levels.
 * ──────────────────────────────────────────────────────────── */
async function rulePickupAnomaly(hotelId: string): Promise<InsightRow[]> {
  try {
    const rows = await sql<{
      today_pickup:    string | null;
      avg_pickup_7d:   string | null;
      tonight_occ_pct: string | null;
      avg_occ_30d:     string | null;
      tonight_otb:     string | null;
      capacity:        string | null;
    }>`
      WITH recent AS (
        SELECT
          inventory_date,
          SUM(actual_pickup_last_day)                                          AS day_pickup,
          SUM(actual_occupancy)                                                AS otb,
          SUM(available_count + out_of_service_count + actual_occupancy)       AS cap,
          ROUND(
            SUM(actual_occupancy)::numeric
            / NULLIF(SUM(available_count + out_of_service_count + actual_occupancy), 0) * 100,
            1
          )                                                                    AS occ_pct
        FROM daily_inventory
        WHERE hotel_id = ${hotelId}
          AND inventory_date BETWEEN CURRENT_DATE - 31 AND CURRENT_DATE
        GROUP BY inventory_date
      )
      SELECT
        (SELECT day_pickup FROM recent WHERE inventory_date = CURRENT_DATE)::text   AS today_pickup,
        (SELECT AVG(day_pickup) FROM recent WHERE inventory_date < CURRENT_DATE
           AND inventory_date >= CURRENT_DATE - 7)::text                           AS avg_pickup_7d,
        (SELECT occ_pct FROM recent WHERE inventory_date = CURRENT_DATE)::text      AS tonight_occ_pct,
        -- 30d same-DOW avg for OTB fallback (past nights only, sold>0)
        (SELECT AVG(occ_pct) FROM recent
          WHERE inventory_date < CURRENT_DATE
            AND EXTRACT(DOW FROM inventory_date) = EXTRACT(DOW FROM CURRENT_DATE)
            AND otb > 0)::text                                                      AS avg_occ_30d,
        (SELECT otb  FROM recent WHERE inventory_date = CURRENT_DATE)::text         AS tonight_otb,
        (SELECT cap  FROM recent WHERE inventory_date = CURRENT_DATE)::text         AS capacity
    `;

    const r = rows[0];
    if (!r) return [];

    const todayPickup  = Number(r.today_pickup)    || 0;
    const avgPickup    = Number(r.avg_pickup_7d)   || 0;
    const tonightOtb   = Number(r.tonight_otb)     || 0;
    const capacity     = Number(r.capacity)        || 1;
    const tonightOcc   = Number(r.tonight_occ_pct) || 0;
    const avgOcc30d    = Number(r.avg_occ_30d)     || 0;
    const today        = new Date().toISOString().slice(0, 10);

    // ── Primary path: use pickup increments if available ──
    if (avgPickup > 0) {
      const delta = ((todayPickup - avgPickup) / avgPickup) * 100;
      if (Math.abs(delta) < 25) return [];
      const direction = delta > 0 ? "spike" : "slowdown";
      const occPct = ((tonightOtb / capacity) * 100).toFixed(0);
      return [{
        id:            "pickup-anomaly",
        hotelId,
        insightType:   direction === "spike" ? "booking_spike" : "booking_slowdown",
        title:         `Booking ${direction}: ${todayPickup} rooms today vs ${avgPickup.toFixed(0)}-room avg`,
        description:   `Today's pickup (${todayPickup} rooms) is ${Math.abs(delta).toFixed(0)}% ${delta > 0 ? "above" : "below"} your 7-day average of ${avgPickup.toFixed(0)} rooms/day. Tonight's OTB is ${tonightOtb} rooms (${occPct}% occ).`,
        dateStart:     today,
        dateEnd:       today,
        confidenceScore: Math.abs(delta) >= 50 ? 0.88 : 0.65,
        actionTaken:   false,
        createdAt:     new Date().toISOString(),
      }];
    }

    // ── Fallback: OTB occupancy vs 30d same-DOW average ──
    // (fires when PMS is not sending last-day pickup increments)
    if (avgOcc30d === 0) return [];
    const occDelta = ((tonightOcc - avgOcc30d) / avgOcc30d) * 100;
    if (Math.abs(occDelta) < 25) return [];

    const direction  = occDelta > 0 ? "spike" : "slowdown";
    const dow        = new Date().toLocaleDateString("en-US", { weekday: "long" });
    return [{
      id:            "otb-anomaly",
      hotelId,
      insightType:   direction === "spike" ? "booking_spike" : "booking_slowdown",
      title:         `OTB ${direction} tonight: ${tonightOcc.toFixed(0)}% vs ${avgOcc30d.toFixed(0)}% typical ${dow}`,
      description:   `Tonight's on-the-books occupancy (${tonightOcc.toFixed(0)}%) is ${Math.abs(occDelta).toFixed(0)}% ${occDelta > 0 ? "above" : "below"} your 30-day same-day-of-week average of ${avgOcc30d.toFixed(0)}%. Fallback: using OTB occupancy pace — last-day pickup data not available from PMS.`,
      dateStart:     today,
      dateEnd:       today,
      confidenceScore: Math.abs(occDelta) >= 40 ? 0.72 : 0.55,
      actionTaken:   false,
      createdAt:     new Date().toISOString(),
    }];
  } catch {
    return [];
  }
}

/* ────────────────────────────────────────────────────────────
 * Rule 3 — Stale pricing (no update in >48h for next 7 nights)
 * ──────────────────────────────────────────────────────────── */
async function ruleStalePricing(hotelId: string): Promise<InsightRow[]> {
  try {
    const rows = await sql<{
      stale_count: string;
      oldest_update: string | null;
      first_stale_date: string | null;
    }>`
      SELECT
        COUNT(*)::text                   AS stale_count,
        MIN(updated_at)::text            AS oldest_update,
        MIN(date)::text                  AS first_stale_date
      FROM suggested_prices
      WHERE hotel_id = ${hotelId}
        AND date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '6 days'
        AND updated_at < NOW() - INTERVAL '48 hours'
    `;

    const r = rows[0];
    const count = Number(r?.stale_count) || 0;
    if (count === 0) return [];

    const firstDate = r.first_stale_date
      ? new Date(r.first_stale_date + "T00:00:00Z").toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        })
      : "upcoming";

    const hoursAgo = r.oldest_update
      ? Math.round(
          (Date.now() - new Date(r.oldest_update).getTime()) / 3_600_000
        )
      : null;

    return [
      {
        id: "stale-pricing",
        hotelId,
        insightType: "stale_pricing",
        title: `${count} rate${count > 1 ? "s" : ""} not refreshed in ${hoursAgo ? `${hoursAgo}h` : ">48h"}`,
        description: `${count} room-type/date combinations starting ${firstDate} have suggested prices that haven't been updated in over 48 hours. Competitor rates may have shifted — review and republish.`,
        dateStart: r.first_stale_date,
        dateEnd: null,
        confidenceScore: count >= 10 ? 0.85 : 0.6,
        actionTaken: false,
        createdAt: new Date().toISOString(),
      },
    ];
  } catch {
    return [];
  }
}

/* ────────────────────────────────────────────────────────────
 * Rule 4 — High-impact event + pricing opportunity
 * events.hotel_id = STRING (direct match)
 * ──────────────────────────────────────────────────────────── */
async function ruleEventPricingOpportunity(hotelId: string): Promise<InsightRow[]> {
  try {
    const rows = await sql<{
      title: string;
      start_dt: string;
      phq_attendance: string | null;
      local_rank: string | null;
      predicted_spend: string | null;
      my_rate: string | null;
    }>`
      SELECT
        e.title,
        e.start::text AS start_dt,
        e.phq_attendance::text,
        e.local_rank::text,
        e.predicted_accommodation_spend::text AS predicted_spend,
        (
          SELECT AVG(COALESCE(sp.suggested_price, sp.base_rate))
          FROM suggested_prices sp
          WHERE sp.hotel_id = ${hotelId}
            AND sp.date = e.start::date
        )::text AS my_rate
      FROM events e
      WHERE e.hotel_id = ${hotelId}
        AND e.start >= NOW()
        AND e.start <= NOW() + INTERVAL '14 days'
        AND (e.local_rank >= 75 OR e.phq_attendance >= 10000)
      ORDER BY e.local_rank DESC NULLS LAST
      LIMIT 2
    `;

    return rows.map((r, idx) => {
      const date = r.start_dt
        ? new Date(r.start_dt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })
        : "upcoming";
      const attendance = Number(r.phq_attendance) || 0;
      const spend = Number(r.predicted_spend) || 0;
      const myRate = r.my_rate ? `$${Number(r.my_rate).toFixed(0)}` : "unknown";
      const rank = Number(r.local_rank) || 0;

      return {
        id: `event-opp-${idx}`,
        hotelId,
        insightType: "event_pricing_opportunity",
        title: `High-demand event ${date}: ${r.title.slice(0, 50)}${r.title.length > 50 ? "…" : ""}`,
        description: `Local rank ${rank} event on ${date} with ~${attendance.toLocaleString()} attendees and $${(spend / 1000).toFixed(0)}K predicted accommodation spend in the area. Your current rate for that night is ${myRate}. Consider increasing rates or closing discounts.`,
        dateStart: r.start_dt?.slice(0, 10) ?? null,
        dateEnd: r.start_dt?.slice(0, 10) ?? null,
        confidenceScore: rank >= 85 ? 0.92 : 0.75,
        actionTaken: false,
        createdAt: new Date().toISOString(),
      };
    });
  } catch {
    return [];
  }
}

/* ────────────────────────────────────────────────────────────
 * Rule 5 — Combined: comp dropped below you + high OTB night
 * ──────────────────────────────────────────────────────────── */
async function ruleCombinedCompOtb(hotelId: string): Promise<InsightRow[]> {
  try {
    const rows = await sql<{
      stay_date: string;
      my_rate: string | null;
      comp_min_rate: string | null;
      comp_name: string;
      otb_pct: string | null;
    }>`
      WITH my_rates AS (
        SELECT date, AVG(COALESCE(suggested_price, base_rate)) AS avg_rate
        FROM suggested_prices
        WHERE hotel_id = ${hotelId}
          AND date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '6 days'
        GROUP BY date
      ),
      comp_best AS (
        SELECT
          cr.stay_date,
          MIN(cr.rate_value) AS min_rate,
          hcs.competitor_name
        FROM competitor_rates cr
        JOIN hotel_comp_set hcs ON hcs.id = cr.competitor_id
        JOIN hotels h ON h.id = hcs.hotel_id
        WHERE h.hotel_id = ${hotelId}
          AND hcs.is_my_hotel = false
          AND cr.stay_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '6 days'
          AND cr.last_seen_at IS NOT NULL
          AND cr.rate_value IS NOT NULL
        GROUP BY cr.stay_date, hcs.competitor_name
        ORDER BY MIN(cr.rate_value) ASC
      ),
      night_otb AS (
        SELECT inventory_date,
          SUM(actual_occupancy)::float /
            NULLIF(SUM(available_count + out_of_service_count + actual_occupancy), 0) AS occ
        FROM daily_inventory
        WHERE hotel_id = ${hotelId}
          AND inventory_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '6 days'
        GROUP BY inventory_date
      )
      SELECT
        mr.date::text AS stay_date,
        mr.avg_rate::text AS my_rate,
        cb.min_rate::text AS comp_min_rate,
        cb.competitor_name AS comp_name,
        (no.occ * 100)::text AS otb_pct
      FROM my_rates mr
      JOIN comp_best cb ON cb.stay_date = mr.date
      LEFT JOIN night_otb no ON no.inventory_date = mr.date
      WHERE cb.min_rate < mr.avg_rate * 0.90   -- comp is 10%+ cheaper
        AND (no.occ IS NULL OR no.occ < 0.70)   -- and we're under 70% OTB
      ORDER BY mr.date ASC
      LIMIT 2
    `;

    return rows.map((r, idx) => {
      const date = new Date(r.stay_date + "T00:00:00Z").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        weekday: "short",
        timeZone: "UTC",
      });
      const myRate = Number(r.my_rate).toFixed(0);
      const compRate = Number(r.comp_min_rate).toFixed(0);
      const otb = r.otb_pct ? `${Number(r.otb_pct).toFixed(0)}%` : "low";
      const gap = (((Number(r.my_rate) - Number(r.comp_min_rate)) / Number(r.comp_min_rate)) * 100).toFixed(0);

      return {
        id: `comp-below-${idx}`,
        hotelId,
        insightType: "rate_position_risk",
        title: `${r.comp_name} is ${gap}% cheaper for ${date} — OTB only ${otb}`,
        description: `You're at $${myRate} while ${r.comp_name} is at $${compRate} (${gap}% below you) for ${date}. Current OTB is only ${otb}. Consider dropping rate to capture demand before the window closes.`,
        dateStart: r.stay_date,
        dateEnd: r.stay_date,
        confidenceScore: 0.78,
        actionTaken: false,
        createdAt: new Date().toISOString(),
      };
    });
  } catch {
    return [];
  }
}

/* ────────────────────────────────────────────────────────────
 * Master runner — merge DB insights + rule-based triggers
 * ──────────────────────────────────────────────────────────── */
export async function runInsightsEngine(
  hotelId: string,
  dbInsights: InsightRow[]
): Promise<InsightRow[]> {
  // Run all rules concurrently
  const [compMove, pickupAnomaly, stale, eventOpp, combineComp] = await Promise.all([
    ruleCompetitorMove(hotelId),
    rulePickupAnomaly(hotelId),
    ruleStalePricing(hotelId),
    ruleEventPricingOpportunity(hotelId),
    ruleCombinedCompOtb(hotelId),
  ]);

  const ruleInsights = [
    ...compMove,
    ...pickupAnomaly,
    ...stale,
    ...eventOpp,
    ...combineComp,
  ];

  // Merge: rule-generated insights take priority (prepended), then DB insights
  // Deduplicate by insightType (keep highest confidence)
  const seen = new Set<string>();
  const merged: InsightRow[] = [];

  for (const insight of [...ruleInsights, ...dbInsights]) {
    const key = `${insight.insightType}:${insight.dateStart ?? ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(insight);
    }
  }

  // Sort: higher confidence first, then by recency
  merged.sort((a, b) => {
    const confDiff = (b.confidenceScore ?? 0) - (a.confidenceScore ?? 0);
    if (Math.abs(confDiff) > 0.05) return confDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return merged.slice(0, 20);
}

/* ────────────────────────────────────────────────────────────
 * Meriton Kent Hotel showcase fixture
 * A curated set of insights for demo presentations.
 * Used when hotelId === MERITON_KENT_HOTEL_ID.
 * ──────────────────────────────────────────────────────────── */
export const MERITON_KENT_HOTEL_ID = "MERITON_KENT";

export const MERITON_KENT_INSIGHTS: InsightRow[] = [
  {
    id: "mk-1",
    hotelId: MERITON_KENT_HOTEL_ID,
    insightType: "competitor_rate_change",
    title: "Grand Hyatt cut rates 22% for Fri–Sat — you're $87 above comp median",
    description:
      "Grand Hyatt reduced BAR from $389 → $305 (-22%) for May 17–18. Your current rate of $392 leaves you $87 above the comp median of $305. OTB for Fri night is only 61%. Consider closing the gap before the pickup window narrows.",
    dateStart: new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10),
    dateEnd: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
    confidenceScore: 0.93,
    actionTaken: false,
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  {
    id: "mk-2",
    hotelId: MERITON_KENT_HOTEL_ID,
    insightType: "booking_spike",
    title: "Booking spike: +184 rooms today vs 41-room daily average",
    description:
      "Today's pickup of 184 rooms is 349% above your 7-day average of 41 rooms/day. Tonight's OTB is now 78% (214 of 275 rooms). This spike coincides with a major conference announcement — rates may be too low. Review and raise for the spike period.",
    dateStart: new Date().toISOString().slice(0, 10),
    dateEnd: new Date().toISOString().slice(0, 10),
    confidenceScore: 0.91,
    actionTaken: false,
    createdAt: new Date(Date.now() - 1 * 3600000).toISOString(),
  },
  {
    id: "mk-3",
    hotelId: MERITON_KENT_HOTEL_ID,
    insightType: "event_pricing_opportunity",
    title: "High-demand event May 30: Coldplay — Music of the Spheres Tour",
    description:
      "Local rank 88 event on May 30 with ~19,500 attendees and $1.2M predicted accommodation spend in the area. Your current rate for that night is $289. Comparable events in 2025 drove 95%+ occupancy at $450+. Consider raising rates and closing flexible rates.",
    dateStart: new Date(Date.now() + 17 * 86400000).toISOString().slice(0, 10),
    dateEnd: new Date(Date.now() + 17 * 86400000).toISOString().slice(0, 10),
    confidenceScore: 0.89,
    actionTaken: false,
    createdAt: new Date(Date.now() - 30 * 60000).toISOString(),
  },
  {
    id: "mk-4",
    hotelId: MERITON_KENT_HOTEL_ID,
    insightType: "stale_pricing",
    title: "12 rates not refreshed in 61 hours — weekend window at risk",
    description:
      "12 room-type/date combinations for May 16–18 have suggested prices that haven't been updated since Tuesday. The Marriott and Westin both repriced overnight. Your stale rates may be leaving money on the table or causing lost bookings.",
    dateStart: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
    dateEnd: null,
    confidenceScore: 0.82,
    actionTaken: false,
    createdAt: new Date(Date.now() - 4 * 3600000).toISOString(),
  },
  {
    id: "mk-5",
    hotelId: MERITON_KENT_HOTEL_ID,
    insightType: "rate_position_risk",
    title: "Westin is 18% cheaper for Jun 4 — OTB only 38%",
    description:
      "You're at $342 while Westin is at $281 (18% below you) for Jun 4. OTB is only 38% with 18 days to arrival. Three other properties are also below $300. Drop to $309 to match the comp-set median and capture remaining demand.",
    dateStart: new Date(Date.now() + 22 * 86400000).toISOString().slice(0, 10),
    dateEnd: new Date(Date.now() + 22 * 86400000).toISOString().slice(0, 10),
    confidenceScore: 0.77,
    actionTaken: false,
    createdAt: new Date(Date.now() - 6 * 3600000).toISOString(),
  },
];
