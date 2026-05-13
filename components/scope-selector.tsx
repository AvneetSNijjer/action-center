"use client";
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, ChevronDown, LayoutGrid, Check, MapPin } from "lucide-react";
import { usePortfolio } from "@/components/portfolio-provider";
import { HOTEL_GROUP, STATUS_META, getProperty } from "@/lib/portfolio";
import { cn } from "@/lib/utils";

/**
 * Scope selector — primary topbar control.
 * Switches between Group scope (whole portfolio) and a specific Property.
 */
export function ScopeSelector() {
  const { scope, activePropertyId, setScope, setActiveProperty, hydrated } = usePortfolio();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!hydrated) {
    // Reserve space to avoid layout shift
    return <div className="h-9 w-64 rounded-lg" aria-hidden />;
  }

  const activeProp = getProperty(activePropertyId);
  const isGroup = scope === "group";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "group flex items-center gap-2.5 rounded-lg border bg-card px-3 py-1.5 text-sm transition-colors min-w-[14rem]",
          open ? "border-brand-300 dark:border-brand-700 shadow-sm" : "border-border hover:border-foreground/20"
        )}
      >
        <div
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md shrink-0",
            isGroup
              ? "bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300"
              : "bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300"
          )}
        >
          {isGroup ? <LayoutGrid className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground leading-tight">
            {isGroup ? "Portfolio" : "Property"}
          </div>
          <div className="text-sm font-semibold leading-tight truncate">
            {isGroup
              ? `${HOTEL_GROUP.name}`
              : activeProp
              ? activeProp.name
              : "Select property"}
          </div>
        </div>
        <span className="hidden sm:inline text-[10px] text-muted-foreground shrink-0 font-medium">
          {isGroup
            ? `${HOTEL_GROUP.properties.length} properties`
            : activeProp
            ? `${activeProp.rooms} rooms`
            : ""}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform shrink-0",
            open && "rotate-180"
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-1.5 z-50 w-80 rounded-xl border border-border bg-popover shadow-xl overflow-hidden"
          >
            {/* Group option */}
            <button
              onClick={() => {
                setScope("group");
                setOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
                isGroup ? "bg-violet-50/60 dark:bg-violet-950/30" : "hover:bg-accent"
              )}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300">
                <LayoutGrid className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold leading-tight">{HOTEL_GROUP.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  Portfolio view · {HOTEL_GROUP.properties.length} properties
                </div>
              </div>
              {isGroup && <Check className="h-4 w-4 text-violet-600 dark:text-violet-300" />}
            </button>

            <div className="border-t border-border" />

            {/* Property list */}
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Properties
            </div>
            <div className="max-h-72 overflow-y-auto pb-1">
              {HOTEL_GROUP.properties.map((p) => {
                const isActive = !isGroup && p.id === activePropertyId;
                const status = STATUS_META[p.status];
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setActiveProperty(p.id, { switchToProperty: true });
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 text-left transition-colors",
                      isActive ? "bg-brand-50/60 dark:bg-brand-900/30" : "hover:bg-accent"
                    )}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">
                      <Building2 className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", status.dot)} />
                        <span className="text-sm font-medium truncate">{p.name}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-2.5 w-2.5" />
                        {p.city}, {p.state} · {p.rooms} rooms
                      </div>
                    </div>
                    {isActive && <Check className="h-4 w-4 text-brand-600 dark:text-brand-300" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
