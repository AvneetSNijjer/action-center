/**
 * /verify — Live DB number verification page.
 *
 * Open this page and compare every row against what the Action Center shows.
 * All numbers come directly from the DB with no caching (force-dynamic).
 * Refresh the page to get a fresh read.
 */
import { getVerificationSnapshot } from "@/lib/queries/action-center";

const HOTEL_ID = process.env.DEFAULT_HOTEL_ID ?? "AI3786";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function fmt(n: number | null, prefix = ""): string {
  if (n == null) return "—";
  return `${prefix}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtPct(n: number | null): string {
  if (n == null) return "—";
  return `${n.toFixed(2)}%`;
}
function fmtInt(n: number): string {
  return n.toLocaleString("en-US");
}

export default async function VerifyPage() {
  let snap;
  let error: string | null = null;
  try {
    snap = await getVerificationSnapshot(HOTEL_ID);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  if (error || !snap) {
    return (
      <div className="p-8 font-mono text-sm text-red-600">
        <h1 className="text-xl font-bold mb-4">DB Verification — Error</h1>
        <pre>{error}</pre>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 font-mono text-sm">
      <div>
        <h1 className="text-2xl font-bold mb-1">DB Verification Snapshot</h1>
        <p className="text-muted-foreground text-xs">
          Hotel: <strong>{snap.hotelId}</strong> · Queried: {snap.asOf} UTC ·{" "}
          <span className="text-amber-600">No cache — direct DB read every page load</span>
        </p>
      </div>

      {/* Yesterday */}
      <Section title={`Yesterday  (${snap.yesterday.date})`} color="blue">
        <Row label="Occupancy"  value={fmtPct(snap.yesterday.occ)}           note="actual_occ / capacity × 100" />
        <Row label="ADR"        value={fmt(snap.yesterday.adr, "$")}          note="revenue / rooms_sold" />
        <Row label="RevPAR"     value={fmt(snap.yesterday.revpar, "$")}       note="revenue / capacity" />
        <Row label="Revenue"    value={fmt(snap.yesterday.revenue, "$")}      note="actual_occ × COALESCE(suggested_price, base_rate)" />
        <Row label="Rooms sold" value={fmtInt(snap.yesterday.roomsSold)}      note="SUM(actual_occupancy)" />
        <Row label="Total rooms" value={fmtInt(snap.yesterday.totalRooms)}    note="SUM(avail + oos + sold)" />
      </Section>

      {/* 30-day rolling average */}
      <Section title="30-day Rolling Average  (comparison baseline)" color="purple">
        <Row label="Occupancy"      value={fmtPct(snap.avg30.occ)}            note="last 31 days, excluding yesterday" />
        <Row label="ADR"            value={fmt(snap.avg30.adr, "$")}          />
        <Row label="RevPAR"         value={fmt(snap.avg30.revpar, "$")}       />
        <Row label="Revenue / day"  value={fmt(snap.avg30.revenuePerDay, "$")} note="avg daily revenue" />
      </Section>

      {/* MTD */}
      <Section title={`Month-to-date  (${snap.mtd.fromDate} → ${snap.mtd.toDate})`} color="green">
        <Row label="Days elapsed"       value={fmtInt(snap.mtd.daysElapsed)}          />
        <Row label="Occupancy"          value={fmtPct(snap.mtd.occ)}                  />
        <Row label="ADR"                value={fmt(snap.mtd.adr, "$")}                />
        <Row label="RevPAR"             value={fmt(snap.mtd.revpar, "$")}             />
        <Row label="Revenue (actual)"   value={fmt(snap.mtd.revenue, "$")}            />
        <Row label="Proj. RevPAR (EOM)" value={fmt(snap.mtd.projectedRevpar, "$")}    note="(MTD RevPAR / days_elapsed) × days_in_month" />
        <Row label="Proj. Revenue (EOM)" value={fmt(snap.mtd.projectedRevenue, "$")} note="(MTD revenue / days_elapsed) × days_in_month" />
      </Section>

      {/* Tonight */}
      <Section title={`Tonight on-the-books  (${snap.tonight.date})`} color="amber">
        <Row label="Rooms sold"  value={`${fmtInt(snap.tonight.roomsSold)} / ${fmtInt(snap.tonight.totalRooms)}`} />
        <Row label="Occupancy"   value={fmtPct(snap.tonight.occ)}         />
        <Row label="ADR"         value={fmt(snap.tonight.adr, "$")}       />
        <Row label="Revenue"     value={fmt(snap.tonight.revenue, "$")}   />
      </Section>

      {/* Counts */}
      <Section title="Counts" color="gray">
        <Row label="Pending approvals"  value={fmtInt(snap.pendingApprovals)} note="auto_publishing_rate_reviews WHERE status='pending'" />
        <Row label="Active insights"    value={fmtInt(snap.insights)}         note="insights WHERE action_taken = false AND last 30 days" />
        <Row label="Rate reviews 7d"    value={fmtInt(snap.pickup7d)}         note="auto_publishing_rate_reviews WHERE created_at >= now()-7d" />
      </Section>

      <div className="border-t border-border pt-4 text-xs text-muted-foreground space-y-1">
        <p>
          <strong>How to verify:</strong> Every number on this page uses the same SQL formulas as the
          Action Center components. If a number here matches the UI, the UI is accurate.
        </p>
        <p>
          Formulas: <code>occupancy = SUM(actual_occupancy) / SUM(avail + oos + actual_occupancy) × 100</code>
          &nbsp;·&nbsp;
          <code>revenue = actual_occupancy × COALESCE(suggested_price, base_rate)</code>
        </p>
        <p>
          To run the same query in psql:{" "}
          <code>{"SELECT * FROM auto_publishing_rate_reviews WHERE hotel_id = '" + HOTEL_ID + "' AND status = 'pending' LIMIT 5;"}</code>
        </p>
      </div>
    </div>
  );
}

function Section({
  title,
  color,
  children,
}: {
  title: string;
  color: "blue" | "purple" | "green" | "amber" | "gray";
  children: React.ReactNode;
}) {
  const accent: Record<string, string> = {
    blue:   "border-blue-300 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20",
    purple: "border-purple-300 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20",
    green:  "border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20",
    amber:  "border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20",
    gray:   "border-border bg-muted/30",
  };
  return (
    <div className={`rounded-xl border p-5 ${accent[color]}`}>
      <h2 className="text-sm font-bold mb-3 uppercase tracking-wider">{title}</h2>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex items-baseline gap-3 py-0.5 border-b border-border/40 last:border-0">
      <span className="w-44 shrink-0 text-muted-foreground text-xs">{label}</span>
      <span className="font-bold text-foreground tabular-nums">{value}</span>
      {note && <span className="text-[10px] text-muted-foreground ml-auto">{note}</span>}
    </div>
  );
}
