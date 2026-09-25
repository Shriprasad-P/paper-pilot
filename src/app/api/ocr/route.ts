import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseSidecar, runPython } from "@/lib/charts/sidecar";

export const runtime = "nodejs";

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Expected a PDF upload." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Missing PDF." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "That PDF is larger than 25 MB." }, { status: 413 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!bytes.subarray(0, 5).toString("utf8").includes("%PDF")) {
    return Response.json({ error: "That file isn’t a PDF." }, { status: 415 });
  }

  const dir = await mkdtemp(path.join(os.tmpdir(), "paper-lens-ocr-"));
  const pdfPath = path.join(dir, "upload.pdf");
  try {
    await writeFile(pdfPath, bytes);
    const result = await runPython("apple_ocr.py", { pdf_path: pdfPath }, 180_000);
    const parsed = parseSidecar<{
      ok?: boolean;
      error?: string;
      code?: string;
      engine?: string;
      pages?: Array<{ page: number; text: string; blocks?: Array<{ text: string; bbox?: number[] }> }>;
    }>(result.stdout);
    if (!parsed?.ok || !parsed.pages?.length) {
      const status = parsed?.code === "not_mac" ? 503 : 422;
      return Response.json(
        {
          error: parsed?.error ?? "Apple OCR didn’t read that PDF.",
          code: parsed?.code ?? "ocr_failed",
          pages: [],
        },
        { status },
      );
    }
    return Response.json({
      engine: parsed.engine ?? "apple_vision",
      pages: parsed.pages.map((page) => ({
        page: page.page,
        text: page.text,
        blocks: page.blocks ?? [],
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Apple OCR failed.";
    return Response.json({ error: message, pages: [] }, { status: 503 });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
