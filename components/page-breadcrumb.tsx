"use client";
import { motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { usePortfolio } from "@/components/portfolio-provider";

/**
 * Persistent breadcrumb shown on property-scope pages so users always
 * know which property they're viewing and can jump back to portfolio view.
 * Renders nothing when scope = group.
 */
export function PageBreadcrumb() {
  const { scope, activeHotel, activePropertyId, switchToGroup, hydrated } = usePortfolio();
  if (!hydrated || scope === "group") return null;

  // Use live hotel name, fall back to the raw hotel ID
  const propertyName = activeHotel?.name ?? activePropertyId ?? "";
  if (!propertyName) return null;

  return (
    <motion.button
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ x: -2 }}
      onClick={switchToGroup}
      className="group inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors -mb-2"
    >
      <ChevronLeft className="h-3.5 w-3.5" />
      <span>All Properties</span>
      <span className="text-muted-foreground/60">/</span>
      <span className="text-foreground font-semibold">{propertyName}</span>
    </motion.button>
  );
}
