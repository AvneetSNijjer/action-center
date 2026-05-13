import { cn } from "@/lib/utils";

/**
 * Generic shimmer skeleton. Compose into page-level skeletons.
 *
 *   <Skeleton className="h-8 w-64" />
 *   <Skeleton.Card />
 *   <Skeleton.Stat />
 */

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted/60", className)}
      {...props}
    />
  );
}

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card/60 p-5 space-y-3",
        className
      )}
    >
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-3 w-40" />
    </div>
  );
}

function SkeletonStat({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card/60 p-4 space-y-2",
        className
      )}
    >
      <Skeleton className="h-2.5 w-16" />
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-2.5 w-20" />
    </div>
  );
}

function SkeletonChart({ className, height = 224 }: { className?: string; height?: number }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card/60 p-5 space-y-3",
        className
      )}
    >
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-3 w-72" />
      <Skeleton className="w-full" style={{ height }} />
    </div>
  );
}

function SkeletonTable({
  rows = 6,
  cols = 5,
  className,
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card/60 overflow-hidden",
        className
      )}
    >
      <div className="p-4 space-y-3">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-72" />
      </div>
      <div className="border-t border-border divide-y divide-border">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="grid gap-2 px-4 py-3"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: cols }).map((_, j) => (
              <Skeleton key={j} className="h-3 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonHeader({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      <Skeleton className="h-7 w-64" />
      <Skeleton className="h-3 w-96" />
    </div>
  );
}

Skeleton.Card = SkeletonCard;
Skeleton.Stat = SkeletonStat;
Skeleton.Chart = SkeletonChart;
Skeleton.Table = SkeletonTable;
Skeleton.Header = SkeletonHeader;
