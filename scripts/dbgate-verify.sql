-- ============================================================
-- AMPLIPHI ACTION CENTER — DB VERIFICATION SCRIPT
-- Run in DBGate to cross-reference every number the UI shows.
--
-- Two hotels covered:
--   NGH11345 = Newbury Guest House, Boston MA
--   ELS270   = Hotel El Salvador, CDMX Mexico
--
-- How to use:
--   1. Paste this entire file into DBGate and run it.
--   2. Each section is labelled with what UI widget it maps to.
--   3. Numbers here should match the Action Center exactly.
--      If they differ, the UI query has a bug.
--
-- Key formulas used throughout:
--   Occupancy % = SUM(actual_occupancy) / SUM(avail + oos + actual_occupancy) * 100
--   ADR $       = SUM(actual_occupancy * price) / SUM(actual_occupancy)
--   RevPAR $    = SUM(actual_occupancy * price) / SUM(avail + oos + actual_occupancy)
--   Revenue $   = SUM(actual_occupancy * COALESCE(suggested_price, base_rate))
-- ============================================================


-- ============================================================
-- SECTION 0 — HOTEL METADATA
-- What the UI shows in the header / hotel selector
-- ============================================================

SELECT
  h.hotel_id,
  h.name,
  h.location,
  h.deleted_at
FROM hotels h
WHERE h.hotel_id IN ('NGH11345', 'ELS270');


-- ============================================================
-- SECTION 1 — DATA AVAILABILITY CHECK
-- Shows what date ranges actually have occupancy data.
-- If actual_occupancy is all 0 before a date, that's the
-- effective "data starts" point the UI should respect.
-- ============================================================

SELECT
  di.hotel_id,
  MIN(di.inventory_date)                                        AS earliest_row,
  MAX(di.inventory_date)                                        AS latest_row,
  MIN(CASE WHEN di.actual_occupancy > 0 THEN di.inventory_date END)
                                                                AS first_occ_date,
  MAX(CASE WHEN di.actual_occupancy > 0 THEN di.inventory_date END)
                                                                AS last_occ_date,
  SUM(di.actual_occupancy)                                      AS total_occ_all_time,
  COUNT(*)                                                      AS total_rows,
  COUNT(CASE WHEN di.actual_occupancy > 0 THEN 1 END)          AS rows_with_occ
FROM daily_inventory di
WHERE di.hotel_id IN ('NGH11345', 'ELS270')
GROUP BY di.hotel_id
ORDER BY di.hotel_id;


-- ============================================================
-- SECTION 2 — YESTERDAY KPIs
-- Maps to: Morning Briefing → "Yesterday" row
-- UI shows: Occupancy %, ADR $, RevPAR $, Revenue $
-- ============================================================

SELECT
  di.hotel_id,
  (CURRENT_DATE - 1)::text                                      AS date_checked,
  ROUND(
    SUM(di.actual_occupancy)::numeric /
    NULLIF(SUM(di.available_count + di.out_of_service_count + di.actual_occupancy), 0)
    * 100, 1
  )                                                             AS occupancy_pct,
  ROUND(
    CASE WHEN SUM(di.actual_occupancy) > 0
      THEN SUM(di.actual_occupancy * COALESCE(sp.suggested_price, sp.base_rate)) /
           SUM(di.actual_occupancy)
    END::numeric, 2
  )                                                             AS adr,
  ROUND(
    SUM(di.actual_occupancy * COALESCE(sp.suggested_price, sp.base_rate)) /
    NULLIF(SUM(di.available_count + di.out_of_service_count + di.actual_occupancy), 0)
    ::numeric, 2
  )                                                             AS revpar,
  ROUND(
    SUM(di.actual_occupancy * COALESCE(sp.suggested_price, sp.base_rate))::numeric, 2
  )                                                             AS revenue
