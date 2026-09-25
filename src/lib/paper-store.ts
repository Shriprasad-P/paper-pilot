"use client";

import { useSyncExternalStore } from "react";
import type {
  AskMessage,
  AskScope,
  ChartSpec,
  IngestItemInput,
  IngestJob,
  IngestStage,
  PaperRecord,
  PaperSummary,
  Provider,
} from "@/lib/api/types";
import { scopeKey } from "@/lib/api/ask";
import { attentionPaper } from "@/lib/mock/attention";
import { bertPaper, paywalledPaper } from "@/lib/mock/bert";

const STAGES: IngestStage[] = [
  "fetching",
  "parsing",
  "embedding",
  "extracting_equations",
  "building_charts",
  "ready",
];

export const STAGE_LABELS: Record<IngestStage | "failed", string> = {
  fetching: "Fetching",
  parsing: "Parsing",
  embedding: "Embedding",
  extracting_equations: "Extracting equations",
  building_charts: "Building charts",
  ready: "Ready",
  failed: "Failed",
};

const SEED: PaperRecord[] = [attentionPaper, bertPaper, paywalledPaper()];

type State = {
  extras: PaperRecord[];
  jobs: IngestJob[];
  overlay: Record<string, Partial<PaperSummary>>;
  threads: Record<string, AskMessage[]>;
  chartOverrides: Record<string, { charts: ChartSpec[]; chartError: string | null }>;
};

let state: State = {
  extras: [],
  jobs: [],
  overlay: {},
  threads: {},
  chartOverrides: {},
};

const listeners = new Set<() => void>();
const runTokens = new Map<string, number>();

