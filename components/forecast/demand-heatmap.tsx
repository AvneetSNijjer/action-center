"use client";
import * as React from "react";
import useSWR from "swr";
import { motion } from "framer-motion";
import { Calendar, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";
import { usePortfolio } from "@/components/portfolio-provider";
import type { HeatmapCell } from "@/lib/queries/forecast";

type Mode = "pace" | "occupancy";
const DOW_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

function paceColor(p: number) {
  if (p <= -0.25) return "bg-red-600/85 ring-red-700/30";
  if (p <= -0.15) return "bg-red-500/75 ring-red-600/30";
  if (p <= -0.05) return "bg-amber-400/80 ring-amber-500/30";
  if (p <= 0.05)  return "bg-emerald-300/70 ring-emerald-400/30";
  if (p <= 0.15)  return "bg-emerald-500/80 ring-emerald-600/30";
  if (p <= 0.25)  return "bg-emerald-600/85 ring-emerald-700/30";
  return "bg-emerald-700/90 ring-emerald-800/30";
}

function occColor(o: number) {
  if (o < 0.5)  return "bg-red-500/75 ring-red-600/30";
  if (o < 0.65) return "bg-amber-400/80 ring-amber-500/30";
  if (o < 0.8)  return "bg-emerald-400/75 ring-emerald-500/30";
  return "bg-emerald-600/85 ring-emerald-700/30";
}

export function DemandHeatmap() {
  const { activePropertyId } = usePortfolio();
  const [mode, setMode] = React.useState<Mode>("pace");
  const [hovered, setHovered] = React.useState<number | null>(null);

  const { data, isLoading, error } = useSWR<{ ok: boolean; data: HeatmapCell[] }>(
    `/api/hotels/${activePropertyId}/forecast/heatmap`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 }
  );

  const cells: HeatmapCell[] = data?.ok ? data.data : [];

  // Group into week columns
  const weeks: (HeatmapCell | null)[][] = [];
  let current: (HeatmapCell | null)[] = [];
  cells.forEach((cell, idx) => {
    if (idx === 0) {
      for (let p = 0; p < cell.dow; p++) current.push(null);
    }
    current.push(cell);
    if (cell.dow === 6) {
      weeks.push(current);
      current = [];
    }
  });
  if (current.length) {
    while (current.length < 7) current.push(null);
    weeks.push(current);
  }

  const detail = hovered !== null ? cells[hovered] : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-brand-500" />
              90-day demand heatmap
            </CardTitle>
            <CardDescription>
              Color-coded OTB at a glance. Hover any cell for detail.
            </CardDescription>
          </div>
          <div className="flex items-center rounded-md border border-border bg-card p-0.5">
            {(["pace", "occupancy"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium transition-colors capitalize",
                  mode === m
                    ? "bg-brand-500 text-white"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-48 items-center justify-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading heatmap…
          </div>
        ) : error ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            Could not load heatmap data.
          </div>
        ) : cells.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            No inventory data available for this property.
          </div>
        ) : (
          <>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {/* DOW labels */}
              <div className="flex flex-col gap-1 pt-5 text-[10px] text-muted-foreground shrink-0">
                {DOW_LABELS.map((d, i) => (
                  <div key={i} className="h-6 flex items-center w-3 font-medium">
                    {d}
                  </div>
                ))}
              </div>

              {/* Week columns */}
              <div className="flex gap-1">
                {weeks.map((wk, wi) => {
                  const firstReal = wk.find(Boolean) as HeatmapCell | undefined;
                  const monthLabel =
                    wi % 2 === 0 && firstReal
                      ? new Date(firstReal.date + "T00:00:00Z").toLocaleDateString("en-US", {
                          month: "short",
                          timeZone: "UTC",
                        })
                      : "";
                  return (
                    <div key={wi} className="flex flex-col gap-1">
                      <div className="text-[9px] text-muted-foreground h-3.5 text-center font-medium">
                        {monthLabel}
                      </div>
                      {Array.from({ length: 7 }).map((_, di) => {
                        const cell = wk[di];
                        if (!cell) return <div key={di} className="h-6 w-6" />;
                        const idx = cells.indexOf(cell);
                        const color =
                          mode === "pace" ? paceColor(cell.paceIndex) : occColor(cell.occupancy);
                        return (
                          <motion.button
                            key={di}
                            whileHover={{ scale: 1.3, zIndex: 10 }}
                            onHoverStart={() => setHovered(idx)}
                            onHoverEnd={() => setHovered(null)}
                            className={cn(
                              "h-6 w-6 rounded-md ring-1 ring-inset cursor-pointer transition-shadow",
                              color,
                              hovered === idx && "shadow-lg"
                            )}
                            aria-label={cell.date}
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Hover detail card */}
            <motion.div
              initial={false}
              animate={{ opacity: detail ? 1 : 0.5 }}
              className="mt-4 rounded-lg border border-border bg-card/60 p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 min-h-[64px]"
            >
              {detail ? (
                <>
                  <Detail label="Date">
                    {new Date(detail.date + "T00:00:00Z").toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      timeZone: "UTC",
                    })}
                  </Detail>
                  <Detail label="OTB occupancy">
                    <span className="font-semibold tabular-nums">
                      {(detail.occupancy * 100).toFixed(0)}%
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-1">
                      ({detail.roomsSold}/{detail.totalRooms} rooms)
                    </span>
                  </Detail>
                  <Detail label="Pace vs avg">
                    <span
                      className={cn(
                        "font-semibold tabular-nums",
                        detail.paceIndex > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      )}
                    >
                      {detail.paceIndex > 0 ? "+" : ""}
                      {(detail.paceIndex * 100).toFixed(0)}%
                    </span>
                  </Detail>
                  <Detail label="Suggested price">
                    <span className="font-semibold tabular-nums">
                      {detail.suggestedPrice > 0 ? formatCurrency(detail.suggestedPrice) : "—"}
                    </span>
                  </Detail>
                </>
              ) : (
                <div className="col-span-full text-xs text-muted-foreground italic">
                  Hover any cell to see details for that night.
                </div>
              )}
            </motion.div>
          </>
        )}

        {/* Legend */}
        <div className="mt-3 flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
          <span>Less</span>
          {mode === "pace" ? (
            <div className="flex gap-1">
              <span className="h-3 w-6 rounded bg-red-600/85" />
              <span className="h-3 w-6 rounded bg-red-500/75" />
              <span className="h-3 w-6 rounded bg-amber-400/80" />
              <span className="h-3 w-6 rounded bg-emerald-300/70" />
              <span className="h-3 w-6 rounded bg-emerald-500/80" />
              <span className="h-3 w-6 rounded bg-emerald-700/90" />
            </div>
          ) : (
            <div className="flex gap-1">
              <span className="h-3 w-6 rounded bg-red-500/75" />
              <span className="h-3 w-6 rounded bg-amber-400/80" />
              <span className="h-3 w-6 rounded bg-emerald-400/75" />
              <span className="h-3 w-6 rounded bg-emerald-600/85" />
            </div>
          )}
          <span>More</span>
          <span className="ml-auto text-[10px]">
            Live · daily_inventory + suggested_prices
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}
