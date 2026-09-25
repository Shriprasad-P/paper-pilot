"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { AskScope, DetailLevel } from "@/lib/api/types";
import { paperLensClient } from "@/lib/api/client";
import { getJob, getPaper, ingest, reprocess, setPaperCharts, stageLabel, usePaperStore } from "@/lib/paper-store";
import { readChartSettings } from "@/lib/charts/models";
import { methodExcerpts } from "@/lib/charts/spec";
import { CompactPdfDrop } from "@/components/ingest-dropzone";
import { AskChartButton } from "@/components/ask-chart-button";
import { AskDrawer } from "@/components/ask-drawer";
import { ChartCard, ChartFooter, ChartVisual } from "@/components/chart-card";
import { EquationTable } from "@/components/equation-table";
import { EvidenceQuote } from "@/components/evidence-quote";
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

const COACH_KEY = "paper-lens-ask-coach-dismissed";
const CHART_PREFILL = "Explain this chart in the context of the paper.";

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
  const [sectionContext, setSectionContext] = useState<string | null>(null);
  const [equationSection, setEquationSection] = useState("all");
  const [showCoach, setShowCoach] = useState(false);
  const [chartsReady, setChartsReady] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setChartsReady(false);
    const timer = window.setTimeout(() => setChartsReady(true), 700);
    return () => window.clearTimeout(timer);
  }, [paperId]);

  useEffect(() => {
    if (paper?.summary.status !== "ready") return;
    if (window.localStorage.getItem(COACH_KEY) === "1") return;
    setShowCoach(true);
  }, [paper?.summary.id, paper?.summary.status]);

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
      if (event.key === "Escape") {
        if (lightboxId) {
          setLightboxId(null);
          return;
        }
        if (askOpen) setAskOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [askOpen, lightboxId]);

  useEffect(() => {
    if (askOpen) inputRef.current?.focus();
  }, [askOpen, scope]);

  function openAsk(next: AskScope, prefill?: string) {
    setLightboxId(null);
    setScope(next);
    if (prefill !== undefined) setDraft(prefill);
    setAskOpen(true);
  }

  function dismissCoach() {
    window.localStorage.setItem(COACH_KEY, "1");
    setShowCoach(false);
  }

  function selectView(next: ViewId) {
    if (next === "equations") {
      setEquationSection(view === "walkthrough" && sectionContext ? sectionContext : "all");
    }
    setView(next);
  }

  function showInSources(chunkId: string) {
    if (!paper?.chunks.some((chunk) => chunk.id === chunkId)) {
      toast("That excerpt isn’t in Sources.");
      return;
    }
    setFocusChunk(chunkId);
    setView("sources");
    setAskOpen(false);
    window.setTimeout(() => {
      document.getElementById(`chunk-${chunkId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
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
      {showCoach && paper.summary.status === "ready" ? (
        <p className="flex flex-wrap items-center justify-between gap-2 border-b bg-foreground px-4 py-2 text-sm text-background md:px-6">
          <span>Click Ask Chart on any equation.</span>
          <button type="button" className="underline" onClick={dismissCoach}>
            Dismiss
          </button>
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
              onClick={() => selectView(id)}
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
                onClick={() => selectView(id)}
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
                  selectView("charts");
                }}
                onAsk={(question) => {
                  openAsk({ kind: "paper" }, question);
                  setAutoSendKey((value) => value + 1);
                }}
              />
            ) : view === "walkthrough" ? (
              <div className="mx-auto max-w-3xl">
                {paper.summary.status === "unparsed" && paper.demoNote ? (
                  <SampleBanner text={paper.demoNote} />
                ) : null}
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
                    onFocusSection={setSectionContext}
                  />
                ))}
              </div>
            ) : view === "charts" ? (
              <ChartsView
                ready={chartsReady}
                error={paper.chartError}
                charts={paper.charts}
                activeChartId={askOpen ? activeChartId : null}
                rebuilding={rebuilding}
                onRegenerate={() => {
                  if (!paper) return;
                  if (paper.summary.status !== "ready") {
                    toast(
                      paper.summary.status === "unparsed"
                        ? "This file was not parsed. Charts stay the bundled sample."
                        : "Couldn't build charts from the method section. The text walkthrough is still available.",
                    );
                    return;
                  }
                  const settings = readChartSettings();
                  if (settings.mockMode) {
                    toast("Mock mode is on. Models are not called, so these stay the bundled reconstruction.");
                    return;
                  }
                  setRebuilding(true);
                  setChartsReady(false);
                  void (async () => {
                    try {
                      const response = await fetch("/api/charts", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          status: paper.summary.status,
                          paperId: paper.summary.id,
                          model: settings.chartModel,
                          fluxModel: settings.fluxModel,
                          excerpts: methodExcerpts(paper.chunks),
                        }),
                      });
                      const data = (await response.json()) as {
                        charts?: typeof paper.charts;
                        error?: string;
                        model?: string;
                      };
                      if (!response.ok || !data.charts) {
                        toast(data.error ?? "Couldn't build charts from the method section.");
                        return;
                      }
                      setPaperCharts(paper.summary.id, data.charts, null);
                      toast(data.model ? `Charts rebuilt with ${data.model}.` : "Charts rebuilt.");
                    } catch {
                      toast("Couldn't build charts from the method section.");
                    } finally {
                      setChartsReady(true);
                      setRebuilding(false);
                    }
                  })();
                }}
                onAsk={(chartId) => openAsk({ kind: "chart", chartId }, CHART_PREFILL)}
                onOpen={(chartId) => {
                  setAskOpen(false);
                  setLightboxId(chartId);
                }}
              />
            ) : view === "equations" ? (
              <div className="mx-auto max-w-6xl">
                {paper.summary.status === "unparsed" && paper.demoNote ? (
                  <SampleBanner text={paper.demoNote} />
                ) : null}
                <h2 className="font-serif text-2xl">Equations</h2>
                <p className="mt-1 mb-5 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Each description is tied to a retrieved excerpt. Ask Chart opens a thread for that row only.
                </p>
                <EquationTable
                  equations={paperLensClient.getEquations(paper.summary.id).equations}
                  warnings={paperLensClient.getEquations(paper.summary.id).warnings}
                  activeEquationId={askOpen ? activeEquationId : null}
                  initialSection={equationSection}
                  showCoach={showCoach && paper.summary.status === "ready"}
                  onDismissCoach={dismissCoach}
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
          onShowInSources={showInSources}
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
              <p className="text-xs font-medium text-foreground">
                AI reconstruction from the paper — not a publisher figure.
              </p>
              <ChartVisual chart={lightbox} />
              <ChartFooter chart={lightbox} />
              <div className="flex items-center gap-3">
                <AskChartButton
                  label={`Ask about ${lightbox.title}`}
                  onClick={() => openAsk({ kind: "chart", chartId: lightbox.id }, CHART_PREFILL)}
                />
                <p className="text-sm text-muted-foreground">Ask Chart about this diagram</p>
              </div>
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
      {paper.summary.status === "unparsed" && paper.demoNote ? (
        <SampleBanner text={paper.demoNote} />
      ) : null}
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
            <ChartVisual chart={mainChart} />
            <p className="mt-2 text-sm text-muted-foreground">{mainChart.caption}</p>
            <p className="mt-2 text-xs font-medium text-foreground">
              AI reconstruction from the paper — not a publisher figure.
            </p>
            <div className="mt-1">
              <ChartFooter chart={mainChart} />
            </div>
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
  rebuilding,
  onRegenerate,
  onAsk,
  onOpen,
}: {
  ready: boolean;
  error: string | null;
  charts: NonNullable<ReturnType<typeof getPaper>>["charts"];
  activeChartId: string | null;
  rebuilding: boolean;
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
            Compiled from retrieved method text. With mock mode off, Regenerate runs the vision model, then FLUX, one at a time.
          </p>
        </div>
        <Button variant="outline" className="h-10" onClick={onRegenerate} disabled={rebuilding}>
          <RefreshCw className="size-4" />
          {rebuilding ? "Building…" : "Regenerate"}
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
        <div className="grid gap-4">
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

function SampleBanner({ text }: { text: string }) {
  return (
    <p className="sticky top-0 z-20 -mx-4 mb-6 border-y border-amber-950 bg-amber-950 px-4 py-3 text-sm leading-6 font-medium text-amber-50 md:-mx-8 md:px-8">
      {text}
    </p>
  );
}

function BlockedState({
  paperTitle,
  detail,
  status,
}: {
  paperTitle: string;
  detail: string;
  status: "paywalled" | "failed" | "indexing" | "ready" | "partial" | "unparsed";
}) {
  const router = useRouter();
  usePaperStore();
  const [jobId, setJobId] = useState<string | null>(null);
  const job = jobId ? getJob(jobId) : null;

  useEffect(() => {
    if (job?.done && job.paperId && !job.error) {
      router.push(`/papers/${job.paperId}`);
    }
  }, [job, router]);

  return (
    <div className="mx-auto max-w-lg py-12 text-center">
      <StatusPill status={status} detail={detail} />
      <h2 className="mt-4 font-serif text-3xl">{paperTitle}</h2>
      <p className="mt-3 text-sm leading-6 text-foreground">{detail}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        No walkthrough, equations, or charts are shown, because no text was retrieved.
      </p>
      <div className="mt-6 text-left">
        <CompactPdfDrop
          busy={Boolean(job && !job.done)}
          onFile={(file) => {
            const [created] = ingest([{ kind: "pdf", name: file.name, provider: "pdf" }]);
            setJobId(created.id);
          }}
        />
        {job && !job.done ? (
          <p className="mt-3 text-center text-sm text-muted-foreground">
            {stageLabel(job.stage === "failed" ? "fetching" : job.stage, "pdf")}
          </p>
        ) : null}
      </div>
      <Button className="mt-4 h-11" variant="outline" nativeButton={false} render={<Link href="/ingest" />}>
        Or add it from the ingest screen
      </Button>
    </div>
  );
}
