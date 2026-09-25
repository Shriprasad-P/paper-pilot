"use client";

import type { ChartSpec } from "@/lib/api/types";
import { AskChartButton } from "@/components/ask-chart-button";
import { MermaidFigure } from "@/components/mermaid-figure";

const KIND_LABEL = {
  methodology_workflow: "Methodology",
  model_architecture: "Architecture",
  training_or_inference_loop: "Training",
  data_pipeline: "Data",
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
            {KIND_LABEL[chart.kind]}
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
        <ChartVisual chart={chart} />
        <span className="sr-only">Open {chart.title}</span>
      </button>
      <div className="space-y-2 px-4 pt-3 pb-4">
        <p className="text-sm leading-6 text-muted-foreground">{chart.caption}</p>
        <p className="text-xs font-medium text-foreground">
          AI reconstruction from the paper — not a publisher figure.
        </p>
        <ChartFooter chart={chart} />
      </div>
    </article>
  );
}

export function ChartVisual({ chart }: { chart: ChartSpec }) {
  if (chart.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={chart.imageUrl} alt="" className="mx-auto h-auto w-full" />
    );
  }
  return (
    <div>
      {chart.render === "mermaid" ? (
        <p className="mb-2 text-xs text-muted-foreground">Mermaid fallback. FLUX did not render this diagram.</p>
      ) : null}
      <MermaidFigure source={chart.mermaid} className="overflow-x-auto [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:w-full" />
    </div>
  );
}

export function ChartFooter({ chart }: { chart: ChartSpec }) {
  const elapsed = chart.elapsedMs != null ? ` · ${(chart.elapsedMs / 1000).toFixed(1)}s` : "";
  const source =
    chart.render === "bundled" || !chart.vlModelId
      ? "Bundled sample reconstruction · not a live model call"
      : chart.fluxModelId
        ? `${chart.vlModelId} · ${chart.fluxModelId}${elapsed}`
        : `${chart.vlModelId} · Mermaid fallback${elapsed}`;
  return (
    <div className="space-y-1">
      <p className="font-mono text-[11px] leading-5 text-muted-foreground">{source}</p>
      {chart.warnings.length > 0 ? (
        <p className="text-xs leading-5 text-muted-foreground">
          Lower confidence. {chart.warnings[0]}
        </p>
      ) : null}
    </div>
  );
}