FROM daily_inventory di
LEFT JOIN suggested_prices sp
  ON sp.hotel_id = di.hotel_id
 AND sp.date = di.inventory_date
 AND sp.room_type_code = di.room_type_code
WHERE di.hotel_id IN ('NGH11345', 'ELS270')
  AND di.inventory_date = CURRENT_DATE - 1
GROUP BY di.hotel_id
ORDER BY di.hotel_id;


-- ============================================================
-- SECTION 3 — COMPARISON BASELINE (30-day rolling avg)
-- Maps to: Morning Briefing → comp column (what % +/- shows)
-- UI label: "30d avg" (or "12-wk same-DOW avg" after fix)
-- ============================================================

SELECT
  di.hotel_id,
  ROUND(
    SUM(di.actual_occupancy)::numeric /
    NULLIF(SUM(di.available_count + di.out_of_service_count + di.actual_occupancy), 0)
    * 100, 1
  )                                                             AS avg_occupancy_pct,
  ROUND(
    CASE WHEN SUM(di.actual_occupancy) > 0
      THEN SUM(di.actual_occupancy * COALESCE(sp.suggested_price, sp.base_rate)) /
           SUM(di.actual_occupancy)
    END::numeric, 2
  )                                                             AS avg_adr,
  ROUND(
    SUM(di.actual_occupancy * COALESCE(sp.suggested_price, sp.base_rate)) /
    NULLIF(SUM(di.available_count + di.out_of_service_count + di.actual_occupancy), 0)
    ::numeric, 2
  )                                                             AS avg_revpar,
  ROUND(
    AVG(daily_rev.day_revenue)::numeric, 2
  )                                                             AS avg_daily_revenue,
  MIN(di.inventory_date)::text                                  AS window_start,
  MAX(di.inventory_date)::text                                  AS window_end,
  COUNT(DISTINCT di.inventory_date)                             AS days_counted
FROM daily_inventory di
LEFT JOIN suggested_prices sp
  ON sp.hotel_id = di.hotel_id
 AND sp.date = di.inventory_date
 AND sp.room_type_code = di.room_type_code
LEFT JOIN (
  SELECT
    hotel_id,
    inventory_date,
    SUM(actual_occupancy * COALESCE(sp2.suggested_price, sp2.base_rate)) AS day_revenue
  FROM daily_inventory di2
  LEFT JOIN suggested_prices sp2
    ON sp2.hotel_id = di2.hotel_id
   AND sp2.date = di2.inventory_date
   AND sp2.room_type_code = di2.room_type_code
  WHERE di2.hotel_id IN ('NGH11345', 'ELS270')
    AND di2.inventory_date >= CURRENT_DATE - 31
    AND di2.inventory_date < CURRENT_DATE
  GROUP BY hotel_id, inventory_date
) daily_rev ON daily_rev.hotel_id = di.hotel_id AND daily_rev.inventory_date = di.inventory_date
WHERE di.hotel_id IN ('NGH11345', 'ELS270')
  AND di.inventory_date >= CURRENT_DATE - 31
  AND di.inventory_date < CURRENT_DATE
GROUP BY di.hotel_id
ORDER BY di.hotel_id;


-- ============================================================
-- SECTION 4 — MONTH-TO-DATE (MTD) KPIs
-- Maps to: Morning Briefing → MTD gauge + projected EOM
-- ============================================================

