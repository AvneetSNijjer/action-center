"use client";
import { motion } from "framer-motion";
import { Activity, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PublishingHealthData } from "@/lib/queries/action-center";

export function PublishingHealth({ liveData }: { liveData?: PublishingHealthData | null }) {
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
        <span className="font-semibold">Rate publishing · live</span>
      </div>

      {liveData != null ? (
        <>
          <Stat
            Icon={CheckCircle2}
            label="Approved 24h"
            value={liveData.published24h.toString()}
            accent="text-emerald-600 dark:text-emerald-400"
          />
          <Stat
            Icon={Clock}
            label="Pending"
            value={liveData.pending.toString()}
            accent={
              liveData.pending > 20
                ? "text-red-600 dark:text-red-400"
                : liveData.pending > 0
                ? "text-amber-600 dark:text-amber-400"
                : "text-emerald-600 dark:text-emerald-400"
            }
          />
          {liveData.rejected24h > 0 && (
            <Stat
              Icon={AlertCircle}
              label="Rejected 24h"
              value={liveData.rejected24h.toString()}
              accent="text-red-600 dark:text-red-400"
            />
          )}
          <Stat
            Icon={Activity}
            label="Success rate"
            value={`${liveData.successRate}%`}
            accent={
              liveData.successRate >= 99
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-amber-600 dark:text-amber-400"
            }
          />
        </>
      ) : (
        <span className="text-muted-foreground">Loading…</span>
      )}
    </motion.div>
  );
}

function Stat({
  Icon,
  label,
  value,
  accent,
}: {
  Icon: React.ElementType;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className={cn("h-3.5 w-3.5", accent ?? "text-muted-foreground")} />
      <span className="text-muted-foreground">{label}:</span>
      <span className={cn("font-semibold", accent)}>{value}</span>
    </div>
  );
}
