"use client";
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, ChevronDown, LayoutGrid, Check, MapPin, Search, Loader2 } from "lucide-react";
import { usePortfolio } from "@/components/portfolio-provider";
import { cn } from "@/lib/utils";

/**
 * Scope selector — primary topbar control.
 *
 * Shows live hotels from the DB (via portfolio context).
 * For Avneet (DEMO_IS_SUPERUSER=true) all 97 hotels are visible.
 * For other users only their user_hotels assignments appear.
 */
export function ScopeSelector() {
  const {
    scope,
    activePropertyId,
    activeHotel,
    hotels,
    isLoading,
    setScope,
    setActiveProperty,
    hydrated,
  } = usePortfolio();

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const ref = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onClickOutside);
      // Focus search on open
      setTimeout(() => searchRef.current?.focus(), 50);
    }
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  // Reset search when dropdown closes
  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  if (!hydrated) {
    return <div className="h-9 w-64 rounded-lg animate-pulse bg-muted" aria-hidden />;
  }

  const isGroup = scope === "group";
  const activeName = activeHotel?.name ?? activePropertyId ?? "Select property";

  const filtered = React.useMemo(() => {
    if (!query.trim()) return hotels;
    const q = query.toLowerCase();
    return hotels.filter(
      (h) =>
        h.name.toLowerCase().includes(q) ||
        h.city.toLowerCase().includes(q) ||
        h.state.toLowerCase().includes(q) ||
        h.id?.toLowerCase().includes(q)
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotels, query]);

  return (
    <div ref={ref} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "group flex items-center gap-2.5 rounded-lg border bg-card px-3 py-1.5 text-sm transition-colors min-w-[14rem]",
          open
            ? "border-brand-300 dark:border-brand-700 shadow-sm"
            : "border-border hover:border-foreground/20"
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
          {isGroup ? (
            <LayoutGrid className="h-3.5 w-3.5" />
          ) : (
            <Building2 className="h-3.5 w-3.5" />
          )}
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground leading-tight">
            {isGroup ? "Portfolio" : "Property"}
          </div>
          <div className="text-sm font-semibold leading-tight truncate">
            {isGroup ? "All Properties" : activeName}
          </div>
        </div>
        <span className="hidden sm:inline text-[10px] text-muted-foreground shrink-0 font-medium">
          {isGroup
            ? `${hotels.length || "—"} hotels`
            : activeHotel
            ? `${activeHotel.id}`
            : ""}
        </span>
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform shrink-0",
              open && "rotate-180"
            )}
          />
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-1.5 z-50 w-[22rem] rounded-xl border border-border bg-popover shadow-xl overflow-hidden"
          >
            {/* Portfolio option */}
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
                <div className="text-sm font-semibold leading-tight">All Properties</div>
                <div className="text-[11px] text-muted-foreground">
                  Portfolio view · {hotels.length} hotels
                </div>
              </div>
              {isGroup && <Check className="h-4 w-4 text-violet-600 dark:text-violet-300 shrink-0" />}
            </button>

            <div className="border-t border-border" />

            {/* Search */}
            <div className="px-3 pt-2.5 pb-1.5">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search properties…"
                  className="w-full rounded-md border border-border bg-background pl-8 pr-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-brand-400 dark:focus:border-brand-600"
                />
              </div>
            </div>

            {/* Property list */}
            <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "property" : "properties"}
            </div>
            <div className="max-h-64 overflow-y-auto pb-1">
              {isLoading && !hotels.length ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading properties…
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No properties match "{query}"
                </div>
              ) : (
                filtered.map((h) => {
                  const isActive = !isGroup && h.id === activePropertyId;
                  return (
                    <button
                      key={h.id}
                      onClick={() => {
                        setActiveProperty(h.id, { switchToProperty: true });
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
                        <div className="text-sm font-medium truncate">{h.name}</div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">
                            {h.city ? `${h.city}${h.state ? `, ${h.state}` : ""}` : h.location || h.id}
                          </span>
                        </div>
                      </div>
                      {isActive ? (
                        <Check className="h-4 w-4 text-brand-600 dark:text-brand-300 shrink-0" />
                      ) : (
                        <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                          {h.id}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
