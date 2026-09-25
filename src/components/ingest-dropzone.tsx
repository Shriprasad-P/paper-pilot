"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileText, RotateCcw } from "lucide-react";
import type { Provider } from "@/lib/api/types";
import {
  detectProvider,
  ingest,
  retryJob,
  stageLabel,
  usePaperStore,
} from "@/lib/paper-store";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const PROVIDERS: { id: Provider; label: string }[] = [
  { id: "arxiv", label: "arXiv" },
  { id: "ieee", label: "IEEE" },
  { id: "springer", label: "Springer" },
  { id: "other", label: "Other" },
];

const SAMPLES: { label: string; url: string }[] = [
  { label: "Transformer (arXiv)", url: "https://arxiv.org/abs/1706.03762" },
  { label: "BERT (arXiv)", url: "https://arxiv.org/abs/1810.04805" },
  { label: "IEEE example", url: "https://ieeexplore.ieee.org/document/example" },
  { label: "Springer example", url: "https://link.springer.com/chapter/example" },
];

const STAGE_ORDER = [
  "fetching",
  "parsing",
  "embedding",
  "extracting_equations",
  "building_charts",
  "ready",
] as const;

export function IngestDropzone() {
  const { jobs } = usePaperStore();
  const [files, setFiles] = useState<File[]>([]);
  const [url, setUrl] = useState("");
  const [provider, setProvider] = useState<Provider>("arxiv");
  const [providerLocked, setProviderLocked] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const detected = useMemo(() => (url.trim() ? detectProvider(url.trim()) : provider), [provider, url]);
  const activeProvider = providerLocked ? provider : url.trim() ? detected : provider;

  function addFiles(list: FileList | File[]) {
    const next: File[] = [];
    const rejected: string[] = [];
    Array.from(list).forEach((file) => {
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        next.push(file);
      } else {
        rejected.push(file.name);
      }
    });
    if (rejected.length > 0) {
      setFileError(
        rejected.length === 1
          ? `${rejected[0]} isn’t a PDF.`
          : "Some files aren’t PDFs and were left out.",
      );
    } else {
      setFileError(null);
    }
    setFiles((current) => {
      const names = new Set(current.map((file) => file.name));
      return [...current, ...next.filter((file) => !names.has(file.name))];
    });
  }

  function submit() {
    const items = [
      ...files.map((file) => ({
        kind: "pdf" as const,
        name: file.name,
        provider: "pdf" as const,
      })),
      ...(url.trim()
        ? [
            {
              kind: "url" as const,
              name: url.trim(),
              url: url.trim(),
              provider: activeProvider,
            },
          ]
        : []),
    ];
    if (items.length === 0) return;
    ingest(items);
    setFiles([]);
    setUrl("");
    setProviderLocked(false);
  }

  return (
    <div className="space-y-8">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          if (event.dataTransfer.files.length > 0) addFiles(event.dataTransfer.files);
        }}
        className={cn(
          "rounded-2xl border border-dashed bg-card px-6 py-14 text-center transition",
          dragOver ? "border-primary bg-primary/5" : "border-border",
        )}
      >
        <FileText className="mx-auto size-8 text-primary" aria-hidden />
        <p className="mt-3 font-serif text-2xl">Drop PDFs here</p>
        <p className="mt-1 text-sm text-muted-foreground">Several files are fine. Only PDFs are accepted.</p>
        <label className="mt-5 inline-flex h-11 cursor-pointer items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
          Browse files
          <input
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="sr-only"
            onChange={(event) => {
              if (event.target.files) addFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
        {files.length > 0 ? (
          <ul className="mx-auto mt-6 max-w-md space-y-2 text-left text-sm">
            {files.map((file) => (
              <li key={file.name} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                <span className="truncate">{file.name}</span>
                <button
                  type="button"
                  className="text-muted-foreground underline-offset-2 hover:underline"
                  onClick={() => setFiles((current) => current.filter((item) => item.name !== file.name))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {fileError ? <p className="mt-3 text-sm text-destructive">{fileError}</p> : null}
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-medium" htmlFor="paper-url">
          Or paste a paper URL
        </label>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Publisher">
          {PROVIDERS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={activeProvider === item.id}
              onClick={() => {
                setProvider(item.id);
                setProviderLocked(true);
              }}
              className={cn(
                "h-9 rounded-full border px-3 text-sm",
                activeProvider === item.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card hover:bg-muted",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="paper-url"
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              setProviderLocked(false);
            }}
            placeholder="https://arxiv.org/abs/1706.03762"
            className="h-11"
          />
          <Button
            className="h-11"
            disabled={files.length === 0 && !url.trim()}
            onClick={submit}
          >
            Add to library
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {SAMPLES.map((sample) => (
            <button
              key={sample.url}
              type="button"
              className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                setUrl(sample.url);
                setProvider(detectProvider(sample.url));
                setProviderLocked(false);
              }}
            >
              {sample.label}
            </button>
          ))}
        </div>
      </div>

      {jobs.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-serif text-xl">Processing</h2>
          <ul className="space-y-3">
            {jobs.map((job) => (
              <li key={job.id} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{job.input.name}</p>
                  {job.done && job.paperId && !job.error ? (
                    <StatusPill status={job.warnings.length > 0 ? "partial" : "ready"} />
                  ) : null}
                  {job.error ? (
                    <StatusPill status={job.error.includes("Paywalled") ? "paywalled" : "failed"} detail={job.error} />
                  ) : null}
                  {!job.done && !job.error ? <StatusPill status="indexing" /> : null}
                </div>
                <ol className="mt-3 flex flex-wrap gap-2">
                  {STAGE_ORDER.map((stage, index) => {
                    const failedHere = job.stage === "failed" && job.stageIndex === index;
                    const reached = job.stage === "failed" ? index <= job.stageIndex : index <= job.stageIndex;
                    const current = !job.done && index === job.stageIndex && !failedHere;
                    return (
                      <li
                        key={stage}
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs",
                          failedHere && "bg-destructive/10 text-destructive",
                          current && "bg-primary/10 text-primary",
                          reached && !failedHere && !current && "bg-muted text-foreground",
                          !reached && "bg-muted/50 text-muted-foreground",
                        )}
                      >
                        {stageLabel(stage, job.input.provider)}
                      </li>
                    );
                  })}
                </ol>
                {job.warnings.map((warning) => (
                  <p key={warning} className="mt-2 text-sm text-amber-950">
                    {warning}
                  </p>
                ))}
                {job.error ? <p className="mt-2 text-sm text-destructive">{job.error}</p> : null}
                <div className="mt-3 flex gap-2">
                  {job.error ? (
                    <Button variant="outline" className="h-10" onClick={() => retryJob(job.id)}>
                      <RotateCcw className="size-4" />
                      Retry
                    </Button>
                  ) : null}
                  {job.done && job.paperId ? (
                    <Button className="h-10" nativeButton={false} render={<Link href={`/papers/${job.paperId}`} />}>
                      Open paper
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
