import type { EvidenceChunk, PaperRecord, WalkthroughBlock } from "@/lib/api/types";

export const OCR_BANNER = "Text via Apple OCR. Layout and equations may be incomplete.";
export const OCR_SOURCE = "Text from Apple OCR";

export type OcrPage = { page: number; text: string };

function chunksFromPages(pages: OcrPage[]): EvidenceChunk[] {
  const chunks: EvidenceChunk[] = [];
  pages.forEach((page) => {
    const text = page.text.replace(/\s+\n/g, "\n").trim();
    if (!text) return;
    const parts = text.split(/\n{2,}/).flatMap((paragraph) => {
      const trimmed = paragraph.trim();
      if (trimmed.length <= 1200) return trimmed ? [trimmed] : [];
      const slices: string[] = [];
      for (let index = 0; index < trimmed.length; index += 1000) {
        slices.push(trimmed.slice(index, index + 1000).trim());
      }
      return slices.filter(Boolean);
    });
    parts.forEach((part, index) => {
      chunks.push({
        id: `ocr-p${page.page}-${index + 1}`,
        section: `${OCR_SOURCE} · p. ${page.page}`,
        page: page.page,
        text: part,
      });
    });
  });
  return chunks;
}

export function paperFromOcr(filename: string, pages: OcrPage[]): PaperRecord | null {
  const chunks = chunksFromPages(pages);
  if (chunks.length === 0) return null;
  const first = chunks[0];
  const preview = first.text.slice(0, 500);
  const walkthrough: WalkthroughBlock[] = [
    {
      id: "ocr-text",
      heading: OCR_SOURCE,
      sectionLabel: "Apple OCR",
      page: first.page,
      explanation: preview.length < first.text.length ? `${preview}…` : preview,
      whyItMatters:
        "This is the text Apple OCR read from the file. It is not publisher XML, and equations were not recovered.",
      deepNotes: "The full pages are in Sources. A diagram is built only if that text names a method.",
      analogy: null,
      evidenceIds: chunks.slice(0, 4).map((chunk) => chunk.id),
    },
  ];
  const detail = "Text via Apple OCR · equations not recovered · charts not built";
  return {
    summary: {
      id: `ocr-${crypto.randomUUID()}`,
      title: filename,
      authors: [],
      year: null,
      venue: null,
      sourceLabel: filename,
      sourceUrl: null,
      provider: "pdf",
      status: "partial",
      statusDetail: detail,
      updatedAt: new Date().toISOString(),
      equationCount: 0,
      chartCount: 0,
      warnings: [OCR_BANNER],
      badge: "Apple OCR",
      statusHelp:
        "Sources are text from Apple OCR. Equations were not recovered. Charts were not built.",
    },
    abstract: null,
    abstractEvidenceIds: [],
    demoNote: OCR_BANNER,
    pageNote: "Text from Apple OCR. These excerpts are not publisher XML.",
    cards: [],
    mainChartId: null,
    walkthrough,
    equations: [],
    equationWarnings: ["Equations were not recovered from Apple OCR."],
    charts: [],
    chartError: "No diagram yet. Charts run only when this OCR text names a method.",
    chunks,
    ask: {
      what: preview,
      why: "That passage is text from Apple OCR, not a publisher abstract.",
      connect: "Charts stay empty until the OCR text names a method.",
      newcomer: preview,
      evidenceIds: [first.id],
    },
  };
}