function emit() {
  state = { ...state };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

function allRecords(): PaperRecord[] {
  return [...state.extras, ...SEED];
}

function present(record: PaperRecord): PaperRecord {
  const overlay = state.overlay[record.summary.id];
  const charts = state.chartOverrides[record.summary.id];
  let next = record;
  if (overlay) next = { ...next, summary: { ...next.summary, ...overlay } };
  if (charts) {
    next = {
      ...next,
      charts: charts.charts,
      chartError: charts.chartError,
      mainChartId: charts.charts[0]?.id ?? null,
      summary: { ...next.summary, chartCount: charts.charts.length },
    };
  }
  return next;
}

export function setPaperCharts(
  paperId: string,
  charts: ChartSpec[],
  chartError: string | null,
) {
  state = {
    ...state,
    chartOverrides: {
      ...state.chartOverrides,
      [paperId]: { charts, chartError },
    },
  };
  emit();
}

export function listPapers(): PaperSummary[] {
  return allRecords().map((record) => present(record).summary);
}

export function getPaper(id: string): PaperRecord | null {
  const record = allRecords().find((item) => item.summary.id === id);
  return record ? present(record) : null;
}

export function getJob(id: string): IngestJob | null {
  return state.jobs.find((job) => job.id === id) ?? null;
}

export function threadId(paperId: string, scope: AskScope): string {
  return `${paperId}:${scopeKey(scope)}`;
}

export function getThread(paperId: string, scope: AskScope): AskMessage[] {
  return state.threads[threadId(paperId, scope)] ?? [];
}

export function setThread(
  paperId: string,
  scope: AskScope,
  messages: AskMessage[],
) {
  state = {
    ...state,
    threads: { ...state.threads, [threadId(paperId, scope)]: messages },
  };
  emit();
}

function patchJob(id: string, patch: Partial<IngestJob>) {
  state = {
    ...state,
    jobs: state.jobs.map((job) => (job.id === id ? { ...job, ...patch } : job)),
  };
  emit();
}

function addPaper(paper: PaperRecord) {
  state = { ...state, extras: [paper, ...state.extras] };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function detectProvider(url: string): Provider {
  const value = url.toLowerCase();
  if (value.includes("arxiv.org")) return "arxiv";
  if (value.includes("ieee.org") || value.includes("ieeexplore")) return "ieee";
  if (value.includes("springer")) return "springer";
  return "other";
}

export function stageLabel(stage: IngestStage | "failed", provider: Provider): string {
  if (provider === "pdf" && stage === "fetching") return "Reading file";
  return STAGE_LABELS[stage];
}

function arxivId(url: string): string | null {
  const match = url.match(/(\d{4}\.\d{4,5})(?:v\d+)?/);
  return match?.[1] ?? null;
}

type Plan = {
  error: string | null;
  warnings: string[];
  existingPaperId: string | null;
  failAt: IngestStage;
  outcome: "ready" | "partial" | "failed" | "paywalled";
};

function planFor(input: IngestItemInput): Plan {
  if (input.kind === "pdf" || input.provider === "pdf") {
    return {
      error: null,
      warnings: [],
      existingPaperId: null,
      failAt: "fetching",
      outcome: "ready",
    };
  }
  if (input.provider === "ieee" || input.provider === "springer") {
    return {
      error: "Paywalled — upload PDF instead",
      warnings: [],
      existingPaperId: null,
      failAt: "fetching",
      outcome: "paywalled",
    };
  }
  const id = arxivId(input.url ?? "");
  if (input.provider === "arxiv" && id === "1706.03762") {
    return {
      error: null,
      warnings: [],
      existingPaperId: attentionPaper.summary.id,
      failAt: "fetching",
      outcome: "ready",
    };
  }
  if (input.provider === "arxiv" && id === "1810.04805") {
    return {
      error: null,
      warnings: [
        "Couldn't parse equations on page 4",
        "Couldn't build charts from the method section. The text walkthrough is still available.",
      ],
      existingPaperId: bertPaper.summary.id,
      failAt: "fetching",
      outcome: "partial",
    };
  }
  return {
    error:
      input.provider === "arxiv"
        ? "This demo only has full text for arXiv:1706.03762 and arXiv:1810.04805. Upload a PDF to open the sample workspace."
        : "Couldn’t retrieve full text from this host. Upload the PDF instead.",
    warnings: [],
    existingPaperId: null,
    failAt: "fetching",
    outcome: "failed",
  };
}

function emptyPaper(input: {
  title: string;
  provider: Provider;
  sourceLabel: string;
  sourceUrl: string | null;
  status: "failed" | "paywalled";
  statusDetail: string;
}): PaperRecord {
  return {
    summary: {
      id: `link-${crypto.randomUUID()}`,
      title: input.title,
      authors: [],
      year: null,
      venue:
        input.provider === "ieee"
          ? "IEEE Xplore"
          : input.provider === "springer"
            ? "Springer"
            : null,
      sourceLabel: input.sourceLabel,
      sourceUrl: input.sourceUrl,
      provider: input.provider,
      status: input.status,
      statusDetail: input.statusDetail,
      updatedAt: new Date().toISOString(),
      equationCount: 0,
      chartCount: 0,
      warnings: [input.statusDetail],
      badge: input.status === "paywalled" ? "No full text" : "Failed",
      statusHelp: input.statusDetail,
    },
    abstract: null,
    abstractEvidenceIds: [],
    demoNote:
      input.status === "paywalled"
        ? "Full text was not retrieved. Upload a PDF you can access. This demo will not invent the paper."
        : input.statusDetail,
    pageNote: null,
    cards: [],
    mainChartId: null,
    walkthrough: [],
    equations: [],
    equationWarnings: [],
    charts: [],
    chartError: null,
    chunks: [],
    ask: {
      what: input.statusDetail,
      why: input.statusDetail,
      connect: input.statusDetail,
      newcomer: input.statusDetail,
      evidenceIds: [],
    },
  };
}

export const SAMPLE_PAPER_NAME = "Attention Is All You Need";
export const SAMPLE_PAPER_CITATION = "Vaswani et al., 2017";
export const SAMPLE_ASK_NOTE = `Answering from sample paper ${SAMPLE_PAPER_NAME}, not your upload.`;

export function unparsedDetail(filename: string) {
  return `Not parsed. Demo sample of ${SAMPLE_PAPER_NAME} (${SAMPLE_PAPER_CITATION}), not ${filename}.`;
}

export function unparsedBanner(filename: string) {
  return `Not parsed. This reading is the bundled sample, ${SAMPLE_PAPER_NAME} (${SAMPLE_PAPER_CITATION}), not “${filename}”.`;
}

function cloneSampleUpload(filename: string): PaperRecord {
  const clone = structuredClone(attentionPaper);
  clone.summary = {
    ...clone.summary,
    id: `upload-${crypto.randomUUID()}`,
    title: filename,
    authors: [],
    year: null,
    venue: null,
    sourceLabel: filename,
    sourceUrl: null,
    provider: "pdf",
    status: "unparsed",
    statusDetail: unparsedDetail(filename),
    statusHelp: `This file was not parsed. The reading is the bundled sample, ${SAMPLE_PAPER_NAME} (${SAMPLE_PAPER_CITATION}).`,
    updatedAt: new Date().toISOString(),
    badge: "Not parsed",
  };
  clone.demoNote = unparsedBanner(filename);
  return clone;
}

function materialize(job: IngestJob, plan: Plan): string {
  if (job.paperId && getPaper(job.paperId)) return job.paperId;
  if (plan.existingPaperId) return plan.existingPaperId;
  if (job.input.kind === "pdf" || job.input.provider === "pdf") {
    const paper = cloneSampleUpload(job.input.name);
    addPaper(paper);
    return paper.summary.id;
  }
  const url = job.input.url ?? "";
  const paper = emptyPaper({
    title:
      plan.outcome === "paywalled"
        ? job.input.provider === "springer"
          ? "Springer link, full text unavailable"
          : "IEEE link, full text unavailable"
        : "Link could not be read",
    provider: job.input.provider,
    sourceLabel: url.replace(/^https?:\/\//, "") || job.input.name,
    sourceUrl: url || null,
    status: plan.outcome === "paywalled" ? "paywalled" : "failed",
    statusDetail: plan.error ?? "Couldn’t read this link.",
  });
  addPaper(paper);
  return paper.summary.id;
}

function warningsForStage(plan: Plan, stage: IngestStage): string[] {
  if (stage === "ready") return plan.warnings;
  return plan.warnings.filter((warning) => {
    if (stage === "extracting_equations") return /equation/i.test(warning);
    if (stage === "building_charts") return /chart/i.test(warning);
    return false;
  });
}

async function runJob(jobId: string, options?: { reprocessPaperId?: string }) {
  const token = (runTokens.get(jobId) ?? 0) + 1;
  runTokens.set(jobId, token);
  const alive = () => runTokens.get(jobId) === token;

  for (let index = 0; index < STAGES.length; index += 1) {
    if (!alive()) return;
    const stage = STAGES[index];
    const job = getJob(jobId);
    if (!job) return;
    const plan = options?.reprocessPaperId
      ? planFor({
          ...job.input,
          kind: "url",
          provider: job.input.provider === "pdf" ? "arxiv" : job.input.provider,
          url:
            job.input.provider === "pdf"
              ? "https://arxiv.org/abs/1706.03762"
              : job.input.url,
        })
      : planFor(job.input);

    patchJob(jobId, {
      stage,
      stageIndex: index,
      warnings: warningsForStage(plan, stage),
      error: null,
      done: false,
    });
    await sleep(stage === "ready" ? 240 : 700);
    if (!alive()) return;

    if (plan.error && stage === plan.failAt && !options?.reprocessPaperId) {
      const paperId = materialize(getJob(jobId)!, plan);
      patchJob(jobId, {
        stage: "failed",
        stageIndex: index,
        error: plan.error,
        warnings: [],
        paperId,
        done: true,
      });
      return;
    }
  }

  if (!alive()) return;
  const job = getJob(jobId);
  if (!job) return;

  if (options?.reprocessPaperId) {
    const paper = allRecords().find((item) => item.summary.id === options.reprocessPaperId);
    const status = paper?.summary.status ?? "ready";
    const detail =
      status === "partial" || status === "unparsed" || status === "paywalled" || status === "failed"
        ? paper?.summary.statusDetail ?? status
        : "Ready";
    state = {
      ...state,
      overlay: {
        ...state.overlay,
        [options.reprocessPaperId]: {
          status,
          statusDetail: detail,
          updatedAt: new Date().toISOString(),
        },
      },
    };
    patchJob(jobId, {
      stage: status === "paywalled" || status === "failed" ? "failed" : "ready",
      error: status === "paywalled" || status === "failed" ? detail : null,
      warnings: paper?.summary.warnings ?? [],
      paperId: options.reprocessPaperId,
      done: true,
      stageIndex: STAGES.length - 1,
    });
    return;
  }

  const plan = planFor(job.input);
  const paperId = materialize(job, plan);
  patchJob(jobId, {
    stage: "ready",
    error: null,
    warnings: plan.warnings,
    paperId,
    done: true,
    stageIndex: STAGES.length - 1,
  });
}

export function ingest(items: IngestItemInput[]): IngestJob[] {
  const jobs: IngestJob[] = items.map((input) => ({
    id: crypto.randomUUID(),
    input: {
      ...input,
      provider: input.kind === "pdf" ? "pdf" : input.provider,
    },
    stage: "fetching",
    stageIndex: 0,
    error: null,
    warnings: [],
    paperId: null,
    done: false,
  }));
  state = { ...state, jobs: [...jobs, ...state.jobs] };
  emit();
  jobs.forEach((job) => {
    void runJob(job.id);
  });
  return jobs;
}

export function retryJob(jobId: string) {
  const job = getJob(jobId);
  if (!job) return;
  patchJob(jobId, {
    stage: "fetching",
    stageIndex: 0,
    error: null,
    warnings: [],
    done: false,
  });
  void runJob(jobId);
}

export function reprocess(paperId: string): IngestJob | null {
  const paper = getPaper(paperId);
  if (!paper) return null;
  const previous = {
    status: paper.summary.status,
    statusDetail: paper.summary.statusDetail,
    warnings: paper.summary.warnings,
  };
  state = {
    ...state,
    overlay: {
      ...state.overlay,
      [paperId]: { status: "indexing", statusDetail: "Indexing" },
    },
  };
  const job: IngestJob = {
    id: crypto.randomUUID(),
    input: {
      kind: paper.summary.provider === "pdf" ? "pdf" : "url",
      name: paper.summary.sourceLabel,
      url: paper.summary.sourceUrl ?? undefined,
      provider: paper.summary.provider,
    },
    stage: "fetching",
    stageIndex: 0,
    error: null,
    warnings: [],
    paperId,
    done: false,
  };
  state = { ...state, jobs: [job, ...state.jobs] };
  emit();
  void (async () => {
    await runJob(job.id, { reprocessPaperId: paperId });
    state = {
      ...state,
      overlay: {
        ...state.overlay,
        [paperId]: {
          status: previous.status === "indexing" ? "ready" : previous.status,
          statusDetail: previous.statusDetail,
          warnings: previous.warnings,
          updatedAt: new Date().toISOString(),
        },
      },
    };
    emit();
  })();
  return job;
}

export function usePaperStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
