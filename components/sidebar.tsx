"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, History, Settings, BarChart3, Bell, Building2, ChevronDown, Compass } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { HOTELS } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";

const nav = [
  { href: "/", label: "Action Center", Icon: LayoutDashboard, badge: 8 },
  { href: "/strategy", label: "Pricing Strategy", Icon: Compass },
  { href: "/history", label: "History", Icon: History },
  { href: "/analytics", label: "Analytics", Icon: BarChart3, disabled: true },
  { href: "/notifications", label: "Notifications", Icon: Bell, disabled: true },
  { href: "/settings", label: "Settings", Icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-card/40">
      <div className="flex h-16 items-center gap-2 px-5 border-b border-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-white font-bold">
          a
        </div>
        <div>
          <div className="text-sm font-semibold leading-tight">ampliphi</div>
          <div className="text-[10px] text-muted-foreground leading-none">Revenue OS</div>
        </div>
      </div>

      <div className="px-3 py-3">
        <button className="flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-sm hover:bg-accent transition-colors">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <div className="truncate font-medium">{HOTELS[0].name}</div>
            <div className="text-[10px] text-muted-foreground">{HOTELS[0].location} · {HOTELS[0].rooms} rooms</div>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      <nav className="flex-1 px-3 space-y-0.5">
        {nav.map(({ href, label, Icon, badge, disabled }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={disabled ? "#" : href}
              className={cn(
                "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
                disabled && "opacity-40 cursor-not-allowed"
              )}
            >
              {active && (
                <motion.span
                  layoutId="active-pill"
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r bg-brand-500"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <Icon className="h-4 w-4" />
              <span className="flex-1">{label}</span>
              {badge !== undefined && (
                <Badge variant="info" className="px-1.5 py-0 text-[10px] font-semibold">
                  {badge}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="m-3 rounded-xl border border-border bg-gradient-to-br from-brand-50 to-white dark:from-brand-900/30 dark:to-transparent p-4">
        <div className="text-xs font-semibold text-brand-700 dark:text-brand-300">Pro tip</div>
        <p className="mt-1 text-xs leading-snug text-muted-foreground">
          Snooze insights you can&apos;t act on now — they&apos;ll resurface automatically.
        </p>
      </div>
    </aside>
  );
}
