"use client";
import { Bell, Search, HelpCircle } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
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

      <div className="hidden md:flex flex-1 max-w-xl items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          placeholder="Search insights, dates, room types..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <kbd className="hidden lg:inline-flex h-5 items-center rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </div>

      <div className="flex-1 md:hidden" />

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
