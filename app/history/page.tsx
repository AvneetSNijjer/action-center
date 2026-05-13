"use client";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Clock, History as HistoryIcon, Layers } from "lucide-react";
import { DISMISSED_INSIGHTS } from "@/lib/mock-data";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SeverityIcon, severityLabel } from "@/components/severity-icon";
import { formatRelativeTime } from "@/lib/utils";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { LoadingPage } from "@/components/loading-page";
import { usePortfolio } from "@/components/portfolio-provider";
import { getProperty, HOTEL_GROUP } from "@/lib/portfolio";
import { cn } from "@/lib/utils";

export default function HistoryPage() {
  const { scope, activePropertyId, hydrated } = usePortfolio();
  if (!hydrated) return <LoadingPage />;
  const isGroup = scope === "group";
  const property = getProperty(activePropertyId);

  return (
    <div className="space-y-6">
      <PageBreadcrumb />

      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-semibold tracking-tight">History</h1>
          {isGroup ? (
            <span className="rounded-full bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 px-2 py-0.5 text-[10px] font-semibold ring-1 ring-violet-200 dark:ring-violet-900/50 inline-flex items-center gap-1">
              <Layers className="h-3 w-3" />
              GROUP VIEW
            </span>
          ) : (
            <span className="rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 px-2 py-0.5 text-[10px] font-semibold ring-1 ring-brand-200 dark:ring-brand-800/60 inline-flex items-center gap-1">
              <HistoryIcon className="h-3 w-3" />
              PROPERTY VIEW
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {isGroup
            ? `Insights actioned, dismissed, or auto-expired across all ${HOTEL_GROUP.properties.length} properties.`
            : `Insights actioned, dismissed, or auto-expired at ${property?.name ?? "this property"}.`}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "Actioned (7d)",
            value: isGroup ? "248" : "42",
            Icon: CheckCircle2,
            color: "text-emerald-600",
          },
          {
            label: "Dismissed (7d)",
            value: isGroup ? "67" : "11",
            Icon: XCircle,
            color: "text-muted-foreground",
          },
          {
            label: "Auto-expired",
            value: isGroup ? "29" : "5",
            Icon: Clock,
            color: "text-amber-600",
          },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="p-5">
              <s.Icon className={cn("h-5 w-5", s.color)} />
              <div className="mt-3 text-2xl font-bold tabular-nums">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="space-y-3">
        {DISMISSED_INSIGHTS.map((insight, idx) => (
          <motion.div
            key={insight.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
          >
            <Card className="flex items-center gap-4 p-4">
              <SeverityIcon severity={insight.severity} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={insight.severity}>{severityLabel[insight.severity]}</Badge>
                  <Badge variant="secondary">
                    {insight.status === "actioned" ? "Actioned" : "Dismissed"}
                  </Badge>
                  {isGroup && (
                    <Badge variant="outline" className="text-[10px]">
                      {HOTEL_GROUP.properties[idx % HOTEL_GROUP.properties.length].name}
                    </Badge>
                  )}
                  <span className="text-[11px] text-muted-foreground">
                    {formatRelativeTime(insight.createdAt)}
                  </span>
                </div>
                <div className="mt-1 font-medium truncate">{insight.title}</div>
                <div className="text-xs text-muted-foreground truncate">{insight.summary}</div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
