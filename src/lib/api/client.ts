import type {
  AskArgs,
  AskResult,
  PaperLensClient,
} from "@/lib/api/types";
import { groundedAnswer } from "@/lib/api/ask";
import {
  getJob,
  getPaper,
  ingest,
  listPapers,
  reprocess,
} from "@/lib/paper-store";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Mock Paper Lens client. Swap this module for a network client when
 * embeddings, the local Ask model, and chart generation are wired. The UI should keep
 * calling PaperLensClient only.
 */
export function createPaperLensClient(): PaperLensClient {
  return {
    listPapers,
    getPaper,
    getWalkthrough(id) {
      return getPaper(id)?.walkthrough ?? [];
    },
    getEquations(id) {
      const paper = getPaper(id);
      return {
        equations: paper?.equations ?? [],
        warnings: paper?.equationWarnings ?? [],
      };
    },
    getCharts(id) {
      const paper = getPaper(id);
      return {
        charts: paper?.charts ?? [],
        error: paper?.chartError ?? null,
      };
    },
    ingest,
    getJob,
    reprocess,
    async ask(args: AskArgs): Promise<AskResult> {
      const paper = getPaper(args.paperId);
      if (!paper) {
        return {
          content: "That paper is not in the library.",
          evidenceIds: [],
          stopped: false,
        };
      }
      const answer = groundedAnswer(paper, args.scope, args.question);
      args.onMeta?.({ evidenceIds: answer.evidenceIds });
      const tokens = answer.content.split(/(\s+)/);
      let built = "";
      for (const token of tokens) {
        if (args.signal?.aborted) {
          return {
            content: built.trim(),
            evidenceIds: answer.evidenceIds,
            stopped: true,
          };
        }
        built += token;
        args.onToken?.(token);
        await sleep(12);
      }
      return {
        content: answer.content,
        evidenceIds: answer.evidenceIds,
        stopped: false,
      };
    },
  };
}

export const paperLensClient = createPaperLensClient();
