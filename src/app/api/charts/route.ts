import {
  FLUX_SCHNELL,
  VLM_4B_MODEL,
  VLM_8B_MODEL,
  isChartModelId,
  isFluxModelId,
} from "@/lib/charts/models";
import { parseSidecar, runPython } from "@/lib/charts/sidecar";
import { groundDiagram, noteForDiagram, type RawDiagram } from "@/lib/charts/spec";
import type { ChartSpec } from "@/lib/api/types";

export const runtime = "nodejs";

type Excerpt = { id: string; section?: string; page?: number | null; text: string };

type PipelineChart = RawDiagram & {
  image_url?: string | null;
  render?: string;
  vl_model?: string | null;
  flux_model?: string | null;
};

export async function POST(request: Request) {
  let body: {
    status?: string;
    paperId?: string;
    model?: string;
    fluxModel?: string;
    excerpts?: Excerpt[];
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected JSON." }, { status: 400 });
  }

  if (body.status !== "ready") {
    return Response.json(
      {
        error:
          "Charts are only built for a Ready paper. Partial, paywalled, and Not parsed papers keep their current state.",
      },
      { status: 409 },
    );
  }

  const envModel = process.env.PAPER_LENS_VLM_MODEL;
  const model =
    body.model && isChartModelId(body.model)
      ? body.model
      : envModel && isChartModelId(envModel)
        ? envModel
        : VLM_8B_MODEL;
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
        model,
        fallback: process.env.PAPER_LENS_VLM_FALLBACK || VLM_4B_MODEL,
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
    const unavailable = parsed.code === "runtime_unavailable";
    return Response.json(
      {
        error: unavailable
          ? "Couldn't build charts from the method section. Local MLX is not available on this machine."
          : parsed.error ?? "Couldn't build charts from the method section.",
        model: parsed.model ?? model,
      },
      { status: 503 },
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
    charts.push({
      ...diagram,
      id: `chart-${diagram.kind}-${index}`,
      imageUrl: fluxImage,
      render: fluxImage ? "flux" : "mermaid",
      vlModelId: raw.vl_model ?? parsed.model ?? model,
      fluxModelId: fluxImage ? raw.flux_model ?? parsed.flux_model ?? fluxModel : null,
      modelId: raw.vl_model ?? parsed.model ?? model,
      backend: fluxImage ? "flux" : "mlx",
      elapsedMs: typeof parsed.elapsed_ms === "number" ? parsed.elapsed_ms : null,
      note: noteForDiagram(diagram),
      warnings: fluxImage
        ? diagram.warnings
        : [...diagram.warnings, "FLUX did not render. Showing the Mermaid diagram from the same nodes."].slice(0, 8),
    });
  }

  if (charts.length === 0) {
    return Response.json(
      { error: "Couldn't build charts from the method section. The diagram was not grounded." },
      { status: 422 },
    );
  }

  return Response.json({
    charts,
    model: parsed.model ?? model,
    fluxModel: parsed.flux_model ?? fluxModel,
    elapsedMs: parsed.elapsed_ms ?? null,
  });
}
