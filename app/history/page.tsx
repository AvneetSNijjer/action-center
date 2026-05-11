"use client";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { DISMISSED_INSIGHTS } from "@/lib/mock-data";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SeverityIcon, severityLabel } from "@/components/severity-icon";
import { formatRelativeTime } from "@/lib/utils";

export default function HistoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Insights you&apos;ve actioned, dismissed, or that auto-expired.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Actioned (7d)", value: "42", Icon: CheckCircle2, color: "text-emerald-600" },
          { label: "Dismissed (7d)", value: "11", Icon: XCircle, color: "text-muted-foreground" },
          { label: "Auto-expired", value: "5", Icon: Clock, color: "text-amber-600" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="p-5">
              <s.Icon className={`h-5 w-5 ${s.color}`} />
              <div className="mt-3 text-2xl font-bold">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="space-y-3">
        {DISMISSED_INSIGHTS.map((i, idx) => (
          <motion.div key={i.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}>
            <Card className="flex items-center gap-4 p-4">
              <SeverityIcon severity={i.severity} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={i.severity}>{severityLabel[i.severity]}</Badge>
                  <Badge variant="secondary">{i.status === "actioned" ? "Actioned" : "Dismissed"}</Badge>
                  <span className="text-[11px] text-muted-foreground">{formatRelativeTime(i.createdAt)}</span>
                </div>
                <div className="mt-1 font-medium truncate">{i.title}</div>
                <div className="text-xs text-muted-foreground truncate">{i.summary}</div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
