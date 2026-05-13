"use client";
import * as React from "react";
import { motion } from "framer-motion";
import { CheckCircle2, ArrowUpRight, ArrowDownRight, Clock, ChevronRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionToast } from "@/components/action-toast";
import { PENDING_APPROVALS, type PendingApproval } from "@/lib/forecast-data";
import { cn, formatCurrency } from "@/lib/utils";
import type { ApprovalRow } from "@/lib/queries/action-center";

/** Convert a live ApprovalRow to the PendingApproval shape the UI expects. */
function toUiItem(r: ApprovalRow): PendingApproval {
  const stayDate = new Date(r.stayDate);
  const dayOfWeek = stayDate.toLocaleDateString("en-US", { weekday: "short" });
  const stayDateLabel = stayDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const ageMs = Date.now() - new Date(r.createdAt).getTime();
  const ageH = Math.round(ageMs / 3_600_000);
  const age = ageH < 24 ? `${ageH}h` : `${Math.round(ageH / 24)}d`;
  const isIncrease = r.change >= 0;
  return {
    id: r.id,
    roomType: r.roomTypeId,
    stayDate: stayDateLabel,
    dayOfWeek,
    currentPrice: r.currentRate,
    suggestedPrice: r.suggestedRate,
    change: r.change,
    changePct: r.changePct,
    violation: isIncrease ? "percentage_increase" : "percentage_decrease",
    severity: Math.abs(r.changePct) >= 20 ? "high" : "medium",
    age,
    reason: r.violationType || r.violationSeverity || "Auto-publish threshold",
  };
}

export function PendingApprovalsWidget({
  liveApprovals,
}: {
  liveApprovals?: ApprovalRow[] | null;
}) {
  const initialItems = React.useMemo(
    () => (liveApprovals != null ? liveApprovals.map(toUiItem) : PENDING_APPROVALS),
    [liveApprovals]
  );
  const [items, setItems] = React.useState<PendingApproval[]>(initialItems);

  // Re-sync when live data arrives
  React.useEffect(() => {
    setItems(liveApprovals != null ? liveApprovals.map(toUiItem) : PENDING_APPROVALS);
  }, [liveApprovals]);
  const [toast, setToast] = React.useState<string | null>(null);
  const fire = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  const approve = (id: string) => {
    setItems((p) => p.filter((i) => i.id !== id));
    fire("Approved — published to channels");
  };
  const decline = (id: string) => {
    setItems((p) => p.filter((i) => i.id !== id));
    fire("Declined — kept original price");
  };
  const batchApprove = () => {
    const small = items.filter((i) => Math.abs(i.changePct) < 15);
    if (!small.length) {
      fire("No items under 15% to batch-approve");
      return;
    }
    setItems((p) => p.filter((i) => Math.abs(i.changePct) >= 15));
    fire(`Approved ${small.length} item${small.length === 1 ? "" : "s"} under 15% change`);
  };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                Pending approvals
                <Badge variant="info">{items.length}</Badge>
              </CardTitle>
              <CardDescription>
                Rate suggestions flagged by auto-publishing thresholds
              </CardDescription>
            </div>
            <Button variant="outline" size="sm">
              View all
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
                Queue is clear — no pending approvals right now.
              </div>
            ) : (
              items.map((a, i) => {
                const up = a.change > 0;
                return (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-lg border border-border bg-background p-3 hover:bg-accent/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                          up
                            ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                            : "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
                        )}
                      >
                        {up ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold truncate">{a.roomType}</span>
                          <Badge variant="secondary" className="font-mono text-[10px]">
                            {a.dayOfWeek} {a.stayDate}
                          </Badge>
                          <Badge
                            variant={a.severity === "high" ? "critical" : "warning"}
                            className="text-[10px]"
                          >
                            {a.severity === "high" ? "Threshold exceeded" : "Review needed"}
                          </Badge>
                        </div>
                        <div className="mt-0.5 flex items-baseline gap-3 text-xs flex-wrap">
                          <span className="text-muted-foreground line-through">
                            {formatCurrency(a.currentPrice)}
                          </span>
                          <span className="font-semibold text-base">{formatCurrency(a.suggestedPrice)}</span>
                          <span
                            className={cn(
                              "font-medium",
                              up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                            )}
                          >
                            {a.change > 0 ? "+" : ""}
                            {formatCurrency(a.change)} ({a.changePct > 0 ? "+" : ""}
                            {a.changePct.toFixed(1)}%)
                          </span>
                          <span className="ml-auto text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {a.age}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1">{a.reason}</div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Button size="sm" className="h-7 text-xs" onClick={() => approve(a.id)}>
                          <CheckCircle2 className="h-3 w-3" />
                          Approve
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => decline(a.id)}>
                          Decline
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
            {items.length > 0 && (
              <Button variant="secondary" className="w-full mt-1" onClick={batchApprove}>
                <CheckCircle2 className="h-4 w-4" />
                Approve all under 15% change
              </Button>
            )}
          </CardContent>
        </Card>
      </motion.div>
      <ActionToast message={toast || ""} show={!!toast} />
    </>
  );
}
