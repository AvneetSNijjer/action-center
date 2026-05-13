"use client";

/**
 * Skeleton shown while the portfolio context hydrates from localStorage,
 * preventing a flash of the wrong scope view on first paint.
 */
export function LoadingPage() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-64 rounded bg-muted" />
      <div className="h-32 rounded-xl bg-muted/60" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-32 rounded-xl bg-muted/40" />
        ))}
      </div>
    </div>
  );
}
