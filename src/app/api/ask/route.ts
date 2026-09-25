import { ASK_MODEL, EMBED_MODEL } from "@/lib/charts/models";
import { parseSidecar, runPython } from "@/lib/charts/sidecar";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: {
    paperId?: string;
    question?: string;
    chart?: {
      title?: string;
      caption?: string;
      extracted_text_nodes?: string[];
      evidence_ids?: string[];
    } | null;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected JSON." }, { status: 400 });
  }
  if (!body.paperId || !body.question?.trim()) {
    return Response.json({ error: "Missing paper or question." }, { status: 400 });
  }
  try {
    const result = await runPython(
      "rag_ask.py",
      {
        op: "ask",
        paper_id: body.paperId,
        question: body.question.trim().slice(0, 1000),
        chart: body.chart ?? null,
        embed_model: process.env.PAPER_LENS_EMBED_MODEL || EMBED_MODEL,
        ask_model: process.env.PAPER_LENS_ASK_MODEL || ASK_MODEL,
        top_k: 4,
      },
      180_000,
    );
    const parsed = parseSidecar<{
      ok?: boolean;
      error?: string;
      content?: string;
      evidence_ids?: string[];
      model?: string;
    }>(result.stdout);
    if (!parsed?.ok || !parsed.content) {
      return Response.json(
        {
          error: parsed?.error ?? "No retrieved excerpt for that question. Nothing was invented.",
          evidence_ids: [],
        },
        { status: 503 },
      );
    }
    return Response.json({
      content: parsed.content,
      evidenceIds: parsed.evidence_ids ?? [],
      model: parsed.model ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ask failed.";
    return Response.json({ error: message, evidence_ids: [] }, { status: 503 });
  }
}
