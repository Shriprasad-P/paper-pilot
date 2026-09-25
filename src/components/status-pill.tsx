import { AlertTriangle, Ban, Check, Loader2, Lock } from "lucide-react";
import type { PaperStatus } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const COPY: Record<PaperStatus, string> = {
  indexing: "Indexing",
  ready: "Ready",
  partial: "Partial",
  failed: "Failed",
  paywalled: "Paywalled",
};

export function StatusPill({
  status,
  detail,
  className,
}: {
  status: PaperStatus;
  detail?: string;
  className?: string;
}) {
  const Icon =
    status === "indexing"
      ? Loader2
      : status === "ready"
        ? Check
        : status === "partial"
          ? AlertTriangle
          : status === "paywalled"
            ? Lock
            : Ban;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        status === "ready" && "border-emerald-700/20 bg-emerald-700/10 text-emerald-900",
        status === "indexing" && "border-primary/20 bg-primary/10 text-primary",
        status === "partial" && "border-amber-700/25 bg-amber-700/10 text-amber-950",
        status === "failed" && "border-destructive/30 bg-destructive/10 text-destructive",
        status === "paywalled" && "border-stone-400/40 bg-stone-200/70 text-stone-800",
        className,
      )}
      title={detail || COPY[status]}
    >
      <Icon
        className={cn("size-3.5", status === "indexing" && "animate-spin")}
        aria-hidden
      />
      {COPY[status]}
    </span>
  );
}
