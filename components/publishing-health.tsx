"use client";
import { motion } from "framer-motion";
import { Activity, CheckCircle2, Cloud, Database, Search } from "lucide-react";
import { PUBLISHING_HEALTH } from "@/lib/forecast-data";
import { cn } from "@/lib/utils";

export function PublishingHealth() {
  const h = PUBLISHING_HEALTH;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2 }}
      className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border bg-card/60 px-4 py-3 text-xs"
    >
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <span className="font-semibold">All systems operational</span>
      </div>
      <Stat Icon={Activity} label="Pushes today" value={h.pushesToday.toString()} />
      <Stat
        Icon={CheckCircle2}
        label="Success rate"
        value={`${h.successRate}%`}
        accent={h.successRate > 99 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}
      />
      <Stat Icon={Cloud} label="Agora" value={h.agoraStatus} ok />
      <Stat Icon={Database} label="PMS sync" value={h.pmsStatus} ok />
      <Stat Icon={Search} label="Comp scrape" value={h.competitorScrapeStatus} ok />
      <div className="ml-auto text-muted-foreground">Last sync {h.lastSync}</div>
    </motion.div>
  );
}

function Stat({
  Icon,
  label,
  value,
  accent,
  ok,
}: {
  Icon: any;
  label: string;
  value: string;
  accent?: string;
  ok?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon
        className={cn(
          "h-3.5 w-3.5",
          accent || (ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")
        )}
      />
      <span className="text-muted-foreground">{label}:</span>
      <span className={cn("font-semibold capitalize", accent)}>{value}</span>
    </div>
  );
}
