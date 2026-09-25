"use client";

import { useEffect, useRef, useState } from "react";
import { Square, X } from "lucide-react";
import type { AskScope, PaperRecord } from "@/lib/api/types";
import { scopeLabel, suggestedPrompts } from "@/lib/api/ask";
import { SAMPLE_ASK_NOTE } from "@/lib/paper-store";
import { paperLensClient } from "@/lib/api/client";
import { getThread, setThread, usePaperStore } from "@/lib/paper-store";
import { AskChartMark } from "@/components/ask-chart-button";
import { EvidenceQuote } from "@/components/evidence-quote";
import { MathText } from "@/components/math-text";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const recentClaims = new Map<string, number>();

function claimQuestion(key: string) {
  const now = Date.now();
  const previous = recentClaims.get(key) ?? 0;
  if (now - previous < 1000) return false;
  recentClaims.set(key, now);
  return true;
}

export function AskDrawer({
  paper,
  scope,
  open,
  draft,
  onDraft,
  onClose,
  inputRef,
  autoSendKey = 0,
  onShowInSources,
}: {
  paper: PaperRecord;
  scope: AskScope;
  open: boolean;
  draft: string;
  onDraft: (value: string) => void;
  onClose: () => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  autoSendKey?: number;
  onShowInSources?: (chunkId: string) => void;
}) {
  usePaperStore();
  const messages = getThread(paper.summary.id, scope);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const prompts = suggestedPrompts(scope);
  const chunks = new Map(paper.chunks.map((chunk) => [chunk.id, chunk]));

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight });
  }, [messages, open]);

  const draftRef = useRef(draft);
  draftRef.current = draft;
  const sendRef = useRef(send);
  sendRef.current = send;

  useEffect(() => {
    if (!autoSendKey) return;
    const question = draftRef.current.trim();
    if (question) void sendRef.current(question);
  }, [autoSendKey]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    const claim = `${paper.summary.id}:${scope.kind}:${"equationId" in scope ? scope.equationId : "chartId" in scope ? scope.chartId : "paper"}:${question}`;
    if (!claimQuestion(claim)) return;
    onDraft("");
    const userId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    const prior = getThread(paper.summary.id, scope);
    setThread(paper.summary.id, scope, [
      ...prior,
      {
        id: userId,
        role: "user",
        content: question,
        evidenceIds: [],
        streaming: false,
        stopped: false,
      },
      {
        id: assistantId,
        role: "assistant",
        content: "",
        evidenceIds: [],
        streaming: true,
        stopped: false,
      },
    ]);
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    try {
      const result = await paperLensClient.ask({
        paperId: paper.summary.id,
        scope,
        question,
        signal: controller.signal,
        onMeta: ({ evidenceIds }) => {
          const current = getThread(paper.summary.id, scope);
          setThread(
            paper.summary.id,
            scope,
            current.map((message) =>
              message.id === assistantId ? { ...message, evidenceIds } : message,
            ),
          );
        },
        onToken: (token) => {
          const current = getThread(paper.summary.id, scope);
          setThread(
            paper.summary.id,
            scope,
            current.map((message) =>
              message.id === assistantId
                ? { ...message, content: message.content + token }
                : message,
            ),
          );
        },
      });
      const current = getThread(paper.summary.id, scope);
      setThread(
        paper.summary.id,
        scope,
        current.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                content: result.content || message.content,
                evidenceIds: result.evidenceIds,
                streaming: false,
                stopped: result.stopped,
              }
            : message,
        ),
      );
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  if (!open) return null;

  return (
    <aside
      className="flex h-[min(78dvh,680px)] w-full flex-col border-border bg-card max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-50 max-md:rounded-t-2xl max-md:border-t max-md:shadow-2xl md:h-full md:w-[400px] md:shrink-0 md:border-l"
      aria-label="Ask Chart"
    >
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <AskChartMark className="size-5 text-primary [--ask-mark-ink:var(--card)]" />
            <p className="text-sm font-medium">Ask Chart</p>
          </div>
          <p className="mt-2 inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            {scopeLabel(paper, scope)}
          </p>
          {paper.summary.status === "unparsed" ? (
            <p className="mt-2 text-xs leading-5 font-medium text-amber-950">{SAMPLE_ASK_NOTE}</p>
          ) : null}
        </div>
        <Button variant="ghost" size="icon" className="size-11" onClick={onClose} aria-label="Close ask panel">
          <X />
        </Button>
      </div>

      <div ref={scrollerRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <p className="text-sm leading-6 text-muted-foreground">
            Answers stay inside retrieved excerpts from this paper. AI-generated explanation.
          </p>
        ) : null}
        {messages.map((message) => (
          <div key={message.id} className={message.role === "user" ? "flex justify-end" : ""}>
            {message.role === "user" ? (
              <p className="max-w-[90%] rounded-2xl bg-primary px-3 py-2 text-sm leading-6 text-primary-foreground">
                {message.content}
              </p>
            ) : (
              <div className="space-y-2">
                {paper.summary.status === "unparsed" ? (
                  <p className="text-xs leading-5 font-medium text-amber-950">{SAMPLE_ASK_NOTE}</p>
                ) : null}
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  AI-generated explanation
                  {message.stopped ? " · stopped" : ""}
                  {message.streaming ? " · writing" : ""}
                </p>
                <div aria-live="polite" className="text-sm leading-6">
                  {message.content ? (
                    <MathText text={message.content} />
                  ) : (
                    <span className="text-muted-foreground">Looking at the excerpt…</span>
                  )}
                </div>
                {message.evidenceIds.length > 0 ? (
                  <details open className="rounded-lg bg-muted/50 px-3 py-2">
                    <summary className="cursor-pointer text-xs font-medium tracking-wide uppercase">
                      Evidence · {message.evidenceIds.length}
                    </summary>
                    <div className="mt-2 space-y-3">
                      {message.evidenceIds.map((id) => {
                        const chunk = chunks.get(id);
                        return chunk ? (
                          <div key={id}>
                            <EvidenceQuote chunk={chunk} />
                            <button
                              type="button"
                              className="mt-1 text-xs text-primary underline-offset-2 hover:underline"
                              onClick={() => onShowInSources?.(id)}
                            >
                              Show in Sources
                            </button>
                          </div>
                        ) : (
                          <p key={id} className="text-xs text-destructive">
                            Missing excerpt {id}
                          </p>
                        );
                      })}
                    </div>
                  </details>
                ) : !message.streaming ? (
                  <p className="text-xs text-muted-foreground">No excerpt attached.</p>
                ) : null}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="border-t px-4 py-3">
        <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
          {prompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="shrink-0 rounded-full border px-3 py-1.5 text-xs hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
              onClick={() => {
                onDraft(prompt);
                inputRef.current?.focus();
              }}
            >
              {prompt}
            </button>
          ))}
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void send(draft);
          }}
        >
          <Textarea
            ref={inputRef}
            id="ask-input"
            value={draft}
            onChange={(event) => onDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send(draft);
              }
            }}
            placeholder="Ask what this is, or why it is in the paper"
            rows={3}
            className="min-h-20 resize-none"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Enter sends · Shift+Enter newline · Esc closes</p>
            {busy ? (
              <Button type="button" variant="outline" className="h-10" onClick={stop}>
                <Square className="size-3.5" />
                Stop
              </Button>
            ) : (
              <Button type="submit" className="h-10" disabled={!draft.trim()}>
                Send
              </Button>
            )}
          </div>
        </form>
      </div>
    </aside>
  );
}
