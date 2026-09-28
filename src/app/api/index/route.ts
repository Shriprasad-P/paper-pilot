import { parseSidecar, runPython } from "@/lib/charts/sidecar";
import { EMBED_MODEL } from "@/lib/charts/models";
import { rejectCrossOriginPost } from "@/lib/api/same-origin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rejected = rejectCrossOriginPost(request);
  if (rejected) return rejected;
  let body: {
    paperId?: string;
    chunks?: Array<{ id?: string; section?: string; page?: number | null; text?: string }>;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected JSON." }, { status: 400 });
  }
  const chunks = (body.chunks ?? [])
    .filter((chunk) => chunk.id && chunk.text)
    .slice(0, 40)
    .map((chunk) => ({
      id: chunk.id,
      section: chunk.section ?? "",
      page: chunk.page ?? null,
      text: (chunk.text ?? "").slice(0, 2000),
    }));
  if (!body.paperId || chunks.length === 0) {
    return Response.json({ error: "No excerpts to index." }, { status: 422 });
  }
  try {
    const result = await runPython(
      "rag_ask.py",
      { op: "index", paper_id: body.paperId, chunks, embed_model: process.env.PAPER_LENS_EMBED_MODEL || EMBED_MODEL },
      180_000,
    );
    const parsed = parseSidecar<{ ok?: boolean; error?: string; count?: number; cached?: boolean }>(result.stdout);
    if (!parsed?.ok) {
      return Response.json(
        { error: parsed?.error ?? "The local embedding model did not index this paper." },
        { status: 503 },
      );
    }
    return Response.json(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Index failed.";
    return Response.json({ error: message }, { status: 503 });
  }
}
