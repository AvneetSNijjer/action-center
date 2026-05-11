"use client";
import { AlertOctagon, AlertTriangle, Sparkles, Info } from "lucide-react";
import type { Severity } from "@/lib/types";
import { cn } from "@/lib/utils";

const map = {
  critical: { Icon: AlertOctagon, ring: "ring-red-200 dark:ring-red-900/50", bg: "bg-red-50 dark:bg-red-950/40", text: "text-red-600 dark:text-red-400" },
  warning: { Icon: AlertTriangle, ring: "ring-amber-200 dark:ring-amber-900/50", bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-600 dark:text-amber-400" },
  opportunity: { Icon: Sparkles, ring: "ring-emerald-200 dark:ring-emerald-900/50", bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-600 dark:text-emerald-400" },
  info: { Icon: Info, ring: "ring-brand-100 dark:ring-brand-900/50", bg: "bg-brand-50 dark:bg-brand-950/40", text: "text-brand-600 dark:text-brand-400" },
} as const;

export function SeverityIcon({ severity, size = "md" }: { severity: Severity; size?: "sm" | "md" | "lg" }) {
  const { Icon, ring, bg, text } = map[severity];
  const dim =
    size === "sm" ? "h-7 w-7" : size === "lg" ? "h-12 w-12" : "h-10 w-10";
  const iconSize =
    size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-6 w-6" : "h-5 w-5";
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl ring-1 ring-inset",
        dim,
        ring,
        bg
      )}
    >
      <Icon className={cn(iconSize, text)} />
    </div>
  );
}

export const severityLabel: Record<Severity, string> = {
  critical: "Critical",
  warning: "Warning",
  opportunity: "Opportunity",
  info: "Info",
};