SELECT
  di.hotel_id,
  DATE_TRUNC('month', CURRENT_DATE)::text                       AS mtd_start,
  (CURRENT_DATE - 1)::text                                      AS mtd_end,
  COUNT(DISTINCT di.inventory_date)                             AS days_elapsed,
  EXTRACT(DAY FROM (DATE_TRUNC('month', CURRENT_DATE)
    + INTERVAL '1 month - 1 day'))::int                         AS days_in_month,
  ROUND(
    SUM(di.actual_occupancy)::numeric /
    NULLIF(SUM(di.available_count + di.out_of_service_count + di.actual_occupancy), 0)
    * 100, 1
  )                                                             AS mtd_occupancy_pct,
  ROUND(
    CASE WHEN SUM(di.actual_occupancy) > 0
      THEN SUM(di.actual_occupancy * COALESCE(sp.suggested_price, sp.base_rate)) /
           SUM(di.actual_occupancy)
    END::numeric, 2
  )                                                             AS mtd_adr,
  ROUND(
    SUM(di.actual_occupancy * COALESCE(sp.suggested_price, sp.base_rate)) /
    NULLIF(SUM(di.available_count + di.out_of_service_count + di.actual_occupancy), 0)
    ::numeric, 2
  )                                                             AS mtd_revpar,
  ROUND(
    SUM(di.actual_occupancy * COALESCE(sp.suggested_price, sp.base_rate))::numeric, 2
  )                                                             AS mtd_revenue
FROM daily_inventory di
LEFT JOIN suggested_prices sp
  ON sp.hotel_id = di.hotel_id
 AND sp.date = di.inventory_date
 AND sp.room_type_code = di.room_type_code
WHERE di.hotel_id IN ('NGH11345', 'ELS270')
  AND di.inventory_date >= DATE_TRUNC('month', CURRENT_DATE)
  AND di.inventory_date < CURRENT_DATE
GROUP BY di.hotel_id
ORDER BY di.hotel_id;


-- ============================================================
-- SECTION 5 — TONIGHT ON-THE-BOOKS
-- Maps to: Morning Briefing → "Tonight on-the-books" section
-- UI shows: rooms sold, total rooms, occupancy %, ADR, revenue
-- ============================================================

SELECT
  di.hotel_id,
  CURRENT_DATE::text                                            AS tonight,
  SUM(di.actual_occupancy)                                      AS rooms_sold,
  SUM(di.available_count + di.out_of_service_count
      + di.actual_occupancy)                                    AS total_rooms,
  ROUND(
    SUM(di.actual_occupancy)::numeric /
    NULLIF(SUM(di.available_count + di.out_of_service_count + di.actual_occupancy), 0)
    * 100, 1
  )                                                             AS occupancy_pct,
  ROUND(
    CASE WHEN SUM(di.actual_occupancy) > 0
      THEN SUM(di.actual_occupancy * COALESCE(sp.suggested_price, sp.base_rate)) /
           SUM(di.actual_occupancy)
    END::numeric, 2
  )                                                             AS adr,
  ROUND(
    SUM(di.actual_occupancy * COALESCE(sp.suggested_price, sp.base_rate))::numeric, 2
  )                                                             AS revenue
FROM daily_inventory di
LEFT JOIN suggested_prices sp
  ON sp.hotel_id = di.hotel_id
 AND sp.date = di.inventory_date
 AND sp.room_type_code = di.room_type_code
WHERE di.hotel_id IN ('NGH11345', 'ELS270')
  AND di.inventory_date = CURRENT_DATE
GROUP BY di.hotel_id
ORDER BY di.hotel_id;


-- ============================================================
-- SECTION 6 — STLY AVAILABILITY CHECK
-- Maps to: Morning Briefing → comp label ("STLY" vs "30d avg")
-- Tells you exactly why STLY shows or doesn't show.
-- ============================================================

SELECT
  di.hotel_id,
  (CURRENT_DATE - 364)::text                                    AS stly_date_checked,
  SUM(di.actual_occupancy)                                      AS stly_total_occ,
  COUNT(*)                                                      AS stly_rows,
  CASE WHEN SUM(di.actual_occupancy) > 0
    THEN 'YES — STLY available'
    ELSE 'NO — fallback to 30d avg'
  END                                                           AS stly_status
FROM daily_inventory di
WHERE di.hotel_id IN ('NGH11345', 'ELS270')
  AND di.inventory_date = CURRENT_DATE - 364
GROUP BY di.hotel_id

UNION ALL

