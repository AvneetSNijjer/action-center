"use client";
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { AlertOctagon, ChevronRight } from "lucide-react";
import { usePortfolio } from "@/components/portfolio-provider";
import { Button } from "@/components/ui/button";

export function CriticalBanner() {
  const router = useRouter();
  const { hotels, setActiveProperty } = usePortfolio();

  // Live critical = hotels with the highest pending-approval counts (top 3)
  const criticals = React.useMemo(() => {
    return [...hotels]
      .filter((h) => (h.pendingApprovals ?? 0) > 50)
      .sort((a, b) => (b.pendingApprovals ?? 0) - (a.pendingApprovals ?? 0))
      .slice(0, 3);
  }, [hotels]);

  if (criticals.length === 0) return null;

  const totalPending = criticals.reduce((a, h) => a + (h.pendingApprovals ?? 0), 0);

  const open = (id: string) => {
    setActiveProperty(id, { switchToProperty: true });
    router.push("/");
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="rounded-xl border border-red-200 bg-gradient-to-r from-red-50 to-red-50/50 dark:from-red-950/30 dark:to-red-950/10 dark:border-red-900/50 px-4 py-3 flex items-center gap-3 flex-wrap"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400 shrink-0">
          <AlertOctagon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-red-900 dark:text-red-200">
            {criticals.length} propert{criticals.length === 1 ? "y has" : "ies have"} a heavy approval backlog
          </div>
          <div className="text-[12px] text-red-700/80 dark:text-red-300/80 mt-0.5">
            {totalPending.toLocaleString()} pending rate review{totalPending === 1 ? "" : "s"} concentrated in these properties.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {criticals.map((p) => (
            <Button
              key={p.id}
              size="sm"
              variant="outline"
              onClick={() => open(p.id)}
              className="bg-white/70 dark:bg-card/60 border-red-200 dark:border-red-900/40 hover:bg-white text-red-900 dark:text-red-200 h-7 text-xs"
            >
              {p.name}
              <ChevronRight className="h-3 w-3" />
            </Button>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
