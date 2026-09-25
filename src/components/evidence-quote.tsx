import type { EvidenceChunk } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export function EvidenceQuote({
  chunk,
  className,
  highlighted = false,
}: {
  chunk: EvidenceChunk;
  className?: string;
  highlighted?: boolean;
}) {
  return (
    <blockquote
      id={`chunk-${chunk.id}`}
      className={cn(
        "border-l-2 border-primary/50 py-1 pl-3 text-sm leading-relaxed text-foreground/90",
        highlighted && "rounded-r-md bg-primary/5 pr-2",
        className,
      )}
    >
      <p>{chunk.text}</p>
      <footer className="mt-1.5 text-xs text-muted-foreground">
        {chunk.section}
        {chunk.page != null ? ` · p. ${chunk.page}` : ""}
        <span className="sr-only"> Retrieved excerpt</span>
      </footer>
    </blockquote>
  );
}