-- Also check 365 days back
SELECT
  di.hotel_id,
  (CURRENT_DATE - 365)::text                                    AS stly_date_checked,
  SUM(di.actual_occupancy)                                      AS stly_total_occ,
  COUNT(*)                                                      AS stly_rows,
  CASE WHEN SUM(di.actual_occupancy) > 0
    THEN 'YES — STLY available'
    ELSE 'NO — fallback to 30d avg'
  END                                                           AS stly_status
FROM daily_inventory di
WHERE di.hotel_id IN ('NGH11345', 'ELS270')
  AND di.inventory_date = CURRENT_DATE - 365
GROUP BY di.hotel_id

ORDER BY hotel_id, stly_date_checked;


-- ============================================================
-- SECTION 7 — PENDING APPROVALS
-- Maps to: Home page → Pending Approvals widget + count badge
-- ============================================================

SELECT
  hotel_id,
  COUNT(*)                                                      AS total_pending,
  MIN(created_at)::text                                         AS oldest,
  MAX(created_at)::text                                         AS newest,
  COUNT(CASE WHEN status = 'pending' THEN 1 END)                AS pending_count,
  COUNT(CASE WHEN status = 'approved' THEN 1 END)               AS approved_count,
  COUNT(CASE WHEN status = 'denied' THEN 1 END)                 AS denied_count
FROM auto_publishing_rate_reviews
WHERE hotel_id IN ('NGH11345', 'ELS270')
GROUP BY hotel_id
ORDER BY hotel_id;

-- Detailed pending items (what the UI card shows)
SELECT
  hotel_id,
  id::text,
  room_type_code,
  stay_date::text,
  current_rate,
  suggested_rate,
  ROUND(((suggested_rate - current_rate)::numeric / NULLIF(current_rate, 0)) * 100, 1)
                                                                AS change_pct,
  violation_type,
  status,
  created_at::text
FROM auto_publishing_rate_reviews
WHERE hotel_id IN ('NGH11345', 'ELS270')
  AND status = 'pending'
ORDER BY hotel_id, stay_date
LIMIT 20;


-- ============================================================
-- SECTION 8 — COMP-SET RATE LADDER (next 7 nights)
-- Maps to: Forecast page → Comp-Set Rate Ladder widget
-- Your rate vs each competitor, median, gap %
-- Note: competitor_rates.hotel_id is INTEGER → needs hotels join
-- ============================================================

WITH my_hotel_ids AS (
  SELECT id AS int_id, hotel_id AS str_id
  FROM hotels
  WHERE hotel_id IN ('NGH11345', 'ELS270')
    AND deleted_at IS NULL
),
comp_best AS (
  SELECT
    mhi.str_id                                                  AS hotel_id,
    hcs.competitor_name,
    hcs.is_my_hotel,
    hcs.hotel_class,
    cr.stay_date,
    MIN(cr.rate_value)                                          AS best_rate,
    COUNT(DISTINCT cr.source)                                   AS source_count
  FROM hotel_comp_set hcs
  JOIN my_hotel_ids mhi ON mhi.int_id = hcs.hotel_id
  JOIN competitor_rates cr
    ON cr.competitor_id = hcs.id
   AND cr.hotel_id      = mhi.int_id
   AND cr.stay_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 6
   AND cr.last_seen_at IS NOT NULL
   AND cr.rate_value IS NOT NULL
  GROUP BY mhi.str_id, hcs.competitor_name, hcs.is_my_hotel, hcs.hotel_class, cr.stay_date
)
SELECT
  cb.hotel_id,
  cb.stay_date::text,
  TO_CHAR(cb.stay_date, 'Dy')                                   AS dow,
  cb.competitor_name,
  cb.is_my_hotel,
  cb.hotel_class,
  cb.best_rate,
  cb.source_count,
  ROUND(
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cb2.best_rate)::numeric, 2
  )                                                             AS median_rate,
  ROUND(
    (cb.best_rate - PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cb2.best_rate))
    / NULLIF(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cb2.best_rate), 0)
    * 100::numeric, 1
  )                                                             AS gap_vs_median_pct
