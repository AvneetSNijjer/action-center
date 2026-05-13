"use client";
import { Database, Info } from "lucide-react";

/**
 * Subtle persistent indicator that we're connected to a read-only
 * replica. Mounted in the root layout. Lives at the very bottom of
 * the topbar so it's always discoverable but never in the way.
 */
export function ReadOnlyBanner() {
  return (
    <div className="flex items-center justify-center gap-1.5 border-b border-border bg-amber-50/60 dark:bg-amber-950/20 px-4 py-1 text-[10px] font-medium text-amber-800 dark:text-amber-300">
      <Database className="h-3 w-3" />
      <span>Connected to Ampliphi read-replica · writes are mocked in this build</span>
      <Info className="h-2.5 w-2.5 opacity-60" />
    </div>
  );
}
