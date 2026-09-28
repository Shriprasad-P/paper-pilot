import { FLUX_SCHNELL, isFluxModelId } from "@/lib/charts/models";
import { parseSidecar, runPython } from "@/lib/charts/sidecar";
import { groundDiagram, noteForDiagram, type RawDiagram } from "@/lib/charts/spec";
import type { ChartSpec } from "@/lib/api/types";
import { rejectCrossOriginPost } from "@/lib/api/same-origin";

export const runtime = "nodejs";

type Excerpt = { id: string; section?: string; page?: number | null; text: string };

type PipelineChart = RawDiagram & {
  image_url?: string | null;
  render?: string;
  vl_model?: string | null;
  flux_model?: string | null;
};

export async function POST(request: Request) {
  const rejected = rejectCrossOriginPost(request);
  if (rejected) return rejected;
  let body: {
    status?: string;
    ocr?: boolean;
    paperId?: string;
    fluxModel?: string;
    excerpts?: Excerpt[];
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected JSON." }, { status: 400 });
  }

  const ocrPartial = body.status === "partial" && body.ocr === true;
  if (body.status !== "ready" && !ocrPartial) {
    return Response.json(
      {
        error:
          "Charts are only built for a Ready paper. Partial, paywalled, and Not parsed papers keep their current state.",
      },
      { status: 409 },
    );
  }

  const envFlux = process.env.PAPER_LENS_FLUX_MODEL;
  const fluxModel =
    body.fluxModel && isFluxModelId(body.fluxModel)
      ? body.fluxModel
      : envFlux && isFluxModelId(envFlux)
        ? envFlux
        : FLUX_SCHNELL;
  const excerpts = (body.excerpts ?? [])
    .filter((item) => item && typeof item.id === "string" && typeof item.text === "string")
    .slice(0, 16)
    .map((item) => ({
      id: item.id,
      section: item.section ?? "",
      page: item.page ?? null,
      text: item.text.slice(0, 2000),
    }));

  if (excerpts.length === 0) {
    return Response.json(
      { error: "Couldn't build charts from the method section. No excerpts were retrieved." },
      { status: 422 },
    );
  }

  let result: { stdout: string };
  try {
    result = await runPython(
      "chart_pipeline.py",
      {
        status: "ready",
        paper_id: body.paperId ?? "paper",
        flux_model: fluxModel,
        excerpts,
      },
      360_000,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chart pipeline failed.";
    return Response.json(
      { error: `Couldn't build charts from the method section. ${message}` },
      { status: 503 },
    );
  }

  const parsed = parseSidecar<{
    ok?: boolean;
    error?: string;
    code?: string;
    model?: string;
    flux_model?: string;
    elapsed_ms?: number;
    charts?: PipelineChart[];
  }>(result.stdout);

  if (!parsed) {
    return Response.json(
      { error: "Couldn't build charts from the method section. The compiler did not return JSON." },
      { status: 503 },
    );
  }

  if (!parsed.ok || !parsed.charts) {
    const thin = parsed.code === "thin_text";
    return Response.json(
      {
        error: parsed.error ?? "Couldn't build charts from the method section.",
        model: parsed.model ?? null,
      },
      { status: thin ? 422 : 503 },
    );
  }

  const charts: ChartSpec[] = [];
  for (const [index, raw] of parsed.charts.entries()) {
    const grounded = groundDiagram(raw, excerpts);
    if ("error" in grounded) continue;
    const diagram = grounded.diagram;
    const labels = diagram.nodes.map((node) => node.label);
    const sameLabels =
      Array.isArray(raw.extracted_text_nodes) &&
      raw.extracted_text_nodes.length === labels.length &&
      raw.extracted_text_nodes.every((label, labelIndex) => label === labels[labelIndex]);
    const fluxImage = sameLabels && raw.render === "flux" && raw.image_url ? raw.image_url : null;
    const fluxId = fluxImage ? raw.flux_model ?? parsed.flux_model ?? fluxModel : null;
    charts.push({
      ...diagram,
      id: `chart-${diagram.kind}-${index}`,
      imageUrl: fluxImage,
      render: fluxImage ? "flux" : "mermaid",
      vlModelId: null,
      fluxModelId: fluxId,
      modelId: fluxId,
      backend: fluxImage ? "flux" : null,
      elapsedMs: typeof parsed.elapsed_ms === "number" ? parsed.elapsed_ms : null,
      note: noteForDiagram(diagram),
      warnings: fluxImage
        ? diagram.warnings
        : [
            ...diagram.warnings.filter((item) => !item.startsWith("FLUX ")),
            "FLUX unavailable. Showing the Mermaid diagram from the same method text.",
          ].slice(0, 8),
    });
  }

  if (charts.length === 0) {
    return Response.json(
      { error: "The method text is too thin for a chart. Nothing was invented." },
      { status: 422 },
    );
  }

  return Response.json({
    charts,
    model: charts.some((chart) => chart.render === "flux") ? fluxModel : null,
    fluxModel: charts.some((chart) => chart.render === "flux") ? fluxModel : null,
    elapsedMs: parsed.elapsed_ms ?? null,
  });
}
