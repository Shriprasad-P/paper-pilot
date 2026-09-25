import type { AskResult, AskScope, PaperRecord } from "@/lib/api/types";
import { readChartSettings } from "@/lib/charts/models";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function askWithLocalRag(args: {
  paper: PaperRecord;
  scope: AskScope;
  question: string;
  signal?: AbortSignal;
  onMeta?: (meta: { evidenceIds: string[] }) => void;
  onToken?: (token: string) => void;
}): Promise<AskResult> {
  if (args.paper.summary.status === "unparsed") {
    return {
      content:
        "This file was not parsed. Ask is not running a model on the upload. The sample notes stay available in mock mode.",
      evidenceIds: [],
      stopped: false,
    };
  }
  if (args.paper.chunks.length === 0) {
    return {
      content: "No retrieved excerpt for that question. Nothing was invented.",
      evidenceIds: [],
      stopped: false,
    };
  }

  let scoped: PaperRecord["charts"][number] | null = null;
  if (args.scope.kind === "chart") {
    const chartId = args.scope.chartId;
    scoped = args.paper.charts.find((item) => item.id === chartId) ?? null;
  }

  const index = await fetch("/api/index", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: args.signal,
    body: JSON.stringify({
      paperId: args.paper.summary.id,
      chunks: args.paper.chunks.map((chunk) => ({
        id: chunk.id,
        section: chunk.section,
        page: chunk.page,
        text: chunk.text,
      })),
    }),
  });
  if (!index.ok) {
    const data = (await index.json().catch(() => ({}))) as { error?: string };
    return {
      content: data.error ?? "The local embedding model did not index this paper.",
      evidenceIds: [],
      stopped: false,
    };
  }

  const response = await fetch("/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: args.signal,
    body: JSON.stringify({
      paperId: args.paper.summary.id,
      question: args.question,
      askModel: readChartSettings().askModel,
      chart: scoped
        ? {
            title: scoped.title,
            caption: scoped.caption,
            extracted_text_nodes: scoped.extractedTextNodes,
            evidence_ids: scoped.evidence_ids,
          }
        : null,
    }),
  });
  const data = (await response.json().catch(() => ({}))) as {
    content?: string;
    evidenceIds?: string[];
    error?: string;
  };
  if (!response.ok || !data.content) {
    return {
      content: data.error ?? "No retrieved excerpt for that question. Nothing was invented.",
      evidenceIds: [],
      stopped: Boolean(args.signal?.aborted),
    };
  }

  const evidenceIds = (data.evidenceIds ?? []).filter((id) =>
    args.paper.chunks.some((chunk) => chunk.id === id),
  );
  args.onMeta?.({ evidenceIds });
  let built = "";
  for (const token of data.content.split(/(\s+)/)) {
    if (args.signal?.aborted) {
      return { content: built.trim(), evidenceIds, stopped: true };
    }
    built += token;
    args.onToken?.(token);
    await sleep(12);
  }
  return { content: data.content, evidenceIds, stopped: false };
}
