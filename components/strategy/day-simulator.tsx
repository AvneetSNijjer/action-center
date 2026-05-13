"use client";
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  CalendarDays,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  Info,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStrategy } from "@/components/strategy-provider";
import { usePortfolio } from "@/components/portfolio-provider";
import {
  getMode,
  DEFAULT_STRATEGY,
  type StrategyConfig,
  type StrategyModeId,
} from "@/lib/strategy";
import { cn, formatCurrency } from "@/lib/utils";

/* ============================================================
 * Simulation data + math
 * ============================================================ */

interface SimDay {
  /** ISO yyyy-mm-dd (UTC) */
  date: string;
  dow: number; // 0=Sun, 6=Sat
  dowName: string; // "Mon", "Tue", ...
  monthName: string; // "May", "Jun"
  dayOfMonth: number;
  isWeekend: boolean;
  seasonality: number; // 0.85 → 1.15
  eventName?: string;
  eventBoost: number; // 0 → 0.35
  tag?: string;
}

// Static reference "today" so we don't introduce Date.now() drift.
const TODAY_UTC = Date.UTC(2026, 4, 13); // May 13, 2026

// Hand-tagged events drawn from the existing UPCOMING_EVENTS data
const KNOWN_EVENTS: Record<string, { name: string; boost: number; tag: string }> = {
  "2026-05-24": { name: "Boston Calling", boost: 0.28, tag: "Memorial Day · festival" },
  "2026-05-25": { name: "Boston Calling", boost: 0.26, tag: "Memorial Day · festival" },
  "2026-05-26": { name: "Boston Calling", boost: 0.18, tag: "Festival close" },
  "2026-05-30": { name: "Coldplay @ TD Garden", boost: 0.34, tag: "Major concert" },
  "2026-06-02": { name: "NEUR Conference", boost: 0.16, tag: "Conference Day 1" },
  "2026-06-03": { name: "NEUR Conference", boost: 0.18, tag: "Conference peak" },
  "2026-06-04": { name: "NEUR Conference", boost: 0.14, tag: "Conference Day 3" },
  "2026-06-06": { name: "Red Sox vs Yankees", boost: 0.15, tag: "Marquee series" },
  "2026-06-07": { name: "Red Sox vs Yankees", boost: 0.18, tag: "Saturday game" },
  "2026-06-08": { name: "Red Sox vs Yankees", boost: 0.12, tag: "Sunday game" },
  "2026-06-13": { name: "Boston Pride Parade", boost: 0.08, tag: "City-wide event" },
};