FROM comp_best cb
JOIN comp_best cb2
  ON cb2.hotel_id = cb.hotel_id
 AND cb2.stay_date = cb.stay_date
 AND cb2.is_my_hotel = false
GROUP BY cb.hotel_id, cb.stay_date, cb.competitor_name, cb.is_my_hotel,
         cb.hotel_class, cb.best_rate, cb.source_count
ORDER BY cb.hotel_id, cb.stay_date, cb.is_my_hotel DESC, cb.best_rate;


-- ============================================================
-- SECTION 9 — UPCOMING EVENTS (next 30 days)
-- Maps to: Forecast page → Upcoming Events widget
-- events.hotel_id = STRING (direct match)
-- ============================================================

SELECT
  e.hotel_id,
  e.event_id,
  e.title,
  e.category,
  e.start::text                                                 AS start_dt,
  e."end"::text                                                 AS end_dt,
  e.phq_attendance,
  e.local_rank,
  ROUND(e.distance_km::numeric, 1)                              AS distance_km,
  ROUND(e.predicted_accommodation_spend::numeric, 0)            AS predicted_spend,
  dhd.price_flag,
  dhd.impact_total
FROM events e
LEFT JOIN daily_hotel_demand dhd
  ON dhd.hotel_id = e.hotel_id
 AND dhd.date = e.start::date
WHERE e.hotel_id IN ('NGH11345', 'ELS270')
  AND e.start >= CURRENT_TIMESTAMP
  AND e.start <= CURRENT_TIMESTAMP + INTERVAL '30 days'
ORDER BY e.hotel_id, e.start
LIMIT 30;


-- ============================================================
-- SECTION 10 — DEMAND HEATMAP (next 14 days sample)
-- Maps to: Forecast page → 90-day Demand Heatmap
-- Shows occupancy + pace index + price for each date
-- ============================================================

WITH daily AS (
  SELECT
    di.hotel_id,
    di.inventory_date,
    EXTRACT(DOW FROM di.inventory_date)::int                    AS dow,
    TO_CHAR(di.inventory_date, 'Dy')                            AS day_name,
    SUM(di.actual_occupancy)                                    AS total_sold,
    SUM(di.available_count + di.out_of_service_count
        + di.actual_occupancy)                                  AS total_cap,
    ROUND(
      SUM(di.actual_occupancy)::numeric /
      NULLIF(SUM(di.available_count + di.out_of_service_count + di.actual_occupancy), 0)
      * 100, 1
    )                                                           AS occupancy_pct,
    ROUND(
      AVG(COALESCE(sp.suggested_price, sp.base_rate, di.current_price))::numeric, 2
    )                                                           AS avg_price
  FROM daily_inventory di
  LEFT JOIN suggested_prices sp
    ON sp.hotel_id = di.hotel_id
   AND sp.date = di.inventory_date
   AND sp.room_type_code = di.room_type_code
  WHERE di.hotel_id IN ('NGH11345', 'ELS270')
    AND di.inventory_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 13
  GROUP BY di.hotel_id, di.inventory_date
),
hotel_avg AS (
  SELECT
    hotel_id,
    AVG(CASE WHEN total_cap > 0 THEN total_sold::float / total_cap END) AS avg_occ
  FROM daily
  GROUP BY hotel_id
)
SELECT
  d.hotel_id,
  d.inventory_date::text,
  d.day_name,
  d.total_sold                                                  AS rooms_sold,
  d.total_cap                                                   AS total_rooms,
  d.occupancy_pct,
  d.avg_price                                                   AS suggested_price,
  ROUND(
    CASE WHEN ha.avg_occ > 0 AND d.total_cap > 0
      THEN (d.total_sold::float / d.total_cap - ha.avg_occ) / ha.avg_occ * 100
    ELSE 0
    END::numeric, 1
  )                                                             AS pace_index_pct
