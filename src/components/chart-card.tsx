"use client";

import type { ChartSpec } from "@/lib/api/types";
import { AskChartButton } from "@/components/ask-chart-button";
import { MermaidFigure } from "@/components/mermaid-figure";

const KIND_LABEL = {
  workflow: "Workflow",
  architecture: "Architecture",
  training: "Training",
  evaluation: "Evaluation",
} as const;

export function ChartCard({
  chart,
  onAsk,
  onOpen,
  asking = false,
}: {
  chart: ChartSpec;
  onAsk: () => void;
  onOpen: () => void;
  asking?: boolean;
}) {
  return (
    <article className="relative flex flex-col rounded-xl bg-card ring-1 ring-foreground/10">
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {KIND_LABEL[chart.kind]} · AI-reconstructed diagram
          </p>
          <h3 className="mt-1 font-serif text-lg leading-snug">{chart.title}</h3>
        </div>
        <AskChartButton
          onClick={onAsk}
          pressed={asking}
          label={`Ask about ${chart.title}`}
        />
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="mx-3 mt-3 rounded-lg bg-muted/40 px-2 py-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <MermaidFigure source={chart.mermaid} className="overflow-x-auto [&_svg]:h-auto [&_svg]:max-w-full" />
        <span className="sr-only">Open {chart.title}</span>
      </button>
      <p className="px-4 pt-3 pb-4 text-sm leading-6 text-muted-foreground">{chart.caption}</p>
    </article>
  );
}
