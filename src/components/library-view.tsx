"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { listPapers, usePaperStore } from "@/lib/paper-store";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";

export function LibraryView() {
  usePaperStore();
  const papers = listPapers();
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return papers;
    return papers.filter((paper) => {
      const blob = [paper.title, paper.sourceLabel, paper.venue, ...paper.authors]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(needle);
    });
  }, [papers, query]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium tracking-wide text-primary uppercase">Library</p>
          <h1 className="mt-1 font-serif text-4xl tracking-tight">Your reading desk</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Drop a PDF or paste a link. Paper Lens walks the argument in plain language and keeps each explanation next to the passage it came from.
          </p>
        </div>
        <Button className="h-11" render={<Link href="/ingest" />}>
          Add a paper
        </Button>
      </div>

      <label className="mt-8 block">
        <span className="sr-only">Search papers</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by title, author, or source"
          className="h-11 w-full rounded-lg border bg-card px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </label>

      {filtered.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">No papers match that search.</p>
      ) : (
        <ul className="mt-6 divide-y overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10">
          {filtered.map((paper) => (
            <li key={paper.id}>
              <Link
                href={`/papers/${paper.id}`}
                className="flex flex-col gap-3 px-4 py-4 transition hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between md:px-5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-serif text-xl leading-snug">{paper.title}</h2>
                    {paper.badge ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {paper.badge}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {paper.authors.length > 0
                      ? `${paper.authors.slice(0, 3).join(", ")}${paper.authors.length > 3 ? " et al." : ""}`
                      : "Authors not retrieved"}
                    {paper.year ? ` · ${paper.year}` : ""}
                    {paper.venue ? ` · ${paper.venue}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{paper.sourceLabel}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>{paper.equationCount} equations</span>
                  <span>{paper.chartCount} charts</span>
                  <StatusPill status={paper.status} detail={paper.statusDetail} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
