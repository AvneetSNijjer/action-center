"use client";
import * as React from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, Download, Search, Loader2 } from "lucide-react";
import useSWR from "swr";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionToast } from "@/components/action-toast";
import { cn, formatCurrency } from "@/lib/utils";
import { usePortfolio } from "@/components/portfolio-provider";
import type { PricingDecisionRow } from "@/lib/queries/analytics";

const sourceVariant: Record<string, "info" | "opportunity" | "warning"> = {
  Auto:     "opportunity",
  Manual:   "info",
  Override: "warning",
};

const fetcher = (url: string) =>
  fetch(url).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });

export function PricingAuditTrail() {
  const [query, setQuery] = React.useState("");
  const [toast, setToast] = React.useState<string | null>(null);
  const { activePropertyId } = usePortfolio();

  const { data: res, isLoading, error } = useSWR<{ ok: boolean; data: PricingDecisionRow[] }>(
    activePropertyId
      ? `/api/hotels/${activePropertyId}/analytics/pricing-decisions`
      : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 120_000 }
  );

  const decisions: PricingDecisionRow[] = res?.ok ? res.data : [];

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return decisions;
    return decisions.filter((r) =>
      [r.roomType, r.stayDate, r.approvedBy, r.reason, r.source]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [decisions, query]);

  const exportCsv = () => {
    const header = "decided_at,room_type,stay_date,old_price,new_price,change_pct,approved_by,source,reason";
    const rows = filtered.map((r) =>
      [r.decidedAt, r.roomType, r.stayDate, r.oldPrice, r.newPrice, r.changePct, r.approvedBy, r.source, `"${r.reason}"`].join(",")
    );
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "pricing-audit-trail.csv";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    setToast("Audit trail exported");
    setTimeout(() => setToast(null), 2000);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle>Pricing decision audit trail</CardTitle>
              <CardDescription>
                Every approved price change in the last 90 days — live from{" "}
                <span className="font-mono text-[10px]">suggested_prices</span>.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5">
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search room, date, reason..."
                  className="w-44 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                />
              </div>
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading pricing decisions…
            </div>
          ) : error ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              Could not load pricing decisions.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium py-2.5 px-3">Decided</th>
                    <th className="text-left font-medium py-2.5 px-3">Room type</th>
                    <th className="text-left font-medium py-2.5 px-3">Stay date</th>
                    <th className="text-right font-medium py-2.5 px-3">Old</th>
                    <th className="text-right font-medium py-2.5 px-3">New</th>
                    <th className="text-right font-medium py-2.5 px-3">Δ</th>
                    <th className="text-left font-medium py-2.5 px-3">Source</th>
                    <th className="text-left font-medium py-2.5 px-3">Approved by</th>
                    <th className="text-left font-medium py-2.5 px-3">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => {
                    const up = r.changePct >= 0;
                    return (
                      <motion.tr
                        key={r.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: Math.min(i * 0.02, 0.4) }}
                        className="border-t border-border hover:bg-accent/30 transition-colors"
                      >
                        <td className="py-2.5 px-3 text-[11px] text-muted-foreground whitespace-nowrap">{r.decidedAt}</td>
                        <td className="py-2.5 px-3 font-medium whitespace-nowrap">{r.roomType}</td>
                        <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">{r.stayDate}</td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-muted-foreground">
                          {r.oldPrice > 0 ? formatCurrency(r.oldPrice) : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold">
                          {formatCurrency(r.newPrice)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {r.oldPrice > 0 ? (
                            <span className={cn(
                              "inline-flex items-center gap-0.5 text-xs font-semibold font-mono tabular-nums",
                              up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                            )}>
                              {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                              {up ? "+" : ""}{r.changePct.toFixed(1)}%
                            </span>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge variant={sourceVariant[r.source] ?? "info"} className="text-[10px]">
                            {r.source}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-[12px] text-muted-foreground whitespace-nowrap">{r.approvedBy}</td>
                        <td className="py-2.5 px-3 text-[12px] max-w-xs truncate" title={r.reason}>{r.reason}</td>
                      </motion.tr>
                    );
                  })}
                  {!isLoading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                        {decisions.length === 0
                          ? "No approved pricing decisions found in the last 90 days."
                          : "No decisions match your search."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-2 text-[10px] text-muted-foreground">
            Source: suggested_prices.approved_at / auto_publish_status · live DB · last 90 days
          </div>
        </CardContent>
      </Card>
      <ActionToast message={toast || ""} show={!!toast} />
    </>
  );
}
