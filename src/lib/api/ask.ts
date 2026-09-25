import type { AskScope, GroundedNote, PaperRecord } from "@/lib/api/types";

export type AskIntent = "what" | "why" | "connect" | "newcomer" | "other";

export function classifyQuestion(question: string): AskIntent {
  const s = question.toLowerCase();
  if (
    /new to this|i'm new|im new|like i'm|like i am|beginner|eli5|explain simply|plain language/.test(
      s,
    )
  ) {
    return "newcomer";
  }
  if (/connect|method|fit in|relate/.test(s)) return "connect";
  if (/\bwhy\b|used here|purpose/.test(s)) return "why";
  if (/\bwhat\b|explain this|describe/.test(s)) return "what";
  return "other";
}

function fromNote(note: GroundedNote, intent: AskIntent): string {
  if (intent === "why") return note.why;
  if (intent === "connect") return note.connect;
  if (intent === "newcomer") return note.newcomer;
  if (intent === "what") return note.what;
  return `That wording is not a separate excerpt. The closest note stored for this scope is: ${note.what}`;
}

export function scopeKey(scope: AskScope): string {
  if (scope.kind === "paper") return "paper";
  if (scope.kind === "equation") return `equation:${scope.equationId}`;
  return `chart:${scope.chartId}`;
}

export function scopeLabel(paper: PaperRecord, scope: AskScope): string {
  if (scope.kind === "paper") return "Whole paper";
  if (scope.kind === "equation") {
    const eq = paper.equations.find((row) => row.id === scope.equationId);
    return eq ? `Equation (${eq.number})` : "Equation";
  }
  const chart = paper.charts.find((row) => row.id === scope.chartId);
  return chart ? `Chart: ${chart.title}` : "Chart";
}

export function suggestedPrompts(scope: AskScope): string[] {
  if (scope.kind === "chart") {
    return [
      "Explain this chart in the context of the paper.",
      "Why is it used here?",
      "How does it connect to the method?",
      "Explain like I’m new to this field.",
    ];
  }
  return [
    "What is this?",
    "Why is it used here?",
    "How does it connect to the method?",
    "Explain like I’m new to this field.",
  ];
}

/**
 * Answers are selected from notes that already cite chunk ids.
 * If those ids are missing from the paper, the reply refuses.
 */
export function groundedAnswer(
  paper: PaperRecord,
  scope: AskScope,
  question: string,
): { content: string; evidenceIds: string[] } {
  const known = new Set(paper.chunks.map((chunk) => chunk.id));
  const intent = classifyQuestion(question);

  let note: GroundedNote | null = null;
  if (scope.kind === "paper") {
    note = paper.chunks.length > 0 ? paper.ask : null;
  } else if (scope.kind === "equation") {
    note = paper.equations.find((row) => row.id === scope.equationId)?.note ?? null;
  } else {
    note = paper.charts.find((row) => row.id === scope.chartId)?.note ?? null;
  }

  if (!note) {
    return {
      content:
        "There is no retrieved text for this scope. Upload the PDF if the publisher page is paywalled, or open a paper whose status is Ready.",
      evidenceIds: [],
    };
  }

  const evidenceIds = note.evidenceIds.filter((id) => known.has(id));
  if (evidenceIds.length === 0) {
    return {
      content:
        "I don’t have a retrieved excerpt for that, so I won’t guess. Try a section, equation, or chart that lists evidence.",
      evidenceIds: [],
    };
  }

  return { content: fromNote(note, intent), evidenceIds };
}
