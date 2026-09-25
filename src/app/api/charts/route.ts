import { spawn } from "node:child_process";
import path from "node:path";
import { isChartModelId, DEFAULT_VLM_MODEL } from "@/lib/charts/models";
import { groundDiagram, noteForDiagram, type RawDiagram } from "@/lib/charts/spec";
import type { ChartSpec } from "@/lib/api/types";

export const runtime = "nodejs";

type Excerpt = { id: string; section?: string; page?: number | null; text: string };

function runSidecar(payload: unknown): Promise<{ code: number; stdout: string; stderr: string }> {
  const script = path.join(process.cwd(), "scripts", "chart_spec.py");
  return new Promise((resolve, reject) => {
    const child = spawn("python3", [script], { stdio: ["pipe", "pipe", "pipe"] });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Chart compiler timed out."));
    }, 180_000);
    child.stdout.on("data", (chunk) => out.push(chunk));
    child.stderr.on("data", (chunk) => err.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        code: code ?? 1,
        stdout: Buffer.concat(out).toString("utf8"),
        stderr: Buffer.concat(err).toString("utf8"),
      });
    });
    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

export async function POST(request: Request) {
  let body: {
    status?: string;
    model?: string;
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
        : DEFAULT_VLM_MODEL;
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

  let result: { code: number; stdout: string; stderr: string };
  try {
    result = await runSidecar({ model, excerpts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chart compiler failed.";
    return Response.json(
      { error: `Couldn't build charts from the method section. ${message}` },
      { status: 503 },
    );
  }

  let parsed: {
    ok?: boolean;
    error?: string;
    code?: string;
    model?: string;
    backend?: "mlx" | "ollama";
    elapsed_ms?: number;
    charts?: RawDiagram[];
  };
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    return Response.json(
      {
        error: "Couldn't build charts from the method section. The compiler did not return JSON.",
      },
      { status: 503 },
    );
  }

  if (!parsed.ok || !parsed.charts) {
    const unavailable = parsed.code === "runtime_unavailable";
    return Response.json(
      {
        error: unavailable
          ? "Couldn't build charts from the method section. Local MLX is not available on this machine, and the Ollama fallback did not respond."
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
    charts.push({
      ...diagram,
      id: `chart-${diagram.kind}-${index}`,
      modelId: parsed.model ?? model,
      backend: parsed.backend === "ollama" ? "ollama" : "mlx",
      elapsedMs: typeof parsed.elapsed_ms === "number" ? parsed.elapsed_ms : null,
      note: noteForDiagram(diagram),
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
    backend: parsed.backend ?? "mlx",
    elapsedMs: parsed.elapsed_ms ?? null,
  });
}