FROM daily d
JOIN hotel_avg ha ON ha.hotel_id = d.hotel_id
ORDER BY d.hotel_id, d.inventory_date;


-- ============================================================
-- SECTION 11 — BOOKING PICKUP VELOCITY (next 14 nights)
-- Maps to: Forecast page → Booking Pickup widget
-- Shows actual_pickup_last_day per stay date
-- ============================================================

SELECT
  di.hotel_id,
  di.inventory_date::text,
  TO_CHAR(di.inventory_date, 'Dy')                              AS dow,
  SUM(di.actual_pickup_last_day)                                AS pickup_last_day,
  SUM(di.actual_occupancy)                                      AS current_otb,
  SUM(di.available_count + di.out_of_service_count
      + di.actual_occupancy)                                    AS total_cap,
  ROUND(
    SUM(di.actual_occupancy)::numeric /
    NULLIF(SUM(di.available_count + di.out_of_service_count + di.actual_occupancy), 0)
    * 100, 1
  )                                                             AS otb_pct
FROM daily_inventory di
WHERE di.hotel_id IN ('NGH11345', 'ELS270')
  AND di.inventory_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 13
GROUP BY di.hotel_id, di.inventory_date
ORDER BY di.hotel_id, di.inventory_date;


-- ============================================================
-- SECTION 12 — INSIGHTS ENGINE RULE TRIGGERS
-- Shows exactly what data would fire each rule
-- Compare these to what the insights card shows in the UI
-- ============================================================

-- RULE 1: Competitor rate moves ≥15% in last 24h
SELECT
  'NGH11345'                                                    AS hotel_str_id,
  hcs.competitor_name,
  cr.stay_date::text,
  cr.previous_rate,
  cr.rate_value                                                 AS new_rate,
  ROUND(
    (cr.rate_value - cr.previous_rate)::numeric /
    NULLIF(cr.previous_rate, 0) * 100, 1
  )                                                             AS pct_change,
  cr.last_seen_at::text,
  cr.source
FROM competitor_rates cr
JOIN hotel_comp_set hcs ON hcs.id = cr.competitor_id
JOIN hotels h ON h.id = hcs.hotel_id AND h.hotel_id = 'NGH11345'
WHERE cr.previous_rate IS NOT NULL
  AND cr.previous_rate > 0
  AND cr.rate_value IS NOT NULL
  AND ABS((cr.rate_value - cr.previous_rate)::float / cr.previous_rate) >= 0.15
  AND cr.last_seen_at >= NOW() - INTERVAL '24 hours'
  AND cr.stay_date >= CURRENT_DATE
ORDER BY ABS((cr.rate_value - cr.previous_rate)::float / cr.previous_rate) DESC
LIMIT 10

UNION ALL

SELECT
  'ELS270'                                                      AS hotel_str_id,
  hcs.competitor_name,
  cr.stay_date::text,
  cr.previous_rate,
  cr.rate_value                                                 AS new_rate,
  ROUND(
    (cr.rate_value - cr.previous_rate)::numeric /
    NULLIF(cr.previous_rate, 0) * 100, 1
  )                                                             AS pct_change,
  cr.last_seen_at::text,
  cr.source
FROM competitor_rates cr
JOIN hotel_comp_set hcs ON hcs.id = cr.competitor_id
JOIN hotels h ON h.id = hcs.hotel_id AND h.hotel_id = 'ELS270'
WHERE cr.previous_rate IS NOT NULL
  AND cr.previous_rate > 0
  AND cr.rate_value IS NOT NULL
  AND ABS((cr.rate_value - cr.previous_rate)::float / cr.previous_rate) >= 0.15
  AND cr.last_seen_at >= NOW() - INTERVAL '24 hours'
  AND cr.stay_date >= CURRENT_DATE
ORDER BY ABS((cr.rate_value - cr.previous_rate)::float / cr.previous_rate) DESC
LIMIT 10;

