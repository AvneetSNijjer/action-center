import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(n: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

/** Parse "London, UK" or "New York, NY, USA" into city + state. */
export function splitLocation(location: string): { city: string; state: string } {
  if (!location) return { city: "", state: "" };
  const parts = location.split(",").map((s) => s.trim());
  if (parts.length >= 2) return { city: parts[0], state: parts[parts.length - 1] };
  return { city: location.trim(), state: "" };
}

export function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
