"use client";

import { toast } from "sonner";
import { readChartSettings } from "@/lib/charts/models";
import { finishOcrUpload, ingest } from "@/lib/paper-store";
import type { OcrPage } from "@/lib/ocr/paper";

export async function uploadPdfs(files: File[]): Promise<string | null> {
  const settings = readChartSettings();
  if (settings.mockMode || !settings.appleOcr) {
    const [job] = ingest(files.map((file) => ({ kind: "pdf" as const, name: file.name, provider: "pdf" as const })));
    return job?.id ?? null;
  }
  let lastJobId: string | null = null;
  for (const file of files) {
    const body = new FormData();
    body.set("file", file);
    try {
      const response = await fetch("/api/ocr", { method: "POST", body });
      const data = (await response.json()) as { pages?: OcrPage[]; error?: string };
      const pages = (data.pages ?? []).filter((page) => page.text?.trim());
      if (!response.ok || pages.length === 0) {
        const [job] = ingest([{ kind: "pdf", name: file.name, provider: "pdf" }]);
        lastJobId = job?.id ?? lastJobId;
        toast(data.error ?? "Apple OCR didn’t read this file. It stays Not parsed.");
        continue;
      }
      const created = finishOcrUpload(file.name, pages);
      if (!created) {
        const [job] = ingest([{ kind: "pdf", name: file.name, provider: "pdf" }]);
        lastJobId = job?.id ?? lastJobId;
        toast("Apple OCR didn’t find readable text. The file stays Not parsed.");
        continue;
      }
      lastJobId = created.jobId;
    } catch {
      const [job] = ingest([{ kind: "pdf", name: file.name, provider: "pdf" }]);
      lastJobId = job?.id ?? lastJobId;
      toast("Apple OCR didn’t read this file. It stays Not parsed.");
    }
  }
  return lastJobId;
}
