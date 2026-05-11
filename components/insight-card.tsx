"use client";
import { motion } from "framer-motion";
import { Clock, ChevronRight, TrendingUp, TrendingDown, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SeverityIcon, severityLabel } from "@/components/severity-icon";
import type { Insight } from "@/lib/types";
import { cn, formatCurrency, formatRelativeTime } from "@/lib/utils";

const typeLabel: Record<string, string> = {
  competitor_change: "Competitor",
  event_alert: "Event",
  demand_pacing: "Demand",
  cancellation_alert: "Cancellation",
  revenue_pacing: "Revenue",
  pending_approvals: "Approvals",
  stale_pricing: "Freshness",
};

export function InsightCard({
  insight,
  onClick,
  onAction,
  index = 0,
}: {
  insight: Insight;
  onClick: () => void;
  onAction: (actionId: string) => void;
  index?: number;
}) {
  const primary = insight.actions.find((a) => a.primary) || insight.actions[0];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      whileHover={{ y: -2 }}
    >
      <Card
        onClick={onClick}
        className={cn(
          "group cursor-pointer p-5 transition-all hover:shadow-md",
          "hover:border-brand-200 dark:hover:border-brand-800/50"
        )}
      >
        <div className="flex items-start gap-4">
          <SeverityIcon severity={insight.severity} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <Badge variant={insight.severity}>{severityLabel[insight.severity]}</Badge>
              <Badge variant="secondary" className="text-[10px] font-medium">
                {typeLabel[insight.type]}
              </Badge>
              {insight.affectedDates && insight.affectedDates.length > 0 && (
                <span className="text-[11px] text-muted-foreground">
                  {insight.affectedDates.length === 1
                    ? new Date(insight.affectedDates[0]).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        weekday: "short",
                      })
                    : `${insight.affectedDates.length} dates`}
                </span>
              )}
              <span className="text-[11px] text-muted-foreground flex items-center gap-1 ml-auto">
                <Clock className="h-3 w-3" />
                {formatRelativeTime(insight.createdAt)}
              </span>
            </div>

            <h3 className="font-semibold leading-snug group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors">
              {insight.title}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{insight.summary}</p>

            {insight.metrics.length > 0 && (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {insight.metrics.slice(0, 4).map((m) => (
                  <div
                    key={m.label}
                    className="rounded-lg border border-border bg-muted/30 px-3 py-2"
                  >
                    <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      {m.label}
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-sm font-semibold tabular-nums">{m.value}</span>
                      {m.trend === "up" && <TrendingUp className="h-3 w-3 text-emerald-500" />}
                      {m.trend === "down" && <TrendingDown className="h-3 w-3 text-red-500" />}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {insight.revenueImpact !== undefined && insight.revenueImpact !== 0 && (
                  <Badge
                    variant={insight.revenueImpact > 0 ? "opportunity" : "critical"}
                    className="font-semibold"
                  >
                    {insight.revenueImpact > 0 ? "+" : ""}
                    {formatCurrency(insight.revenueImpact)}
                  </Badge>
                )}
                <span className="text-[11px] text-muted-foreground hidden sm:inline">
                  {insight.source}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClick();
                  }}
                >
                  Details
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAction(primary.id);
                  }}
                >
                  {primary.label}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
