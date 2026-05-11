"use client";
import * as React from "react";
import { motion } from "framer-motion";
import { Bell, Mail, MessageSquare, Slack } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

const insightTypes = [
  { id: "competitor_change", label: "Competitor price changes" },
  { id: "event_alert", label: "Event alerts" },
  { id: "demand_pacing", label: "Demand & pacing" },
  { id: "cancellation_alert", label: "Cancellation spikes" },
  { id: "revenue_pacing", label: "Revenue pacing" },
  { id: "pending_approvals", label: "Pending approvals digest" },
  { id: "stale_pricing", label: "Stale pricing" },
];

export default function SettingsPage() {
  const [enabled, setEnabled] = React.useState<Record<string, boolean>>(
    Object.fromEntries(insightTypes.map((t) => [t.id, true]))
  );
  const [channels, setChannels] = React.useState({
    inApp: true,
    email: true,
    slack: false,
    mobile: false,
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure which insights you want to see and how you want to hear about them.
        </p>
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader>
            <CardTitle>Insight types</CardTitle>
            <CardDescription>Toggle individual insight types on or off. Disabled insights won&apos;t appear in your feed.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {insightTypes.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div>
                  <div className="text-sm font-medium">{t.label}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {enabled[t.id] ? "Enabled · sending to all channels" : "Disabled"}
                  </div>
                </div>
                <Switch
                  checked={enabled[t.id]}
                  onCheckedChange={(v) => setEnabled({ ...enabled, [t.id]: v })}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card>
          <CardHeader>
            <CardTitle>Delivery channels</CardTitle>
            <CardDescription>Where critical and warning insights should be sent.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Channel
              Icon={Bell}
              label="In-app"
              description="Show in the Action Center feed"
              value={channels.inApp}
              onChange={(v) => setChannels({ ...channels, inApp: v })}
            />
            <Channel
              Icon={Mail}
              label="Email digest"
              description="Daily 8:00 AM digest of new insights"
              value={channels.email}
              onChange={(v) => setChannels({ ...channels, email: v })}
            />
            <Channel
              Icon={Slack}
              label="Slack"
              description="Post critical alerts to #revenue-mgmt"
              value={channels.slack}
              onChange={(v) => setChannels({ ...channels, slack: v })}
              badge="Coming soon"
            />
            <Channel
              Icon={MessageSquare}
              label="Mobile push"
              description="Push critical insights to your phone"
              value={channels.mobile}
              onChange={(v) => setChannels({ ...channels, mobile: v })}
              badge="Coming soon"
            />
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card>
          <CardHeader>
            <CardTitle>Thresholds</CardTitle>
            <CardDescription>How sensitive the engine should be when generating insights.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Competitor price change" value="±$15 or ±5%" />
            <Row label="Demand pacing variance" value="±20%" />
            <Row label="Cancellation spike" value="3× rolling average" />
            <Row label="Revenue pacing gap" value="±10% MTD" />
            <Row label="Stale pricing SLA" value="7 days" />
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

function Channel({
  Icon,
  label,
  description,
  value,
  onChange,
  badge,
}: {
  Icon: any;
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
  badge?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-300">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm font-medium">
          {label}
          {badge && <Badge variant="secondary" className="text-[10px]">{badge}</Badge>}
        </div>
        <div className="text-[11px] text-muted-foreground">{description}</div>
      </div>
      <Switch checked={value} onCheckedChange={onChange} disabled={!!badge} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-xs">{value}</span>
    </div>
  );
}
