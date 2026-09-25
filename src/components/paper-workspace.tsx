"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RefreshCw, Upload } from "lucide-react";
import { toast } from "sonner";
import type { AskScope, DetailLevel } from "@/lib/api/types";
import { paperLensClient } from "@/lib/api/client";
import { getPaper, reprocess, usePaperStore } from "@/lib/paper-store";
import { AskChartButton } from "@/components/ask-chart-button";
import { AskDrawer } from "@/components/ask-drawer";
import { ChartCard } from "@/components/chart-card";
import { EquationTable } from "@/components/equation-table";
import { EvidenceQuote } from "@/components/evidence-quote";
import { MermaidFigure } from "@/components/mermaid-figure";
import { PaperHeader } from "@/components/paper-header";
import { StatusPill } from "@/components/status-pill";
import { WalkthroughSection } from "@/components/walkthrough-section";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const VIEWS = [
  ["overview", "Overview"],
  ["walkthrough", "Walkthrough"],
  ["charts", "Charts"],
  ["equations", "Equations"],
  ["sources", "Sources"],
] as const;

type ViewId = (typeof VIEWS)[number][0];

export function PaperWorkspace({ paperId }: { paperId: string }) {
  usePaperStore();
  const paper = getPaper(paperId);
  const [view, setView] = useState<ViewId>("overview");
  const [level, setLevel] = useState<DetailLevel>("standard");
  const [askOpen, setAskOpen] = useState(false);
  const [scope, setScope] = useState<AskScope>({ kind: "paper" });
  const [draft, setDraft] = useState("");
  const [focusChunk, setFocusChunk] = useState<string | null>(null);
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const [autoSendKey, setAutoSendKey] = useState(0);
  const [chartsReady, setChartsReady] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setChartsReady(false);
    const timer = window.setTimeout(() => setChartsReady(true), 700);
    return () => window.clearTimeout(timer);
  }, [paperId]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;
      if (event.key === "/" && !typing) {
        event.preventDefault();
        openAsk({ kind: "paper" });
      }
      if (event.key === "Escape" && askOpen) {
        setAskOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [askOpen]);

  useEffect(() => {
    if (askOpen) inputRef.current?.focus();
  }, [askOpen, scope]);

  function openAsk(next: AskScope, prefill?: string) {
    setScope(next);
    if (prefill !== undefined) setDraft(prefill);
    setAskOpen(true);
  }

  if (!paper) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <h1 className="font-serif text-3xl">That paper isn’t in the library</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It may have been from another session. Add it again from the ingest screen.
        </p>
        <Button className="mt-6 h-11" nativeButton={false} render={<Link href="/ingest" />}>
          Add a paper
        </Button>
      </div>
    );
  }

  const blocked = paper.summary.status === "paywalled" || paper.summary.status === "failed";
  const mainChart = paper.charts.find((chart) => chart.id === paper.mainChartId) ?? paper.charts[0];
  const lightbox = paper.charts.find((chart) => chart.id === lightboxId) ?? null;
  const activeEquationId = scope.kind === "equation" ? scope.equationId : null;
  const activeChartId = scope.kind === "chart" ? scope.chartId : null;

  function seeInPaper(chunkId: string) {
    setFocusChunk(chunkId);
    setView("sources");
    window.setTimeout(() => {
      document.getElementById(`chunk-${chunkId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PaperHeader
        paper={paper}
        onReprocess={() => {
          reprocess(paper.summary.id);
          toast("Reprocessing. The status pill stays on Indexing until the pass finishes.");
        }}
      />
      {paper.demoNote ? (
        <p className="border-b bg-amber-700/10 px-4 py-2 text-sm leading-6 text-amber-950 md:px-6">
          {paper.demoNote}
        </p>
      ) : null}
      {paper.summary.status === "partial" ? (
        <p className="border-b bg-amber-700/10 px-4 py-2 text-sm leading-6 text-amber-950 md:px-6">
          Partial success. The text is ready.
          {paper.summary.warnings.length > 0 ? ` ${paper.summary.warnings.join(" ")}` : ""}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <nav className="hidden w-52 shrink-0 flex-col gap-1 border-r px-3 py-4 md:flex" aria-label="Paper sections">
          {VIEWS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={cn(
                "rounded-lg px-3 py-2 text-left text-sm",
                view === id ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted",
              )}
              aria-current={view === id ? "page" : undefined}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex gap-2 overflow-x-auto border-b px-3 py-2 md:hidden" aria-label="Paper sections">
            {VIEWS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-sm",
                  view === id ? "bg-primary text-primary-foreground" : "bg-muted",
                )}
                aria-current={view === id ? "page" : undefined}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8">
            {blocked ? (
              <BlockedState paperTitle={paper.summary.title} detail={paper.summary.statusDetail} status={paper.summary.status} />
            ) : view === "overview" ? (
              <Overview
                paper={paper}
                mainChart={mainChart}
                levelNote={paper.pageNote}
                onOpenChart={() => {
                  setView("charts");
                }}
                onAsk={(question) => {
                  openAsk({ kind: "paper" }, question);
                  setAutoSendKey((value) => value + 1);
                }}
              />
            ) : view === "walkthrough" ? (
              <div className="mx-auto max-w-3xl">
                <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-medium tracking-wide text-primary uppercase">
                      AI-generated explanation
                    </p>
                    <h2 className="mt-1 font-serif text-2xl">Readable walkthrough</h2>
                  </div>
                  <fieldset className="flex rounded-full bg-muted p-1">
                    <legend className="sr-only">Detail level</legend>
                    {(
                      [
                        ["simple", "Simple"],
                        ["standard", "Standard"],
                        ["deep", "Deep"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={level === id}
                        onClick={() => setLevel(id)}
                        className={cn(
                          "h-9 rounded-full px-3 text-sm",
                          level === id ? "bg-card shadow-sm" : "text-muted-foreground",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </fieldset>
                </div>
                {paper.walkthrough.map((block, index) => (
                  <WalkthroughSection
                    key={block.id}
                    block={block}
                    level={level}
                    defaultOpen={index === 0}
                    onSeeInPaper={seeInPaper}
                  />
                ))}
              </div>
            ) : view === "charts" ? (
              <ChartsView
                ready={chartsReady}
                error={paper.chartError}
                charts={paper.charts}
                activeChartId={askOpen ? activeChartId : null}
                onRegenerate={() => {
                  setChartsReady(false);
                  window.setTimeout(() => setChartsReady(true), 900);
                }}
                onAsk={(chartId) => openAsk({ kind: "chart", chartId })}
                onOpen={(chartId) => {
                  setLightboxId(chartId);
                  openAsk(
                    { kind: "chart", chartId },
                    "Explain this chart in the context of the paper.",
                  );
                }}
              />
            ) : view === "equations" ? (
              <div className="mx-auto max-w-6xl">
                <h2 className="font-serif text-2xl">Equations</h2>
                <p className="mt-1 mb-5 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Each description is tied to a retrieved excerpt. Ask Chart opens a thread for that row only.
                </p>
                <EquationTable
                  equations={paperLensClient.getEquations(paper.summary.id).equations}
                  warnings={paperLensClient.getEquations(paper.summary.id).warnings}
                  activeEquationId={askOpen ? activeEquationId : null}
                  onAsk={(equation) => openAsk({ kind: "equation", equationId: equation.id })}
                  onRetry={() => {
                    reprocess(paper.summary.id);
                    toast("Extract ran again. Page 4 still has no recovered equation.");
                  }}
                />
              </div>
            ) : (
              <div className="mx-auto max-w-3xl">
                <h2 className="font-serif text-2xl">Sources</h2>
                <p className="mt-1 mb-4 text-sm leading-6 text-muted-foreground">
                  Retrieved excerpts used for explanations. Collapsed on purpose — this is for checking the model, not for reading the paper straight through.
                </p>
                {paper.pageNote ? (
                  <p className="mb-4 text-xs text-muted-foreground">{paper.pageNote}</p>
                ) : null}
                <div className="divide-y rounded-xl bg-card ring-1 ring-foreground/10">
                  {paper.chunks.map((chunk) => (
                    <details
                      key={focusChunk === chunk.id ? `${chunk.id}-focus` : chunk.id}
                      open={focusChunk === chunk.id ? true : undefined}
                      className="px-4 py-3"
                    >
                      <summary className="cursor-pointer text-sm font-medium">
                        {chunk.section}
                        {chunk.page != null ? ` · p. ${chunk.page}` : ""}
                      </summary>
                      <div className="pt-3">
                        <EvidenceQuote chunk={chunk} highlighted={focusChunk === chunk.id} />
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <AskDrawer
          paper={paper}
          scope={scope}
          open={askOpen}
          draft={draft}
          onDraft={setDraft}
          onClose={() => setAskOpen(false)}
          inputRef={inputRef}
          autoSendKey={autoSendKey}
        />
      </div>

      {askOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-foreground/20 md:hidden"
          aria-label="Close ask panel"
          onClick={() => setAskOpen(false)}
        />
      ) : (
        <div className="fixed right-4 bottom-4 z-30 md:right-8 md:bottom-8">
          <AskChartButton
            label="Ask about this paper"
            onClick={() => openAsk({ kind: "paper" })}
          />
        </div>
      )}

      <Dialog open={lightbox !== null} onOpenChange={(open) => !open && setLightboxId(null)}>
        <DialogContent className="sm:max-w-3xl" showCloseButton>
          {lightbox ? (
            <>
              <DialogHeader>
                <DialogTitle className="font-serif text-xl">{lightbox.title}</DialogTitle>
                <DialogDescription>{lightbox.caption}</DialogDescription>
              </DialogHeader>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                AI-reconstructed diagram
              </p>
              <MermaidFigure source={lightbox.mermaid} className="overflow-x-auto" />
              <Button
                className="h-11 w-fit"
                onClick={() =>
                  openAsk(
                    { kind: "chart", chartId: lightbox.id },
                    "Explain this chart in the context of the paper.",
                  )
                }
              >
                Ask about this chart
              </Button>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Overview({
  paper,
  mainChart,
  levelNote,
  onOpenChart,
  onAsk,
}: {
  paper: NonNullable<ReturnType<typeof getPaper>>;
  mainChart: (typeof paper.charts)[number] | undefined;
  levelNote: string | null;
  onOpenChart: () => void;
  onAsk: (question: string) => void;
}) {
  const [question, setQuestion] = useState("");
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          if (!question.trim()) return;
          onAsk(question.trim());
          setQuestion("");
        }}
      >
        <label className="sr-only" htmlFor="ask-paper">
          Ask about this paper
        </label>
        <input
          id="ask-paper"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about this paper  (/)"
          className="h-11 flex-1 rounded-lg border bg-card px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <Button type="submit" className="h-11" disabled={!question.trim()}>
          Ask paper
        </Button>
      </form>

      {paper.abstract ? (
        <section>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Abstract</p>
          <p className="mt-2 max-w-3xl font-serif text-lg leading-8">{paper.abstract}</p>
          {levelNote ? <p className="mt-2 text-xs text-muted-foreground">{levelNote}</p> : null}
        </section>
      ) : null}

      <section className="grid gap-3 md:grid-cols-3">
        {paper.cards.map((card) => (
          <article key={card.id} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <p className="text-xs font-medium tracking-wide text-primary uppercase">{card.title}</p>
            <p className="mt-2 text-sm leading-6">{card.body}</p>
            <p className="mt-3 text-xs text-muted-foreground">AI-generated explanation</p>
          </article>
        ))}
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-serif text-xl">Main workflow</h2>
          <button type="button" className="text-sm text-primary underline-offset-2 hover:underline" onClick={onOpenChart}>
            Open charts
          </button>
        </div>
        {mainChart ? (
          <button
            type="button"
            onClick={onOpenChart}
            className="w-full rounded-xl bg-card p-4 text-left ring-1 ring-foreground/10"
          >
            <MermaidFigure source={mainChart.mermaid} className="overflow-x-auto" />
            <p className="mt-2 text-sm text-muted-foreground">{mainChart.caption}</p>
            <p className="mt-1 text-xs text-muted-foreground">AI-reconstructed diagram</p>
          </button>
        ) : (
          <div className="rounded-xl border border-dashed px-4 py-8 text-sm text-muted-foreground">
            {paper.chartError ?? "No chart was generated for this paper."}
          </div>
        )}
      </section>
    </div>
  );
}

function ChartsView({
  ready,
  error,
  charts,
  activeChartId,
  onRegenerate,
  onAsk,
  onOpen,
}: {
  ready: boolean;
  error: string | null;
  charts: NonNullable<ReturnType<typeof getPaper>>["charts"];
  activeChartId: string | null;
  onRegenerate: () => void;
  onAsk: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl">Charts and figures</h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
            These are AI reconstructions from the method section, not the publisher’s figures.
          </p>
        </div>
        <Button variant="outline" className="h-10" onClick={onRegenerate}>
          <RefreshCw className="size-4" />
          Regenerate
        </Button>
      </div>
      {!ready ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : charts.length === 0 ? (
        <div className="rounded-xl border border-dashed px-6 py-12 text-center">
          <p className="font-serif text-xl">No charts yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {error ?? "Nothing in the retrieved text supported a diagram."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {charts.map((chart) => (
            <ChartCard
              key={chart.id}
              chart={chart}
              asking={activeChartId === chart.id}
              onAsk={() => onAsk(chart.id)}
              onOpen={() => onOpen(chart.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BlockedState({
  paperTitle,
  detail,
  status,
}: {
  paperTitle: string;
  detail: string;
  status: "paywalled" | "failed" | "indexing" | "ready" | "partial";
}) {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <StatusPill status={status} detail={detail} />
      <h2 className="mt-4 font-serif text-3xl">{paperTitle}</h2>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{detail}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        No walkthrough, equations, or charts are shown, because no text was retrieved.
      </p>
      <Button className="mt-6 h-11" nativeButton={false} render={<Link href="/ingest" />}>
        <Upload className="size-4" />
        Upload PDF instead
      </Button>
    </div>
  );
}
