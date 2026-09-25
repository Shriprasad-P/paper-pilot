"use client";

import { Download, Link2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { PaperRecord } from "@/lib/api/types";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";

function toMarkdown(paper: PaperRecord): string {
  const lines: string[] = [
    `# ${paper.summary.title}`,
    "",
    "AI-generated explanation. Each note below cites a stored excerpt id.",
    "",
  ];
  if (paper.abstract) {
    lines.push("## Abstract", "", paper.abstract, "");
  }
  for (const card of paper.cards) {
    lines.push(`## ${card.title}`, "", card.body, "", `Evidence: ${card.evidenceIds.join(", ")}`, "");
  }
  for (const block of paper.walkthrough) {
    lines.push(
      `## ${block.heading}`,
      "",
      block.explanation,
      "",
      `Evidence: ${block.evidenceIds.join(", ")}`,
      "",
    );
  }
  return lines.join("\n");
}

export function PaperHeader({
  paper,
  onReprocess,
}: {
  paper: PaperRecord;
  onReprocess: () => void;
}) {
  const authors = paper.summary.authors;
  const meta = [
    authors.length > 0 ? authors.slice(0, 3).join(", ") + (authors.length > 3 ? " et al." : "") : null,
    paper.summary.year,
    paper.summary.venue,
  ]
    .filter(Boolean)
    .join(" · ");

  function exportMarkdown() {
    if (!paper.abstract && paper.walkthrough.length === 0) {
      toast.error("Nothing to export. This paper has no retrieved text.");
      return;
    }
    const blob = new Blob([toMarkdown(paper)], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${paper.summary.id}.md`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Exported the walkthrough as Markdown.");
  }

  return (
    <div className="flex flex-col gap-3 border-b bg-card/80 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-serif text-xl leading-tight text-balance md:text-2xl">
            {paper.summary.title}
          </h1>
          <StatusPill
            status={paper.summary.status}
            detail={paper.summary.statusDetail}
            help={paper.summary.statusHelp}
          />
        </div>
        <p className="mt-1 truncate text-sm text-muted-foreground">
          {meta || paper.summary.sourceLabel}
          {meta ? ` · ${paper.summary.sourceLabel}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="outline"
          className="h-10"
          onClick={onReprocess}
          disabled={paper.summary.status === "indexing"}
        >
          <RefreshCw className="size-4" />
          Reprocess
        </Button>
        <Button variant="outline" className="h-10" onClick={exportMarkdown}>
          <Download className="size-4" />
          Export
        </Button>
        <Button
          variant="outline"
          className="h-10"
          onClick={() => {
            const url = `${window.location.origin}/papers/${paper.summary.id}`;
            void navigator.clipboard.writeText(url).then(
              () => toast.success("Copied local link."),
              () => toast.error("Couldn’t copy the link."),
            );
          }}
        >
          <Link2 className="size-4" />
          Copy local link
        </Button>
      </div>
    </div>
  );
}
