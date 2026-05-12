"use client";
import * as React from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, Download, Search } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PRICING_DECISIONS } from "@/lib/analytics-data";
import { ActionToast } from "@/components/action-toast";
import { cn, formatCurrency } from "@/lib/utils";

const sourceVariant: Record<string, "info" | "opportunity" | "warning"> = {
  Auto: "opportunity",
  Manual: "info",
  Override: "warning",
};

export function PricingAuditTrail() {
  const [query, setQuery] = React.useState("");
  const [toast, setToast] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PRICING_DECISIONS;
    return PRICING_DECISIONS.filter((r) =>
      [r.roomType, r.stayDate, r.approvedBy, r.reason, r.source]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [query]);

  const exportCsv = () => {
    const header = "decided_at,room_type,stay_date,old_price,new_price,change_pct,approved_by,source,reason";
    const rows = filtered.map((r) =>
      [r.decidedAt, r.roomType, r.stayDate, r.oldPrice, r.newPrice, r.changePct, r.approvedBy, r.source, `"${r.reason}"`].join(",")
    );
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pricing-audit-trail.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
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
                Every approved price change in the period. The ownership-facing record.
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
              <Button variant="outline" size="sm" onClick={exportCsv}>
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
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
                      transition={{ delay: i * 0.02 }}
                      className="border-t border-border hover:bg-accent/30 transition-colors"
                    >
                      <td className="py-2.5 px-3 text-[11px] text-muted-foreground whitespace-nowrap">
                        {r.decidedAt}
                      </td>
                      <td className="py-2.5 px-3 font-medium whitespace-nowrap">{r.roomType}</td>
                      <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">{r.stayDate}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-muted-foreground">
                        {formatCurrency(r.oldPrice)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold">
                        {formatCurrency(r.newPrice)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span
                          className={cn(
                            "inline-flex items-center gap-0.5 text-xs font-semibold font-mono tabular-nums",
                            up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                          )}
                        >
                          {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {up ? "+" : ""}
                          {r.changePct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge variant={sourceVariant[r.source]} className="text-[10px]">
                          {r.source}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-[12px] text-muted-foreground whitespace-nowrap">
                        {r.approvedBy}
                      </td>
                      <td className="py-2.5 px-3 text-[12px]">{r.reason}</td>
                    </motion.tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                      No decisions match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-[10px] text-muted-foreground">
            Source: pricing_calculation_logs · suggested_prices.approved_by / approved_at
          </div>
        </CardContent>
      </Card>
      <ActionToast message={toast || ""} show={!!toast} />
    </>
  );
}
