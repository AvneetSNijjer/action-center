/**
 * scripts/hotel-history-audit.js
 * Queries the Ampliphi read-replica to produce a hotel data-history audit.
 * Outputs: hotel-history-audit.xlsx on the Desktop
 *
 * Run: node scripts/hotel-history-audit.js
 */

require("dotenv").config({ path: ".env.local" });

const { Client } = require("pg");
const ExcelJS   = require("exceljs");
const path      = require("path");
const os        = require("os");

// ── DB connection ──────────────────────────────────────────────────────────
const client = new Client({
  connectionString: process.env.AMPLIPHI_DB_URL,
  ssl: { rejectUnauthorized: false },
  statement_timeout: 30000,
});

// ── helpers ────────────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return "—";
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt)) return "—";
  return dt.toISOString().split("T")[0];   // YYYY-MM-DD
}

function daysSince(d) {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt)) return null;
  return Math.floor((Date.now() - dt.getTime()) / 86400000);
}

function dataQualityLabel(row) {
  if (!row.first_real_date) return "❌  No real data";
  if (Number(row.real_rows) < 30) return "🟠  Very sparse";
  const days = daysSince(row.first_real_date);
  if (days !== null && days < 60) return "🟡  Recent only";
  return "✅  Good";
}

// ── main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log("🔌  Connecting to DB…");
  await client.connect();
  console.log("✅  Connected.\n");

  // 1. Hotel master list ── name, city, country
  console.log("📋  Fetching hotel list…");
  const hotelsRes = await client.query(`
    SELECT
      h.hotel_id,
      h.name,
      h.location,
      h.country,
      h.id AS hotel_pk
    FROM hotels h
    WHERE h.deleted_at IS NULL
    ORDER BY h.hotel_id
  `);
  const hotels = hotelsRes.rows;
  console.log(`    → ${hotels.length} hotels found`);

  // 2. Daily-inventory history per hotel (string hotel_id)
  console.log("📅  Querying daily_inventory history (this may take ~10 s)…");
  const invRes = await client.query(`
    SELECT
      di.hotel_id,
      MIN(di.inventory_date)                                              AS earliest_row,
      MAX(di.inventory_date)                                              AS latest_row,
      COUNT(*)                                                            AS total_rows,
      -- first date where ANY actual_occupancy > 0
      MIN(CASE WHEN COALESCE(di.actual_occupancy, 0) > 0
               THEN di.inventory_date END)                                AS first_real_date,
      MAX(CASE WHEN COALESCE(di.actual_occupancy, 0) > 0
               THEN di.inventory_date END)                                AS last_real_date,
      COUNT(CASE WHEN COALESCE(di.actual_occupancy, 0) > 0 THEN 1 END)   AS real_rows,
      COUNT(CASE WHEN COALESCE(di.actual_occupancy, 0) = 0 THEN 1 END)   AS phantom_rows
    FROM daily_inventory di
    GROUP BY di.hotel_id
  `);

  // index by hotel_id string
  const inv = {};
  for (const r of invRes.rows) inv[r.hotel_id] = r;
  console.log(`    → history data for ${invRes.rows.length} hotel IDs`);

  // 3. Suggested-prices latest update per hotel
  console.log("💲  Querying suggested_prices freshness…");
  const spRes = await client.query(`
    SELECT
      hotel_id,
      MAX(updated_at) AS sp_last_updated,
      COUNT(*)        AS sp_rows
    FROM suggested_prices
    GROUP BY hotel_id
  `);
  const sp = {};
  for (const r of spRes.rows) sp[r.hotel_id] = r;

  // 4. ── DB Cleanup Audit queries ──────────────────────────────────────────
  console.log("🧹  Running DB cleanup audit queries…");

  // 4a. Phantom-only rows before first real date (safe to delete)
  console.log("    → phantom rows before first real booking…");
  const phantomBeforeRealRes = await client.query(`
    WITH first_real AS (
      SELECT hotel_id, MIN(inventory_date) AS first_real_date
      FROM daily_inventory
      WHERE COALESCE(actual_occupancy, 0) > 0
      GROUP BY hotel_id
    )
    SELECT
      di.hotel_id,
      COUNT(*) AS deletable_rows,
      MIN(di.inventory_date) AS from_date,
      MAX(di.inventory_date) AS to_date
    FROM daily_inventory di
    JOIN first_real fr ON fr.hotel_id = di.hotel_id
    WHERE di.inventory_date < fr.first_real_date
      AND COALESCE(di.actual_occupancy, 0) = 0
    GROUP BY di.hotel_id
    ORDER BY deletable_rows DESC
  `);

  // 4b. Hotels with zero real data and inventory rows (all phantom, delete all)
  console.log("    → hotels with only phantom inventory rows…");
  const allPhantomRes = await client.query(`
    SELECT
      di.hotel_id,
      COUNT(*) AS total_rows,
      MIN(di.inventory_date) AS from_date,
      MAX(di.inventory_date) AS to_date
    FROM daily_inventory di
    GROUP BY di.hotel_id
    HAVING SUM(CASE WHEN COALESCE(di.actual_occupancy, 0) > 0 THEN 1 ELSE 0 END) = 0
    ORDER BY total_rows DESC
  `);

  // 4c. Duplicate rows — same hotel_id + inventory_date
  console.log("    → duplicate inventory rows…");
  const duplicatesRes = await client.query(`
    SELECT
      hotel_id,
      inventory_date,
      COUNT(*) AS dup_count
    FROM daily_inventory
    GROUP BY hotel_id, inventory_date
    HAVING COUNT(*) > 1
    ORDER BY dup_count DESC
    LIMIT 200
  `);

  // 4d. Deleted hotels still with active inventory rows
  console.log("    → deleted hotels with orphaned inventory…");
  const deletedHotelsInvRes = await client.query(`
    SELECT
      h.hotel_id,
      h.name,
      h.deleted_at,
      COUNT(di.id) AS inventory_rows
    FROM hotels h
    JOIN daily_inventory di ON di.hotel_id = h.hotel_id
    WHERE h.deleted_at IS NOT NULL
    GROUP BY h.hotel_id, h.name, h.deleted_at
    ORDER BY inventory_rows DESC
  `).catch(() => ({ rows: [] }));

  // 4e. Orphaned suggested_prices (hotel_id not in hotels table)
  console.log("    → orphaned suggested_prices…");
  const orphanedSpRes = await client.query(`
    SELECT
      sp.hotel_id,
      COUNT(*) AS row_count,
      MAX(sp.updated_at) AS last_updated
    FROM suggested_prices sp
    WHERE NOT EXISTS (SELECT 1 FROM hotels h WHERE h.hotel_id = sp.hotel_id)
    GROUP BY sp.hotel_id
    ORDER BY row_count DESC
  `).catch(() => ({ rows: [] }));

  // 4f. Orphaned events (hotel_id not in hotels table)
  console.log("    → orphaned events…");
  const orphanedEventsRes = await client.query(`
    SELECT
      e.hotel_id,
      COUNT(*) AS row_count
    FROM events e
    WHERE NOT EXISTS (SELECT 1 FROM hotels h WHERE h.hotel_id = e.hotel_id)
    GROUP BY e.hotel_id
    ORDER BY row_count DESC
  `).catch(() => ({ rows: [] }));

  // 4g. Stale competitor_rates (older than 90 days)
  console.log("    → stale competitor rates (>90 days old)…");
  const staleCompRes = await client.query(`
    SELECT
      h.hotel_id,
      h.name,
      COUNT(cr.id) AS stale_rows,
      MIN(cr.check_in_date) AS earliest_date,
      MAX(cr.check_in_date) AS latest_date
    FROM competitor_rates cr
    JOIN hotels h ON h.id = cr.hotel_id
    WHERE cr.check_in_date < CURRENT_DATE - INTERVAL '90 days'
    GROUP BY h.hotel_id, h.name
    ORDER BY stale_rows DESC
  `).catch(() => ({ rows: [] }));

  // 4h. Hotels with no suggested prices at all
  console.log("    → hotels with no suggested prices…");
  const noSpRes = await client.query(`
    SELECT h.hotel_id, h.name, h.location
    FROM hotels h
    WHERE h.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM suggested_prices sp WHERE sp.hotel_id = h.hotel_id)
    ORDER BY h.hotel_id
  `);

  await client.end();
  console.log("🔌  DB connection closed.\n");

  // ── Build workbook ───────────────────────────────────────────────────────
  console.log("📊  Building Excel workbook…");
  const wb = new ExcelJS.Workbook();
  wb.creator = "Ampliphi Data Audit Script";
  wb.created  = new Date();

  // ─────────────────────────────────────────────────
  // SHEET 1 — Full hotel history audit
  // ─────────────────────────────────────────────────
  const ws = wb.addWorksheet("Hotel History Audit", {
    views: [{ state: "frozen", xSplit: 0, ySplit: 2 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  // Column definitions
  ws.columns = [
    { header: "Hotel ID",          key: "hotel_id",         width: 16 },
    { header: "Hotel Name",        key: "hotel_name",       width: 36 },
    { header: "Location",          key: "city",             width: 22 },
    { header: "Country",           key: "country",          width: 12 },
    { header: "Data Quality",      key: "quality",          width: 18 },
    // Phantom (all rows)
    { header: "Earliest Row",      key: "earliest_row",     width: 14 },
    { header: "Latest Row",        key: "latest_row",       width: 14 },
    { header: "Total Rows",        key: "total_rows",       width: 12 },
    { header: "Phantom Rows",      key: "phantom_rows",     width: 14 },
    // Real data
    { header: "First Real Date",   key: "first_real_date",  width: 16 },
    { header: "Last Real Date",    key: "last_real_date",   width: 16 },
    { header: "Real Rows",         key: "real_rows",        width: 12 },
    { header: "Days Since Real",   key: "days_since_real",  width: 16 },
    // Gap between phantom start and real start
    { header: "Phantom-only Days", key: "phantom_gap",      width: 18 },
    // Suggested prices
    { header: "SP Last Updated",   key: "sp_last_updated",  width: 20 },
    { header: "SP Rows",           key: "sp_rows",          width: 12 },
    // Action
    { header: "PMS Contact Needed?", key: "pms_needed",     width: 20 },
  ];

  // Header row style (row 1 = ExcelJS auto-header)
  const headerRow = ws.getRow(1);
  headerRow.height = 32;
  headerRow.eachCell((cell) => {
    cell.font  = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      bottom: { style: "medium", color: { argb: "FF0066CC" } },
    };
  });

  // Section sub-headers (row 2 — merged label groups)
  ws.insertRow(1, []);   // blank placeholder — we fill after data
  const groupRow = ws.getRow(1);
  groupRow.height = 18;

  // We'll style this row after data is added

  // Colours for quality
  const QUALITY_FILL = {
    "✅  Good":        { argb: "FFD4EDDA" },
    "🟡  Recent only": { argb: "FFFFF3CD" },
    "🟠  Very sparse": { argb: "FFFFDBB5" },
    "❌  No real data":{ argb: "FFF8D7DA" },
  };
  const QUALITY_FONT_COLOR = {
    "✅  Good":        { argb: "FF155724" },
    "🟡  Recent only": { argb: "FF856404" },
    "🟠  Very sparse": { argb: "FF8B4513" },
    "❌  No real data":{ argb: "FF721C24" },
  };

  // Data rows
  let rowIdx = 3;  // row 1 = group headers, row 2 = col headers
  for (const h of hotels) {
    const i   = inv[h.hotel_id] || {};
    const s   = sp[h.hotel_id]  || {};
    const ql  = dataQualityLabel(i);

    const earliestDt    = i.earliest_row   ? new Date(i.earliest_row)    : null;
    const firstRealDt   = i.first_real_date? new Date(i.first_real_date) : null;
    const lastRealDt    = i.last_real_date  ? new Date(i.last_real_date)  : null;
    const latestDt      = i.latest_row      ? new Date(i.latest_row)      : null;
    const spUpdDt       = s.sp_last_updated ? new Date(s.sp_last_updated): null;
    const daysSinceReal = daysSince(lastRealDt);

    // Phantom-only gap: days between earliest_row and first_real_date
    const phantomGap = (earliestDt && firstRealDt)
      ? Math.floor((firstRealDt - earliestDt) / 86400000)
      : (earliestDt ? daysSince(earliestDt) : null);  // if no real data, all phantom

    const pmsNeeded = (!i.first_real_date || Number(i.real_rows) < 30) ? "YES — contact PMS" : "";

    const row = ws.getRow(rowIdx++);
    row.values = [
      h.hotel_id,
      h.name || "(unnamed)",
      h.location  || "",
      h.country || "",
      ql,
      fmtDate(earliestDt),
      fmtDate(latestDt),
      Number(i.total_rows)   || 0,
      Number(i.phantom_rows) || 0,
      fmtDate(firstRealDt),
      fmtDate(lastRealDt),
      Number(i.real_rows)    || 0,
      daysSinceReal !== null ? daysSinceReal : "—",
      phantomGap !== null ? phantomGap : "—",
      spUpdDt ? spUpdDt.toISOString().replace("T", " ").substring(0, 19) : "—",
      Number(s.sp_rows) || 0,
      pmsNeeded,
    ];
    row.height = 18;

    // Quality cell styling
    const qualCell = row.getCell("quality");
    qualCell.fill  = { type: "pattern", pattern: "solid", fgColor: QUALITY_FILL[ql] || { argb: "FFFFFFFF" } };
    qualCell.font  = { bold: true, color: QUALITY_FONT_COLOR[ql] || { argb: "FF000000" } };

    // PMS needed — highlight in red if yes
    if (pmsNeeded) {
      const pmsCell = row.getCell("pms_needed");
      pmsCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8D7DA" } };
      pmsCell.font = { bold: true, color: { argb: "FF721C24" } };
    }

    // Phantom gap — amber if > 180 days
    if (typeof phantomGap === "number" && phantomGap > 180) {
      const pgCell = row.getCell("phantom_gap");
      pgCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3CD" } };
    }

    // Zebra stripes
    if (rowIdx % 2 === 0) {
      row.eachCell({ includeEmpty: true }, (cell) => {
        if (!cell.fill || cell.fill.fgColor?.argb === "FFFFFFFF" || !cell.fill.fgColor) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFB" } };
        }
      });
    }

    // Borders
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
      };
      cell.alignment = { vertical: "middle" };
    });

    // Numbers aligned right
    for (const col of ["total_rows","phantom_rows","real_rows","days_since_real","phantom_gap","sp_rows"]) {
      row.getCell(col).alignment = { vertical: "middle", horizontal: "right" };
    }
  }

  // ── Group header row (row 1) ──────────────────────────────────────────────
  // Merge cells for each group label
  const merges = [
    { s: "A1", e: "D1", label: "Hotel Info",         color: "FF1E3A5F" },
    { s: "E1", e: "E1", label: "",                    color: "FF1E3A5F" },
    { s: "F1", e: "I1", label: "All Inventory Rows (incl. phantom zeros)", color: "FF2C5282" },
    { s: "J1", e: "M1", label: "Real Data (actual_occupancy > 0)",          color: "FF276749" },
    { s: "N1", e: "N1", label: "Phantom Gap",          color: "FF744210" },
    { s: "O1", e: "P1", label: "Suggested Prices",     color: "FF553C9A" },
    { s: "Q1", e: "Q1", label: "Action",               color: "FF742A2A" },
  ];
  for (const m of merges) {
    if (m.s !== m.e) ws.mergeCells(`${m.s}:${m.e}`);
    const cell = ws.getCell(m.s);
    cell.value = m.label;
    cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: m.color } };
    cell.font  = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = { bottom: { style: "thin", color: { argb: "FF6699CC" } } };
  }

  // Re-style the actual column header row (row 2)
  const colHeaderRow = ws.getRow(2);
  colHeaderRow.height = 28;
  colHeaderRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.font  = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2D3748" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      bottom: { style: "medium", color: { argb: "FF0066CC" } },
    };
  });

  // Add auto-filter to row 2
  ws.autoFilter = { from: "A2", to: "Q2" };

  // ─────────────────────────────────────────────────
  // SHEET 2 — Summary / Stats
  // ─────────────────────────────────────────────────
  const ws2 = wb.addWorksheet("Summary Stats");

  const totalHotels     = hotels.length;
  const goodHotels      = hotels.filter(h => dataQualityLabel(inv[h.hotel_id] || {}) === "✅  Good").length;
  const recentHotels    = hotels.filter(h => dataQualityLabel(inv[h.hotel_id] || {}) === "🟡  Recent only").length;
  const sparseHotels    = hotels.filter(h => dataQualityLabel(inv[h.hotel_id] || {}) === "🟠  Very sparse").length;
  const noDataHotels    = hotels.filter(h => dataQualityLabel(inv[h.hotel_id] || {}) === "❌  No real data").length;
  const pmsContactList  = hotels.filter(h => {
    const i = inv[h.hotel_id] || {};
    return !i.first_real_date || Number(i.real_rows) < 30;
  });

  ws2.columns = [
    { key: "label", width: 40 },
    { key: "value", width: 20 },
  ];

  const summaryData = [
    ["AMPLIPHI — HOTEL DATA HISTORY AUDIT", ""],
    [`Generated: ${new Date().toISOString().split("T")[0]}`, ""],
    ["", ""],
    ["OVERALL COUNTS", ""],
    ["Total hotels", totalHotels],
    ["✅  Good history (≥30 real rows, >60 days)", goodHotels],
    ["🟡  Recent data only (<60 days)", recentHotels],
    ["🟠  Very sparse (<30 real rows)", sparseHotels],
    ["❌  No real data at all", noDataHotels],
    ["", ""],
    ["PMS CONTACT LIST (hotels to chase)", ""],
    ["Hotels needing PMS outreach", pmsContactList.length],
    ["", ""],
  ];

  for (const [label, value] of summaryData) {
    const r = ws2.addRow([label, value]);
    if (label === "AMPLIPHI — HOTEL DATA HISTORY AUDIT") {
      r.height = 28;
      r.getCell(1).font = { bold: true, size: 14, color: { argb: "FF1E3A5F" } };
    } else if (label === "OVERALL COUNTS" || label === "PMS CONTACT LIST (hotels to chase)") {
      r.height = 22;
      r.getCell(1).font = { bold: true, size: 11, color: { argb: "FF2C5282" } };
      r.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F0FE" } };
    } else if (value !== "") {
      r.getCell(2).alignment = { horizontal: "right" };
      r.getCell(2).font = { bold: true };
    }
  }

  // PMS contact hotel list
  ws2.addRow(["Hotel ID", "Hotel Name", "City", "Quality", "Real Rows", "First Real Date", "Notes"]);
  const pmsHeader = ws2.lastRow;
  pmsHeader.height = 22;
  pmsHeader.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF721C24" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  for (const h of pmsContactList) {
    const i  = inv[h.hotel_id] || {};
    const ql = dataQualityLabel(i);
    const notes = !i.first_real_date
      ? "Zero real occupancy data — request full history from PMS"
      : `Only ${i.real_rows} real rows — request older reservation history`;
    const row = ws2.addRow([
      h.hotel_id,
      h.name || "(unnamed)",
      h.location || "",
      ql,
      Number(i.real_rows) || 0,
      fmtDate(i.first_real_date),
      notes,
    ]);
    row.height = 18;
    row.getCell(4).fill = { type: "pattern", pattern: "solid", fgColor: QUALITY_FILL[ql] || { argb: "FFFFFFFF" } };
    row.getCell(4).font = { color: QUALITY_FONT_COLOR[ql] || { argb: "FF000000" } };
  }

  ws2.columns = [
    { key: "a", width: 16 },
    { key: "b", width: 36 },
    { key: "c", width: 18 },
    { key: "d", width: 18 },
    { key: "e", width: 12 },
    { key: "f", width: 16 },
    { key: "g", width: 55 },
  ];

  // ─────────────────────────────────────────────────
  // SHEET 3 — DB Cleanup Actions
  // ─────────────────────────────────────────────────
  const ws3 = wb.addWorksheet("DB Cleanup Actions", {
    views: [{ state: "frozen", xSplit: 0, ySplit: 3 }],
  });

  // Helper: add a section header spanning all columns
  function addSectionHeader(sheet, label, color, rowCount, safeToDelete) {
    const r1 = sheet.addRow([label, "", "", "", "", "", ""]);
    r1.height = 24;
    sheet.mergeCells(`A${r1.number}:G${r1.number}`);
    r1.getCell(1).font  = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
    r1.getCell(1).fill  = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
    r1.getCell(1).alignment = { vertical: "middle" };

    const r2 = sheet.addRow([
      `${rowCount} issue(s) found`,
      safeToDelete ? "✅ Safe to DELETE" : "⚠️ Review before deleting",
      "", "", "", "", ""
    ]);
    r2.height = 18;
    r2.getCell(1).font = { italic: true, color: { argb: "FF555555" } };
    r2.getCell(2).font = { bold: true, color: safeToDelete ? { argb: "FF155724" } : { argb: "FF856404" } };
    return r2.number + 1;  // next available row
  }

  // Helper: add column header row
  function addColHeaders(sheet, cols, bgColor) {
    const r = sheet.addRow(cols);
    r.height = 20;
    r.eachCell({ includeEmpty: true }, (cell) => {
      cell.font  = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = { bottom: { style: "thin", color: { argb: "FFB0B0B0" } } };
    });
  }

  // Helper: add a data row with light zebra
  let _cleanupRowCount = 0;
  function addDataRow(sheet, values, highlight) {
    const r = sheet.addRow(values);
    r.height = 17;
    const isOdd = (_cleanupRowCount++ % 2 === 0);
    r.eachCell({ includeEmpty: true }, (cell) => {
      cell.alignment = { vertical: "middle" };
      if (!cell.fill || !cell.fill.fgColor) {
        cell.fill = { type: "pattern", pattern: "solid",
          fgColor: { argb: isOdd ? "FFFAFAFA" : "FFFFFFFF" } };
      }
      cell.border = { bottom: { style: "hair", color: { argb: "FFE8E8E8" } } };
    });
    if (highlight) {
      r.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: highlight } };
    }
    return r;
  }

  function addBlankRow(sheet) {
    const r = sheet.addRow(["", "", "", "", "", "", ""]);
    r.height = 10;
    _cleanupRowCount = 0;
  }

  ws3.columns = [
    { key: "a", width: 18 },
    { key: "b", width: 36 },
    { key: "c", width: 22 },
    { key: "d", width: 16 },
    { key: "e", width: 16 },
    { key: "f", width: 14 },
    { key: "g", width: 55 },
  ];

  // Title row
  const titleRow = ws3.addRow(["🧹  Ampliphi DB Cleanup Action Plan", "", "", "", "", "", ""]);
  ws3.mergeCells(`A1:G1`);
  titleRow.height = 30;
  titleRow.getCell(1).font  = { bold: true, size: 14, color: { argb: "FF1E3A5F" } };
  titleRow.getCell(1).alignment = { vertical: "middle" };
  const subRow = ws3.addRow([`Generated: ${new Date().toISOString().split("T")[0]} — Read-only audit. No changes have been made.`, "", "", "", "", "", ""]);
  ws3.mergeCells(`A2:G2`);
  subRow.getCell(1).font = { italic: true, color: { argb: "FF777777" } };
  addBlankRow(ws3);

  // ── SECTION 1: Phantom rows before first real booking ──────────────────
  addSectionHeader(ws3, "1.  Pre-booking Phantom Rows  (daily_inventory rows before first real sale)",
    "FF2C5282", phantomBeforeRealRes.rows.length, true);
  addColHeaders(ws3, ["Hotel ID", "Hotel Name", "Location", "Rows to Delete", "From Date", "To Date", "Recommended Action"], "FF2D3748");
  for (const r of phantomBeforeRealRes.rows) {
    const h = hotels.find(x => x.hotel_id === r.hotel_id) || {};
    addDataRow(ws3, [
      r.hotel_id,
      h.name || "(unknown)",
      h.location || "",
      Number(r.deletable_rows),
      fmtDate(r.from_date),
      fmtDate(r.to_date),
      `DELETE FROM daily_inventory WHERE hotel_id = '${r.hotel_id}' AND inventory_date < '${fmtDate(inv[r.hotel_id]?.first_real_date)}' AND actual_occupancy = 0`,
    ]);
  }
  if (phantomBeforeRealRes.rows.length === 0) addDataRow(ws3, ["— No issues found —", "", "", "", "", "", ""]);
  addBlankRow(ws3);

  // ── SECTION 2: Hotels with ALL phantom rows ────────────────────────────
  addSectionHeader(ws3, "2.  Hotels With Zero Real Data  (entire daily_inventory dataset is phantom zeros)",
    "FF742A2A", allPhantomRes.rows.length, true);
  addColHeaders(ws3, ["Hotel ID", "Hotel Name", "Location", "Total Rows", "From Date", "To Date", "Recommended Action"], "FF2D3748");
  for (const r of allPhantomRes.rows) {
    const h = hotels.find(x => x.hotel_id === r.hotel_id) || {};
    addDataRow(ws3, [
      r.hotel_id,
      h.name || "(unknown)",
      h.location || "",
      Number(r.total_rows),
      fmtDate(r.from_date),
      fmtDate(r.to_date),
      `DELETE FROM daily_inventory WHERE hotel_id = '${r.hotel_id}'  — OR contact PMS first`,
    ], "FFF8D7DA");
  }
  if (allPhantomRes.rows.length === 0) addDataRow(ws3, ["— No issues found —", "", "", "", "", "", ""]);
  addBlankRow(ws3);

  // ── SECTION 3: Duplicate rows ──────────────────────────────────────────
  addSectionHeader(ws3, "3.  Duplicate Inventory Rows  (same hotel_id + inventory_date appears more than once)",
    "FF744210", duplicatesRes.rows.length, false);
  addColHeaders(ws3, ["Hotel ID", "Inventory Date", "Duplicate Count", "", "", "", "Recommended Action"], "FF2D3748");
  for (const r of duplicatesRes.rows) {
    addDataRow(ws3, [
      r.hotel_id,
      fmtDate(r.inventory_date),
      Number(r.dup_count),
      "", "", "",
      `Keep the row with highest actual_occupancy; delete the rest. Requires manual review.`,
    ], "FFFFF3CD");
  }
  if (duplicatesRes.rows.length === 0) addDataRow(ws3, ["— No duplicates found ✅", "", "", "", "", "", ""]);
  addBlankRow(ws3);

  // ── SECTION 4: Deleted hotels with orphaned inventory ─────────────────
  addSectionHeader(ws3, "4.  Deleted Hotels With Orphaned Inventory  (hotel.deleted_at is set but rows still exist)",
    "FF553C9A", deletedHotelsInvRes.rows.length, true);
  addColHeaders(ws3, ["Hotel ID", "Hotel Name", "Deleted At", "Inventory Rows", "", "", "Recommended Action"], "FF2D3748");
  for (const r of deletedHotelsInvRes.rows) {
    addDataRow(ws3, [
      r.hotel_id,
      r.name || "(unknown)",
      fmtDate(r.deleted_at),
      Number(r.inventory_rows),
      "", "",
      `DELETE FROM daily_inventory WHERE hotel_id = '${r.hotel_id}'`,
    ], "FFEDE9FE");
  }
  if (deletedHotelsInvRes.rows.length === 0) addDataRow(ws3, ["— No issues found ✅", "", "", "", "", "", ""]);
  addBlankRow(ws3);

  // ── SECTION 5: Orphaned suggested_prices ──────────────────────────────
  addSectionHeader(ws3, "5.  Orphaned Suggested Prices  (hotel_id exists in suggested_prices but not in hotels table)",
    "FF276749", orphanedSpRes.rows.length, true);
  addColHeaders(ws3, ["Hotel ID", "Row Count", "Last Updated", "", "", "", "Recommended Action"], "FF2D3748");
  for (const r of orphanedSpRes.rows) {
    addDataRow(ws3, [
      r.hotel_id,
      Number(r.row_count),
      r.last_updated ? new Date(r.last_updated).toISOString().split("T")[0] : "—",
      "", "", "",
      `DELETE FROM suggested_prices WHERE hotel_id = '${r.hotel_id}'`,
    ]);
  }
  if (orphanedSpRes.rows.length === 0) addDataRow(ws3, ["— No orphans found ✅", "", "", "", "", "", ""]);
  addBlankRow(ws3);

  // ── SECTION 6: Orphaned events ────────────────────────────────────────
  addSectionHeader(ws3, "6.  Orphaned Events  (hotel_id in events table has no matching hotel)",
    "FF276749", orphanedEventsRes.rows.length, true);
  addColHeaders(ws3, ["Hotel ID", "Row Count", "", "", "", "", "Recommended Action"], "FF2D3748");
  for (const r of orphanedEventsRes.rows) {
    addDataRow(ws3, [
      r.hotel_id,
      Number(r.row_count),
      "", "", "", "",
      `DELETE FROM events WHERE hotel_id = '${r.hotel_id}'`,
    ]);
  }
  if (orphanedEventsRes.rows.length === 0) addDataRow(ws3, ["— No orphans found ✅", "", "", "", "", "", ""]);
  addBlankRow(ws3);

  // ── SECTION 7: Stale competitor rates ─────────────────────────────────
  addSectionHeader(ws3, "7.  Stale Competitor Rates  (check_in_date older than 90 days — no longer useful for pricing)",
    "FF1A365D", staleCompRes.rows.length, true);
  addColHeaders(ws3, ["Hotel ID", "Hotel Name", "Stale Rows", "Earliest Date", "Latest Date", "", "Recommended Action"], "FF2D3748");
  for (const r of staleCompRes.rows) {
    addDataRow(ws3, [
      r.hotel_id,
      r.name || "(unknown)",
      Number(r.stale_rows),
      fmtDate(r.earliest_date),
      fmtDate(r.latest_date),
      "",
      `DELETE FROM competitor_rates WHERE hotel_id = (SELECT id FROM hotels WHERE hotel_id = '${r.hotel_id}') AND check_in_date < CURRENT_DATE - INTERVAL '90 days'`,
    ]);
  }
  if (staleCompRes.rows.length === 0) addDataRow(ws3, ["— No stale rates found ✅", "", "", "", "", "", ""]);
  addBlankRow(ws3);

  // ── SECTION 8: Hotels with no suggested prices ────────────────────────
  addSectionHeader(ws3, "8.  Hotels With No Suggested Prices  (pricing engine never ran or PMS integration broken)",
    "FF1A365D", noSpRes.rows.length, false);
  addColHeaders(ws3, ["Hotel ID", "Hotel Name", "Location", "", "", "", "Recommended Action"], "FF2D3748");
  for (const r of noSpRes.rows) {
    addDataRow(ws3, [
      r.hotel_id,
      r.name || "(unknown)",
      r.location || "",
      "", "", "",
      "Check PMS integration / re-run pricing engine for this hotel",
    ], "FFFFF3CD");
  }
  if (noSpRes.rows.length === 0) addDataRow(ws3, ["— All hotels have suggested prices ✅", "", "", "", "", "", ""]);
  addBlankRow(ws3);

  // ── SAVE FILE ──────────────────────────────────────────────────────────
  const outPath = path.join(os.homedir(), "Desktop", "Ampliphi_Hotel_History_Audit.xlsx");
  await wb.xlsx.writeFile(outPath);
  console.log(`\n✅  Excel file saved to:\n    ${outPath}`);
  console.log(`\n📊  Summary:`);
  console.log(`    Total hotels:              ${totalHotels}`);
  console.log(`    ✅  Good history:          ${goodHotels}`);
  console.log(`    🟡  Recent only:           ${recentHotels}`);
  console.log(`    🟠  Very sparse:           ${sparseHotels}`);
  console.log(`    ❌  No real data:          ${noDataHotels}`);
  console.log(`    PMS outreach needed:       ${pmsContactList.length}`);
  console.log(`\n🧹  Cleanup issues found:`);
  console.log(`    Pre-booking phantom rows:  ${phantomBeforeRealRes.rows.length} hotels affected`);
  console.log(`    All-phantom hotels:        ${allPhantomRes.rows.length} hotels`);
  console.log(`    Duplicate inventory rows:  ${duplicatesRes.rows.length} date conflicts`);
  console.log(`    Deleted hotel orphans:     ${deletedHotelsInvRes.rows.length} hotels`);
  console.log(`    Orphaned suggested prices: ${orphanedSpRes.rows.length} hotel IDs`);
  console.log(`    Orphaned events:           ${orphanedEventsRes.rows.length} hotel IDs`);
  console.log(`    Stale competitor rates:    ${staleCompRes.rows.length} hotels`);
  console.log(`    No suggested prices:       ${noSpRes.rows.length} hotels`);
}

main().catch((err) => {
  console.error("❌  Fatal error:", err.message);
  process.exit(1);
});