const DOW_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Generate the 90-day window starting from May 13, 2026. */
function generateDays(): SimDay[] {
  const out: SimDay[] = [];
  for (let i = 0; i < 90; i++) {
    const ts = TODAY_UTC + i * 86_400_000;
    const d = new Date(ts);
    const dow = d.getUTCDay();
    const dayOfMonth = d.getUTCDate();
    const monthName = MONTH_NAMES[d.getUTCMonth()];
    const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(dayOfMonth).padStart(2, "0")}`;

    // Gentle seasonal curve peaking ~day 50 (late June/early July)
    const seasonality = 0.92 + Math.sin((i / 90) * Math.PI) * 0.18;

    const evt = KNOWN_EVENTS[iso];

    out.push({
      date: iso,
      dow,
      dowName: DOW_NAMES[dow],
      monthName,
      dayOfMonth,
      isWeekend: dow === 5 || dow === 6,
      seasonality: Number(seasonality.toFixed(3)),
      eventName: evt?.name,
      eventBoost: evt?.boost ?? 0,
      tag: evt?.tag,
    });
  }
  return out;
}

const DAYS_90 = generateDays();

/* ----- Pricing math ----- */

const DOW_BASE_PRICE: Record<number, number> = {
  0: 268, // Sun
  1: 248, // Mon
  2: 245, // Tue
  3: 252, // Wed
  4: 268, // Thu
  5: 312, // Fri
  6: 340, // Sat
};

const DOW_BASE_OCC: Record<number, number> = {
  0: 0.62,
  1: 0.58,
  2: 0.56,
  3: 0.6,
  4: 0.66,
  5: 0.78,
  6: 0.84,
};

const MODE_PRICE_FACTOR: Record<StrategyModeId, number> = {
  maximize_revenue: 1.0,
  maximize_occupancy: 0.92,
  protect_adr: 1.06,
  hit_target: 1.02,
  direct_push: 0.98,
  custom: 1.0,
};

interface SimResult {
  suggestedPrice: number;
  projectedOccupancy: number; // 0 → 1
  projectedRevenue: number;
  drivers: { label: string; sign: "up" | "down" | "neutral" }[];
}

function simulate(day: SimDay, config: StrategyConfig, totalRooms: number): SimResult {
  // 1) Base price for the day
  const basePrice = DOW_BASE_PRICE[day.dow] * day.seasonality * (1 + day.eventBoost * 0.6);
  const baseOcc = Math.min(0.96, DOW_BASE_OCC[day.dow] + day.eventBoost * 0.5);

  // 2) Strategy mode modifier
  const modeFactor = MODE_PRICE_FACTOR[config.modeId];

  // 3) Goal-based adjustment (vs DEFAULTS)
  const revTargetDelta =
    (config.goals.monthlyRevenueTarget - DEFAULT_STRATEGY.goals.monthlyRevenueTarget) /
    DEFAULT_STRATEGY.goals.monthlyRevenueTarget;
  const occTargetDelta =
    (config.goals.targetOccupancy - DEFAULT_STRATEGY.goals.targetOccupancy) /
    DEFAULT_STRATEGY.goals.targetOccupancy;
  // Higher revenue target → push price up; higher occ target → push price down
  const goalPriceMod = 1 + revTargetDelta * 0.35 - occTargetDelta * 0.45;

  // 4) Apply modifiers + clamp to user's floor/ceiling
  let price = basePrice * modeFactor * goalPriceMod;
  price = Math.max(config.goals.adrFloor, Math.min(config.goals.adrCeiling, price));

  // 5) Occupancy response (price elasticity)
  const priceDeltaPct = (price - basePrice) / basePrice;
  const elasticity = -0.45;
  let occ = baseOcc * (1 + elasticity * priceDeltaPct);
  occ = Math.max(0.32, Math.min(0.98, occ));

  // 6) Revenue
  const revenue = price * occ * totalRooms;

  // 7) Drivers (top 3 reasons)
  const drivers: SimResult["drivers"] = [];
  if (day.eventBoost > 0)
    drivers.push({ label: `${day.eventName} event boost`, sign: "up" });
  if (day.isWeekend) drivers.push({ label: `${day.dowName} DOW premium`, sign: "up" });
  if (config.modeId !== "maximize_revenue") {
    const mode = getMode(config.modeId);
    drivers.push({
      label: `${mode.label} mode`,
      sign:
        modeFactor > 1 ? "up" : modeFactor < 1 ? "down" : "neutral",
    });
  }
  if (Math.abs(revTargetDelta) > 0.02)
    drivers.push({
      label: `Revenue target ${revTargetDelta > 0 ? "+" : ""}${(revTargetDelta * 100).toFixed(0)}%`,
      sign: revTargetDelta > 0 ? "up" : "down",
    });
  if (Math.abs(occTargetDelta) > 0.02)
    drivers.push({
      label: `Occupancy target ${occTargetDelta > 0 ? "+" : ""}${(occTargetDelta * 100).toFixed(0)}%`,
      sign: occTargetDelta > 0 ? "down" : "up",
    });
  if (price === config.goals.adrFloor)
    drivers.push({ label: "Clamped to ADR floor", sign: "neutral" });
  if (price === config.goals.adrCeiling)
    drivers.push({ label: "Clamped to ADR ceiling", sign: "neutral" });

  return {
    suggestedPrice: Math.round(price),
    projectedOccupancy: occ,
    projectedRevenue: Math.round(revenue),
    drivers: drivers.slice(0, 3),
  };
}

/* ============================================================
 * Component
 * ============================================================ */

export function DaySimulator() {
  const { config } = useStrategy();
  const { activePropertyId, activeHotel } = usePortfolio();
  const totalRooms = 218; // default; room count derived separately

  // Default selection: the first Saturday in the next 14 days (good demo)
  const defaultIdx = React.useMemo(() => {
    const idx = DAYS_90.findIndex((d) => d.dow === 6 && DAYS_90.indexOf(d) < 14);
    return idx === -1 ? 0 : idx;
  }, []);
  const [selectedIdx, setSelectedIdx] = React.useState(defaultIdx);
  const day = DAYS_90[selectedIdx];

  // Compute baseline (defaults) vs new (current saved config)
  const baseline = React.useMemo(
    () => simulate(day, DEFAULT_STRATEGY, totalRooms),
    [day, totalRooms]
  );
  const newResult = React.useMemo(
    () => simulate(day, config, totalRooms),
    [day, config, totalRooms]
  );

  const priceDelta = newResult.suggestedPrice - baseline.suggestedPrice;
  const priceDeltaPct = (priceDelta / baseline.suggestedPrice) * 100;
  const occDeltaPp = (newResult.projectedOccupancy - baseline.projectedOccupancy) * 100;
  const revDelta = newResult.projectedRevenue - baseline.projectedRevenue;
  const revDeltaPct = (revDelta / baseline.projectedRevenue) * 100;

  // Scroll the chip strip
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const scrollBy = (dir: 1 | -1) => {
    if (!scrollerRef.current) return;
    scrollerRef.current.scrollBy({ left: dir * 360, behavior: "smooth" });
  };

  // Auto-scroll the selected chip into view on first paint
  React.useEffect(() => {
    const el = scrollerRef.current?.querySelector<HTMLButtonElement>(
      `[data-day-idx="${selectedIdx}"]`
    );
    if (el && scrollerRef.current) {
      const offset = el.offsetLeft - scrollerRef.current.clientWidth / 2 + el.clientWidth / 2;
      scrollerRef.current.scrollTo({ left: offset, behavior: "auto" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const quickPicks: { label: string; predicate: (d: SimDay, i: number) => boolean }[] = [
    { label: "This Saturday", predicate: (d, i) => d.dow === 6 && i < 14 },
    { label: "Memorial Day weekend", predicate: (d) => d.date === "2026-05-24" },
    { label: "Coldplay night (May 30)", predicate: (d) => d.date === "2026-05-30" },
  ];

  const pickQuick = (predicate: (d: SimDay, i: number) => boolean) => {
    const idx = DAYS_90.findIndex(predicate);
    if (idx >= 0) {
      setSelectedIdx(idx);
      // Center the scroller on the picked chip
      requestAnimationFrame(() => {
        const el = scrollerRef.current?.querySelector<HTMLButtonElement>(
          `[data-day-idx="${idx}"]`
        );
        if (el && scrollerRef.current) {
          const offset = el.offsetLeft - scrollerRef.current.clientWidth / 2 + el.clientWidth / 2;
          scrollerRef.current.scrollTo({ left: offset, behavior: "smooth" });
        }
      });
    }
  };

  const activeMode = getMode(config.modeId);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand-500" />
              What does this do? — Day simulator
            </CardTitle>
            <CardDescription>
              Pick a date in the next 90 days. We&apos;ll show side-by-side how a neutral baseline
              and your current strategy <em>(mode: {activeMode.label})</em> would price that night.
            </CardDescription>
          </div>
          <Badge variant="info" className="text-[10px] shrink-0">
            <Info className="h-3 w-3" />
            Reflects your latest saved goals
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Quick picks */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Quick picks
          </span>
          {quickPicks.map((qp) => (
            <Button
              key={qp.label}
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => pickQuick(qp.predicate)}
            >
              <CalendarDays className="h-3 w-3" />
              {qp.label}
            </Button>
          ))}
        </div>

        {/* Day chip strip */}
        <div className="relative">
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-card to-transparent pointer-events-none z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-card to-transparent pointer-events-none z-10" />
          <button
            onClick={() => scrollBy(-1)}
            className="absolute left-1 top-1/2 -translate-y-1/2 z-20 h-7 w-7 rounded-full bg-background border border-border shadow-sm hover:bg-accent flex items-center justify-center"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => scrollBy(1)}
            className="absolute right-1 top-1/2 -translate-y-1/2 z-20 h-7 w-7 rounded-full bg-background border border-border shadow-sm hover:bg-accent flex items-center justify-center"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <div
            ref={scrollerRef}
            className="overflow-x-auto scrollbar-none px-10 py-1"
            style={{ scrollbarWidth: "none" }}
          >
            <div className="flex gap-1.5">
              {DAYS_90.map((d, i) => (
                <DayChip
                  key={d.date}
                  day={d}
                  index={i}
                  isSelected={i === selectedIdx}
                  isToday={i === 0}
                  onClick={() => setSelectedIdx(i)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Comparison card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={day.date}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="rounded-xl border border-border bg-background overflow-hidden"
          >
            {/* Day header */}
            <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center gap-3 flex-wrap">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 ring-1 ring-inset ring-brand-200/60 dark:ring-brand-800/60 shrink-0">
                <CalendarDays className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-base font-semibold leading-tight">
                  {day.dowName} · {day.monthName} {day.dayOfMonth}, 2026
                </div>
                <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                  {day.tag ?? (day.isWeekend ? "Weekend night" : "Midweek night")}
                  {(activeHotel || activePropertyId) && (
                    <>
                      <span className="mx-1.5">·</span>
                      <span>
                        {activeHotel?.name ?? activePropertyId} · {totalRooms} rooms
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Side-by-side */}
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
              <SimColumn label="Baseline" subLabel="Neutral · Maximize Revenue · default goals" result={baseline} tone="muted" />
              <SimColumn
                label="With your strategy"
                subLabel={`${activeMode.label} · your saved goals`}
                result={newResult}
                tone="brand"
              />
            </div>

            {/* Net impact strip */}
            <div className="px-4 py-3 border-t border-border bg-gradient-to-r from-brand-50/70 via-card to-card dark:from-brand-900/20">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Net impact if applied to this single day
              </div>
              <div className="flex items-center gap-4 flex-wrap text-sm">
                <DeltaPill
                  label="ADR"
                  value={`${priceDelta > 0 ? "+" : ""}${formatCurrency(priceDelta)}`}
                  pct={priceDeltaPct}
                />
                <DeltaPill
                  label="Occupancy"
                  value={`${occDeltaPp > 0 ? "+" : ""}${occDeltaPp.toFixed(1)} pts`}
                  pct={occDeltaPp}
                  isPp
                />
                <DeltaPill
                  label="Revenue"
                  value={`${revDelta > 0 ? "+" : ""}${formatCurrency(revDelta)}`}
                  pct={revDeltaPct}
                  primary
                />
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="text-[10px] text-muted-foreground leading-snug">
          Simulation uses your current saved strategy mode and goals. Numbers projected from
          historical demand curves, day-of-week elasticity, and known events on the date. Actual
          results vary with pickup, comp-set moves, and channel mix.
        </div>
      </CardContent>
    </Card>
  );
}

/* ============================================================
 * Sub-components
 * ============================================================ */

function DayChip({
  day,
  index,
  isSelected,
  isToday,
  onClick,
}: {
  day: SimDay;
  index: number;
  isSelected: boolean;
  isToday: boolean;
  onClick: () => void;
}) {
  return (
    <button
      data-day-idx={index}
      onClick={onClick}
      className={cn(
        "relative shrink-0 w-14 h-16 rounded-lg border text-center transition-all",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
        isSelected
          ? "border-brand-500 bg-brand-50 dark:bg-brand-900/40 shadow-sm"
          : "border-border bg-card hover:bg-accent/40",
        day.isWeekend && !isSelected && "bg-muted/30"
      )}
    >
      {isToday && (
        <span className="absolute top-1 left-1 right-1 h-0.5 rounded-full bg-brand-500" />
      )}
      {day.eventBoost > 0 && !isToday && (
        <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-amber-500" />
      )}
      <div
        className={cn(
          "mt-1.5 text-[9px] font-semibold uppercase tracking-wider",
          isSelected ? "text-brand-700 dark:text-brand-300" : "text-muted-foreground"
        )}
      >
        {day.dowName}
      </div>
      <div
        className={cn(
          "text-lg font-bold tabular-nums leading-tight",
          isSelected && "text-brand-700 dark:text-brand-300"
        )}
      >
        {day.dayOfMonth}
      </div>
      <div className="text-[8px] text-muted-foreground uppercase font-medium leading-tight">
        {day.monthName}
      </div>
    </button>
  );
}

function SimColumn({
  label,
  subLabel,
  result,
  tone,
}: {
  label: string;
  subLabel: string;
  result: SimResult;
  tone: "muted" | "brand";
}) {
  const isBrand = tone === "brand";
  return (
    <div
      className={cn(
        "p-4 space-y-3",
        isBrand && "bg-brand-50/40 dark:bg-brand-900/15"
      )}
    >
      <div>
        <div
          className={cn(
            "text-[10px] font-semibold uppercase tracking-wider",
            isBrand
              ? "text-brand-700 dark:text-brand-300"
              : "text-muted-foreground"
          )}
        >
          {label}
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5">{subLabel}</div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <SimMetric label="Price" value={formatCurrency(result.suggestedPrice)} emphasis={isBrand} />
        <SimMetric
          label="Occupancy"
          value={`${(result.projectedOccupancy * 100).toFixed(0)}%`}
          emphasis={isBrand}
        />
        <SimMetric
          label="Revenue"
          value={compactMoney(result.projectedRevenue)}
          emphasis={isBrand}
        />
      </div>

      {result.drivers.length > 0 && (
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Key drivers
          </div>
          <ul className="space-y-1">
            {result.drivers.map((d, i) => (
              <li
                key={i}
                className="flex items-center gap-1.5 text-[11px] text-foreground"
              >
                {d.sign === "up" ? (
                  <TrendingUp className="h-3 w-3 text-emerald-500 shrink-0" />
                ) : d.sign === "down" ? (
                  <TrendingDown className="h-3 w-3 text-red-500 shrink-0" />
                ) : (
                  <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                )}
                <span>{d.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SimMetric({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div>
      <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "text-base font-bold tabular-nums leading-tight mt-0.5",
          emphasis && "text-brand-700 dark:text-brand-300"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function DeltaPill({
  label,
  value,
  pct,
  isPp,
  primary,
}: {
  label: string;
  value: string;
  pct: number;
  isPp?: boolean;
  primary?: boolean;
}) {
  const up = pct >= 0;
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
      <span
        className={cn(
          "font-bold tabular-nums",
          primary ? "text-lg" : "text-sm",
          up
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-red-600 dark:text-red-400"
        )}
      >
        {value}
      </span>
      {!isPp && (
        <span
          className={cn(
            "text-[10px] font-semibold",
            up
              ? "text-emerald-600/80 dark:text-emerald-400/80"
              : "text-red-600/80 dark:text-red-400/80"
          )}
        >
          ({pct > 0 ? "+" : ""}
          {pct.toFixed(1)}%)
        </span>
      )}
    </div>
  );
}

function compactMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `$${(n / 1_000).toFixed(1)}k`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}k`;
  return formatCurrency(n);
}
