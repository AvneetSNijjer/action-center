"use client";
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Check, Clock, BookOpen, Database, Calendar, Building2, Sparkles, Loader2, ChevronDown } from "lucide-react";
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
  hotelId,
  onClose,
  onAction,
}: {
  insight: Insight | null;
  hotelId?: string;
  onClose: () => void;
  onAction: (actionId: string, insight: Insight) => void;
}) {
  const [aiText, setAiText]         = React.useState<string>("");
  const [aiLoading, setAiLoading]   = React.useState(false);
  const [aiError, setAiError]       = React.useState<string | null>(null);
  const [aiRequested, setAiRequested] = React.useState(false);

  // Auto-fetch suggested price calculation for Why This Price panel
  const [enrichedInsight, setEnrichedInsight] = React.useState<Insight | null>(null);
  React.useEffect(() => {
    if (!insight) { setEnrichedInsight(null); return; }
    setEnrichedInsight(insight);  // show immediately with what we have

    // If explainability exists but no calculation, try to fetch it
    if (insight.explainability && !insight.explainability.calculation && insight.affectedDates?.[0]) {
      const date = insight.affectedDates[0];
      fetch(`/api/hotels/${hotelId ?? insight.hotel}/suggested-price?date=${date}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.ok && res.data) {
            setEnrichedInsight((prev) => {
              if (!prev || !prev.explainability) return prev;
              return {
                ...prev,
                explainability: { ...prev.explainability, calculation: res.data },
              };
            });
          }
        })
        .catch(() => { /* silently ignore — panel still shows without calc */ });
    }
  }, [insight?.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Reset AI state when insight changes
  React.useEffect(() => {
    setAiText("");
    setAiLoading(false);
    setAiError(null);
    setAiRequested(false);
  }, [insight?.id]);

  async function requestAiAnalysis() {
    if (!insight || aiRequested) return;
    setAiRequested(true);
    setAiLoading(true);
    setAiText("");
    setAiError(null);

    try {
      const res = await fetch("/api/insights/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type:            insight.type,
          title:           insight.title,
          description:     insight.body,
          hotelName:       insight.hotel,
          hotelId:         insight.hotel,
          affectedDates:   insight.affectedDates,
          confidenceScore: insight.metrics.length,
        }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error ?? "AI analysis unavailable");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (value) setAiText((prev) => prev + decoder.decode(value, { stream: !d }));
      }
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "AI analysis failed");
    } finally {
      setAiLoading(false);
    }
  }

  const panel = enrichedInsight ?? insight;

  return (
    <AnimatePresence>
      {panel && (
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
                <SeverityIcon severity={panel.severity} size="sm" />
                <div>
                  <Badge variant={panel.severity}>{severityLabel[panel.severity]}</Badge>
                  <div className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    {formatRelativeTime(panel.createdAt)}
                    {panel.source && (
                      <>
                        <span>·</span>
                        <span className="truncate">{panel.source}</span>
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
                    {panel.title}
                  </h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {panel.hotel}
                    </span>
                    {panel.roomType && (
                      <>
                        <span>·</span>
                        <span>{panel.roomType}</span>
                      </>
                    )}
                  </div>
                </div>

                {panel.revenueImpact !== undefined && panel.revenueImpact !== 0 && (
                  <div
                    className={cn(
                      "rounded-xl border p-4",
                      panel.revenueImpact > 0
                        ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900/50"
                        : "border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900/50"
                    )}
                  >
                    <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      {panel.revenueImpact > 0 ? "Potential revenue capture" : "Revenue at risk"}
                    </div>
                    <div
                      className={cn(
                        "mt-1 text-3xl font-bold tabular-nums",
                        panel.revenueImpact > 0
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-red-700 dark:text-red-400"
                      )}
                    >
                      {panel.revenueImpact > 0 ? "+" : ""}
                      {formatCurrency(panel.revenueImpact)}
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <BookOpen className="h-3 w-3" /> Why this matters
                  </div>
                  <p className="text-sm leading-relaxed text-foreground">{panel.body}</p>
                </div>

                {panel.explainability && <WhyThisPrice insight={panel} />}

                {/* ── Claude AI Analysis ── */}
                <div className="rounded-xl border border-border overflow-hidden">
                  <button
                    onClick={requestAiAnalysis}
                    disabled={aiLoading}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                      "hover:bg-muted/40",
                      aiRequested && "bg-muted/20"
                    )}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300 ring-1 ring-inset ring-violet-200/60 dark:ring-violet-800/60">
                      {aiLoading
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Sparkles className="h-4 w-4" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold leading-tight">
                        {aiRequested ? "AI Analysis" : "Get AI Analysis"}
                      </div>
                      <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                        {aiLoading
                          ? "Claude is analysing this insight…"
                          : aiRequested
                          ? "Powered by Claude Haiku"
                          : "Ask Claude for deeper reasoning and a specific recommendation"}
                      </div>
                    </div>
                    {!aiRequested && <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                  </button>

                  <AnimatePresence initial={false}>
                    {aiRequested && (aiText || aiLoading || aiError) && (
                      <motion.div
                        key="ai-body"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden border-t border-border"
                      >
                        <div className="px-4 py-3">
                          {aiError ? (
                            <p className="text-sm text-red-600 dark:text-red-400">{aiError}</p>
                          ) : (
                            <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                              {aiText}
                              {aiLoading && (
                                <span className="inline-block w-1 h-4 ml-0.5 bg-violet-500 animate-pulse rounded-full" />
                              )}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {panel.metrics.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Key metrics
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {panel.metrics.map((m) => (
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

                {panel.chart && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Visual breakdown
                    </div>
                    <div className="rounded-xl border border-border bg-background p-4">
                      <div className="h-56 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          {panel.chart.kind === "bar" ? (
                            <BarChart data={panel.chart.data}>
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
                              {panel.chart.bLabel && <Legend wrapperStyle={{ fontSize: 11 }} />}
                              <Bar dataKey="a" name={panel.chart.aLabel || "A"} fill="#0066cc" radius={[6, 6, 0, 0]} />
                              {panel.chart.bLabel && (
                                <Bar dataKey="b" name={panel.chart.bLabel} fill="#10b981" radius={[6, 6, 0, 0]} />
                              )}
                            </BarChart>
                          ) : (
                            <LineChart data={panel.chart.data}>
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
                              <Line type="monotone" dataKey="a" name={panel.chart.aLabel || "A"} stroke="#94a3b8" strokeWidth={2} dot={{ r: 3 }} />
                              <Line type="monotone" dataKey="b" name={panel.chart.bLabel || "B"} stroke="#0066cc" strokeWidth={2.5} dot={{ r: 3 }} />
                            </LineChart>
                          )}
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}

                {panel.affectedDates && panel.affectedDates.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" /> Affected dates
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {panel.affectedDates.map((d) => (
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
                    {panel.source}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-border bg-background/60 backdrop-blur px-6 py-4">
              <div className="flex flex-wrap items-center justify-end gap-2">
                {panel.actions.map((a) => (
                  <Button
                    key={a.id}
                    variant={a.primary ? "default" : a.id === "dismiss" ? "outline" : "secondary"}
                    onClick={() => onAction(a.id, panel)}
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
