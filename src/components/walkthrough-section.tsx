"use client";

import { useState } from "react";
import type { DetailLevel, WalkthroughBlock } from "@/lib/api/types";
import { MathText } from "@/components/math-text";
import { Button } from "@/components/ui/button";

export function WalkthroughSection({
  block,
  level,
  onSeeInPaper,
  defaultOpen = false,
}: {
  block: WalkthroughBlock;
  level: DetailLevel;
  onSeeInPaper: (chunkId: string) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const primaryChunk = block.evidenceIds[0];
  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="group border-b border-border py-1"
    >
      <summary className="flex cursor-pointer list-none items-baseline justify-between gap-4 rounded-md px-1 py-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block font-serif text-lg leading-snug">{block.heading}</span>
          <span className="mt-0.5 block text-xs tracking-wide text-muted-foreground uppercase">
            {block.sectionLabel}
            {block.page != null ? ` · p. ${block.page}` : ""}
          </span>
        </span>
        <span className="text-xs text-muted-foreground group-open:hidden">Show</span>
        <span className="hidden text-xs text-muted-foreground group-open:inline">Hide</span>
      </summary>
      <div className="max-w-3xl space-y-4 px-1 pb-6 text-[1.05rem] leading-7">
        <MathText text={block.explanation} />
        {level !== "simple" && block.analogy ? (
          <div className="rounded-lg bg-muted/70 px-3 py-2 text-sm leading-6 text-muted-foreground">
            <p className="mb-1 text-xs font-medium tracking-wide uppercase">
              Analogy · not a claim from the paper
            </p>
            <MathText text={block.analogy} />
          </div>
        ) : null}
        {level !== "simple" ? (
          <div>
            <p className="mb-1 text-xs font-medium tracking-wide text-primary uppercase">
              Why this matters
            </p>
            <MathText text={block.whyItMatters} className="text-base leading-7" />
          </div>
        ) : null}
        {level === "deep" ? (
          <div>
            <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              More detail
            </p>
            <MathText text={block.deepNotes} className="text-base leading-7" />
          </div>
        ) : null}
        {primaryChunk ? (
          <Button
            variant="outline"
            className="h-10"
            onClick={() => onSeeInPaper(primaryChunk)}
          >
            See in paper
            {block.page != null ? ` · p. ${block.page}` : ""}
          </Button>
        ) : null}
      </div>
    </details>
  );
}
