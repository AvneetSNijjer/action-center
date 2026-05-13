"use client";
import { AlertCircle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  variant?: "card" | "inline";
  className?: string;
}

/**
 * Standard error-state UI for API/data failures.
 * Use `variant="card"` for top-of-page failures, `variant="inline"` for
 * smaller widgets that should not dominate the layout.
 */
export function ErrorState({
  title = "Something went wrong",
  message = "We couldn't load this data. The database might be unreachable.",
  onRetry,
  variant = "card",
  className,
}: ErrorStateProps) {
  if (variant === "inline") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/80 dark:bg-red-950/30 px-3 py-2 text-xs text-red-800 dark:text-red-200",
          className
        )}
      >
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1 min-w-0 truncate">{message}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="font-semibold hover:underline shrink-0"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/60 dark:bg-red-950/20 p-6 text-center",
        className
      )}
    >
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400">
        <AlertCircle className="h-5 w-5" />
      </div>
      <div className="mt-3 font-semibold text-red-900 dark:text-red-100">{title}</div>
      <p className="mt-1 text-sm text-red-800/80 dark:text-red-200/80 max-w-md mx-auto">
        {message}
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-4">
          <RotateCw className="h-3.5 w-3.5" />
          Retry
        </Button>
      )}
    </div>
  );
}