-- RULE 2: Stale suggested prices (not updated in >48h, next 7 nights)
SELECT
  hotel_id,
  COUNT(*)                                                      AS stale_rate_count,
  MIN(date)::text                                               AS first_stale_date,
  MIN(updated_at)::text                                         AS oldest_update,
  ROUND(
    EXTRACT(EPOCH FROM (NOW() - MIN(updated_at))) / 3600
  )::text || 'h ago'                                           AS hours_since_update
FROM suggested_prices
WHERE hotel_id IN ('NGH11345', 'ELS270')
  AND date BETWEEN CURRENT_DATE AND CURRENT_DATE + 6
  AND updated_at < NOW() - INTERVAL '48 hours'
GROUP BY hotel_id
ORDER BY hotel_id;

-- RULE 3: Rate position risk — comp is 10%+ cheaper + low OTB
WITH my_rate AS (
  SELECT
    hotel_id,
    date,
    AVG(COALESCE(suggested_price, base_rate))                   AS avg_rate
  FROM suggested_prices
  WHERE hotel_id IN ('NGH11345', 'ELS270')
    AND date BETWEEN CURRENT_DATE AND CURRENT_DATE + 6
  GROUP BY hotel_id, date
),
comp_min AS (
  SELECT
    h.hotel_id                                                  AS str_id,
    cr.stay_date,
    hcs.competitor_name,
    MIN(cr.rate_value)                                          AS min_comp_rate
  FROM competitor_rates cr
  JOIN hotel_comp_set hcs ON hcs.id = cr.competitor_id
  JOIN hotels h ON h.id = hcs.hotel_id
  WHERE h.hotel_id IN ('NGH11345', 'ELS270')
    AND hcs.is_my_hotel = false
    AND cr.stay_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 6
    AND cr.last_seen_at IS NOT NULL
    AND cr.rate_value IS NOT NULL
  GROUP BY h.hotel_id, cr.stay_date, hcs.competitor_name
  ORDER BY MIN(cr.rate_value)
),
night_otb AS (
  SELECT
    hotel_id,
    inventory_date,
    ROUND(
      SUM(actual_occupancy)::numeric /
      NULLIF(SUM(available_count + out_of_service_count + actual_occupancy), 0) * 100, 1
    )                                                           AS otb_pct
  FROM daily_inventory
  WHERE hotel_id IN ('NGH11345', 'ELS270')
    AND inventory_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 6
  GROUP BY hotel_id, inventory_date
)
SELECT
  mr.hotel_id,
  mr.date::text,
  ROUND(mr.avg_rate::numeric, 2)                               AS my_rate,
  cm.competitor_name,
  ROUND(cm.min_comp_rate::numeric, 2)                          AS cheapest_comp_rate,
  ROUND(
    (mr.avg_rate - cm.min_comp_rate) / NULLIF(cm.min_comp_rate, 0) * 100::numeric, 1
  )                                                             AS you_vs_comp_pct,
  no.otb_pct
FROM my_rate mr
JOIN comp_min cm ON cm.str_id = mr.hotel_id AND cm.stay_date = mr.date
LEFT JOIN night_otb no ON no.hotel_id = mr.hotel_id AND no.inventory_date = mr.date
WHERE cm.min_comp_rate < mr.avg_rate * 0.90
  AND (no.otb_pct IS NULL OR no.otb_pct < 70)
ORDER BY mr.hotel_id, mr.date;


-- ============================================================
-- SECTION 13 — 90-DAY ROLLING BASELINE (new fallback)
-- Maps to: New comp label "90d avg (same DOW)" after STLY fix
-- Same day-of-week, last 12 weeks
-- ============================================================

