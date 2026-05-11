"use client";
import { AnimatePresence, motion } from "framer-motion";
import { X, Check, Clock, ChevronsUpDown, BookOpen, Database, Calendar, Building2 } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SeverityIcon, severityLabel } from "@/components/severity-icon";
import { WhyThisPrice } from "@/components/why-this-price";
import type { Insight } from "@/lib/types";
import { cn, formatCurrency, formatRelativeTime } from "@/lib/utils";

export function InsightDetailPanel({
  insight,
  onClose,
  onAction,
}: {
  insight: Insight | null;
  onClose: () => void;
  onAction: (actionId: string, insight: Insight) => void;
}) {
  return (
    <AnimatePresence>
      {insight && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full sm:max-w-xl flex flex-col bg-card shadow-2xl border-l border-border"
          >
            <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
              <div className="flex items-center gap-3">
                <SeverityIcon severity={insight.severity} size="sm" />
                <div>
                  <Badge variant={insight.severity}>{severityLabel[insight.severity]}</Badge>
                  <div className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    {formatRelativeTime(insight.createdAt)}
                    {insight.source && (
                      <>
                        <span>·</span>
                        <span className="truncate">{insight.source}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="px-6 py-5 space-y-5">
                <div>
                  <h2 className="text-xl font-semibold leading-tight tracking-tight">
                    {insight.title}
                  </h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {insight.hotel}
                    </span>
                    {insight.roomType && (
                      <>
                        <span>·</span>
                        <span>{insight.roomType}</span>
                      </>
                    )}
                  </div>
                </div>

                {insight.revenueImpact !== undefined && insight.revenueImpact !== 0 && (
                  <div
                    className={cn(
                      "rounded-xl border p-4",
                      insight.revenueImpact > 0
                        ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900/50"
                        : "border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900/50"
                    )}
                  >
                    <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      {insight.revenueImpact > 0 ? "Potential revenue capture" : "Revenue at risk"}
                    </div>
                    <div
                      className={cn(
                        "mt-1 text-3xl font-bold tabular-nums",
                        insight.revenueImpact > 0
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-red-700 dark:text-red-400"
                      )}
                    >
                      {insight.revenueImpact > 0 ? "+" : ""}
                      {formatCurrency(insight.revenueImpact)}
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <BookOpen className="h-3 w-3" /> Why this matters
                  </div>
                  <p className="text-sm leading-relaxed text-foreground">{insight.body}</p>
                </div>

                {insight.explainability && <WhyThisPrice insight={insight} />}

                {insight.metrics.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Key metrics
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {insight.metrics.map((m) => (
                        <div
                          key={m.label}
                          className="rounded-lg border border-border bg-background p-3"
                        >
                          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                            {m.label}
                          </div>
                          <div className="mt-0.5 text-lg font-semibold tabular-nums">{m.value}</div>
                          {m.delta && (
                            <div
                              className={cn(
                                "text-[11px] font-medium",
                                m.trend === "up" && "text-emerald-600",
                                m.trend === "down" && "text-red-600"
                              )}
                            >
                              {m.delta}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {insight.chart && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Visual breakdown
                    </div>
                    <div className="rounded-xl border border-border bg-background p-4">
                      <div className="h-56 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          {insight.chart.kind === "bar" ? (
                            <BarChart data={insight.chart.data}>
                              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                              <Tooltip
                                contentStyle={{
                                  border: "1px solid hsl(var(--border))",
                                  borderRadius: 8,
                                  background: "hsl(var(--popover))",
                                  fontSize: 12,
                                }}
                              />
                              {insight.chart.bLabel && <Legend wrapperStyle={{ fontSize: 11 }} />}
                              <Bar dataKey="a" name={insight.chart.aLabel || "A"} fill="#0066cc" radius={[6, 6, 0, 0]} />
                              {insight.chart.bLabel && (
                                <Bar dataKey="b" name={insight.chart.bLabel} fill="#10b981" radius={[6, 6, 0, 0]} />
                              )}
                            </BarChart>
                          ) : (
                            <LineChart data={insight.chart.data}>
                              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                              <Tooltip
                                contentStyle={{
                                  border: "1px solid hsl(var(--border))",
                                  borderRadius: 8,
                                  background: "hsl(var(--popover))",
                                  fontSize: 12,
                                }}
                              />
                              <Legend wrapperStyle={{ fontSize: 11 }} />
                              <Line type="monotone" dataKey="a" name={insight.chart.aLabel || "A"} stroke="#94a3b8" strokeWidth={2} dot={{ r: 3 }} />
                              <Line type="monotone" dataKey="b" name={insight.chart.bLabel || "B"} stroke="#0066cc" strokeWidth={2.5} dot={{ r: 3 }} />
                            </LineChart>
                          )}
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}

                {insight.affectedDates && insight.affectedDates.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" /> Affected dates
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {insight.affectedDates.map((d) => (
                        <Badge key={d} variant="outline" className="font-mono text-[11px]">
                          {new Date(d).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <Separator />

                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Database className="h-3 w-3" /> Data sources
                  </div>
                  <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs font-mono text-muted-foreground">
                    {insight.source}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-border bg-background/60 backdrop-blur px-6 py-4">
              <div className="flex flex-wrap items-center justify-end gap-2">
                {insight.actions.map((a) => (
                  <Button
                    key={a.id}
                    variant={a.primary ? "default" : a.id === "dismiss" ? "outline" : "secondary"}
                    onClick={() => onAction(a.id, insight)}
                    size={a.primary ? "default" : "sm"}
                  >
                    {a.primary && <Check className="h-4 w-4" />}
                    {a.label}
                  </Button>
                ))}
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
