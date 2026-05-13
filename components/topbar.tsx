"use client";
import { Bell, HelpCircle } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { ScopeSelector } from "@/components/scope-selector";
import { Button } from "@/components/ui/button";

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 lg:px-8 backdrop-blur-lg">
      <div className="flex items-center gap-2 lg:hidden">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-500 text-white font-bold text-sm">
          a
        </div>
        <span className="font-semibold">ampliphi</span>
      </div>

      <ScopeSelector />

      <div className="flex-1" />

      <div className="flex items-center gap-1.5">
        <Button variant="ghost" size="icon" aria-label="Help">
          <HelpCircle className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="h-4 w-4" />
          <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-red-500" />
        </Button>
        <ThemeToggle />
        <div className="ml-1 flex items-center gap-2 rounded-full border border-border bg-card px-1 py-1 pr-3">
          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-brand-400 to-brand-700 text-white text-[10px] font-semibold grid place-items-center">
            AS
          </div>
          <span className="text-xs font-medium hidden sm:inline">Avneet S.</span>
        </div>
      </div>
    </header>
  );
}