SELECT
  di.hotel_id,
  EXTRACT(DOW FROM di.inventory_date)::int                      AS dow,
  TO_CHAR(MIN(di.inventory_date), 'Dy')                         AS day_name,
  COUNT(DISTINCT di.inventory_date)                             AS weeks_of_data,
  ROUND(
    SUM(di.actual_occupancy)::numeric /
    NULLIF(SUM(di.available_count + di.out_of_service_count + di.actual_occupancy), 0)
    * 100, 1
  )                                                             AS avg_occupancy_pct,
  ROUND(
    CASE WHEN SUM(di.actual_occupancy) > 0
      THEN SUM(di.actual_occupancy * COALESCE(sp.suggested_price, sp.base_rate)) /
           SUM(di.actual_occupancy)
    END::numeric, 2
  )                                                             AS avg_adr,
  ROUND(
    SUM(di.actual_occupancy * COALESCE(sp.suggested_price, sp.base_rate)) /
    NULLIF(SUM(di.available_count + di.out_of_service_count + di.actual_occupancy), 0)
    ::numeric, 2
  )                                                             AS avg_revpar
FROM daily_inventory di
LEFT JOIN suggested_prices sp
  ON sp.hotel_id = di.hotel_id
 AND sp.date = di.inventory_date
 AND sp.room_type_code = di.room_type_code
WHERE di.hotel_id IN ('NGH11345', 'ELS270')
  AND di.inventory_date >= CURRENT_DATE - 84   -- 12 weeks
  AND di.inventory_date < CURRENT_DATE
  AND di.actual_occupancy > 0                  -- only nights with real bookings
GROUP BY di.hotel_id, EXTRACT(DOW FROM di.inventory_date)
ORDER BY di.hotel_id, dow;


-- ============================================================
-- SECTION 14 — REVPAR 14-DAY SPARKLINE
-- Maps to: Property KPI card → RevPAR trend sparkline
-- ============================================================

SELECT
  di.hotel_id,
  di.inventory_date::text,
  ROUND(
    SUM(di.actual_occupancy * COALESCE(sp.suggested_price, sp.base_rate)) /
    NULLIF(SUM(di.available_count + di.out_of_service_count + di.actual_occupancy), 0)
    ::numeric, 2
  )                                                             AS daily_revpar
FROM daily_inventory di
LEFT JOIN suggested_prices sp
  ON sp.hotel_id = di.hotel_id
 AND sp.date = di.inventory_date
 AND sp.room_type_code = di.room_type_code
WHERE di.hotel_id IN ('NGH11345', 'ELS270')
  AND di.inventory_date >= CURRENT_DATE - 14
  AND di.inventory_date < CURRENT_DATE
GROUP BY di.hotel_id, di.inventory_date
ORDER BY di.hotel_id, di.inventory_date;


-- ============================================================
-- SECTION 15 — SUGGESTED PRICES FRESHNESS
-- Maps to: Publishing Health widget + stale pricing rule
-- ============================================================

SELECT
  hotel_id,
  COUNT(*)                                                      AS total_future_prices,
  COUNT(CASE WHEN date >= CURRENT_DATE THEN 1 END)              AS future_prices,
  MIN(CASE WHEN date >= CURRENT_DATE THEN updated_at END)::text AS oldest_future_update,
  MAX(CASE WHEN date >= CURRENT_DATE THEN updated_at END)::text AS newest_future_update,
  COUNT(
    CASE WHEN date >= CURRENT_DATE
          AND updated_at < NOW() - INTERVAL '48 hours' THEN 1 END
  )                                                             AS stale_count_48h,
  COUNT(
    CASE WHEN date >= CURRENT_DATE
          AND updated_at < NOW() - INTERVAL '24 hours' THEN 1 END
  )                                                             AS stale_count_24h
FROM suggested_prices
WHERE hotel_id IN ('NGH11345', 'ELS270')
GROUP BY hotel_id
ORDER BY hotel_id;


-- ============================================================
-- END OF VERIFICATION SCRIPT
-- Every number above should match what the UI shows.
-- If a value differs, the query above is the ground truth.
-- ============================================================
