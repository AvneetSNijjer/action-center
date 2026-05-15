"use client";
/**
 * Developer-only simulation toolbar.
 *
 * Visible only when NEXT_PUBLIC_DEMO_SHOW_SIM_TOOLBAR=true (dev mode).
 * Lets developers switch between Admin view (all hotels) and Customer
 * simulation (only hotels assigned to a specific user via user_hotels).
 *
 * Persists the selected mode to localStorage so page refreshes stick.
 * In production (NEXT_PUBLIC_DEMO_SHOW_SIM_TOOLBAR != "true"), renders nothing.
 */
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, User, ChevronDown, Eye, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "ampliphi.sim.v1";

interface SimState {
  role: "admin" | "customer";
  simulatedUserId: string;
  hotelCount?: number;
}

// Emits a custom event so portfolio-provider can react without a full reload
function emitRoleChange(role: string, userId: string) {
  window.dispatchEvent(
    new CustomEvent("ampliphi:rolechange", { detail: { role, userId } })
  );
}

export function SimulationToolbar({ totalHotels }: { totalHotels?: number }) {
  const showToolbar = process.env.NEXT_PUBLIC_DEMO_SHOW_SIM_TOOLBAR === "true";
  const [open, setOpen] = React.useState(false);
  const [minimised, setMinimised] = React.useState(false);
  const [sim, setSim] = React.useState<SimState>({
    role: "admin",
    simulatedUserId: "",
    hotelCount: totalHotels,
  });
  const [userIdInput, setUserIdInput] = React.useState("");
  const [applying, setApplying] = React.useState(false);

  // Load persisted state
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SimState>;
        setSim((prev) => ({ ...prev, ...parsed }));
        setUserIdInput(parsed.simulatedUserId ?? "");
      }
    } catch {}
  }, []);

  React.useEffect(() => {
    setSim((prev) => ({ ...prev, hotelCount: totalHotels }));
  }, [totalHotels]);

  if (!showToolbar) return null;

  const persist = (next: SimState) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  };

  const applyAdmin = () => {
    setApplying(true);
    const next: SimState = { role: "admin", simulatedUserId: "", hotelCount: undefined };
    setSim(next);
    persist(next);
    emitRoleChange("admin", "");
    // POST to a lightweight endpoint to update the session cookie / reload data
    fetch("/api/sim/role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "admin", userId: "" }),
    }).finally(() => {
      setApplying(false);
      window.location.reload();
    });
  };

  const applyCustomer = () => {
    if (!userIdInput.trim()) return;
    setApplying(true);
    const next: SimState = { role: "customer", simulatedUserId: userIdInput.trim() };
    setSim(next);
    persist(next);
    emitRoleChange("customer", userIdInput.trim());
    fetch("/api/sim/role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "customer", userId: userIdInput.trim() }),
    }).finally(() => {
      setApplying(false);
      window.location.reload();
    });
  };

  const isAdmin = sim.role === "admin";

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end gap-2">
      <AnimatePresence>
        {open && !minimised && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="w-72 rounded-xl border border-border bg-popover shadow-xl p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Dev · Simulation Mode
              </span>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Admin mode */}
            <button
              onClick={applyAdmin}
              disabled={applying}
              className={cn(
                "w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                isAdmin
                  ? "border-brand-300 bg-brand-50/60 dark:bg-brand-900/20 dark:border-brand-700"
                  : "border-border hover:bg-accent"
              )}
            >
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg shrink-0",
                isAdmin ? "bg-brand-100 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300" : "bg-muted text-muted-foreground"
              )}>
                <Shield className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">Admin view</div>
                <div className="text-[11px] text-muted-foreground">All hotels visible · developer access</div>
              </div>
              {isAdmin && <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />}
            </button>

            {/* Customer simulation */}
            <div className={cn(
              "rounded-lg border p-3 space-y-2 transition-colors",
              !isAdmin
                ? "border-violet-300 bg-violet-50/60 dark:bg-violet-900/20 dark:border-violet-700"
                : "border-border"
            )}>
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg shrink-0",
                  !isAdmin ? "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300" : "bg-muted text-muted-foreground"
                )}>
                  <User className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">Simulate customer</div>
                  <div className="text-[11px] text-muted-foreground">Shows only assigned hotels</div>
                </div>
                {!isAdmin && <div className="h-2 w-2 rounded-full bg-violet-500 shrink-0" />}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="User ID (e.g. 42)"
                  value={userIdInput}
                  onChange={(e) => setUserIdInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyCustomer()}
                  className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:border-brand-400"
                />
                <button
                  onClick={applyCustomer}
                  disabled={applying || !userIdInput.trim()}
                  className="flex items-center gap-1.5 rounded-md bg-violet-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
                >
                  {applying ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
                  View
                </button>
              </div>
            </div>

            <div className="text-[10px] text-muted-foreground">
              Changes reload the page. Hidden in production.
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trigger pill */}
      <motion.button
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => { setOpen((v) => !v); setMinimised(false); }}
        className={cn(
          "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-lg transition-colors",
          isAdmin
            ? "border-brand-300 bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300 dark:border-brand-700"
            : "border-violet-300 bg-violet-50 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 dark:border-violet-700"
        )}
      >
        {isAdmin ? <Shield className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
        {isAdmin
          ? `Admin · ${sim.hotelCount ?? "…"} hotels`
          : `Customer · user ${sim.simulatedUserId}`}
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </motion.button>
    </div>
  );
}
