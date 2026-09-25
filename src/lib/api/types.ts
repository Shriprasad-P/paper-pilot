export type Provider = "arxiv" | "ieee" | "springer" | "other" | "pdf";

export type PaperStatus =
  | "indexing"
  | "ready"
  | "partial"
  | "failed"
  | "paywalled"
  | "unparsed";

export type IngestStage =
  | "fetching"
  | "parsing"
  | "embedding"
  | "extracting_equations"
  | "building_charts"
  | "ready";

export type DetailLevel = "simple" | "standard" | "deep";

export interface EvidenceChunk {
  id: string;
  section: string;
  page: number | null;
  text: string;
}

/** Plain-language notes. Every string is supported by evidenceIds. */
export interface GroundedNote {
  what: string;
  why: string;
  connect: string;
  newcomer: string;
  evidenceIds: string[];
}

export interface PaperSummary {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  venue: string | null;
  sourceLabel: string;
  sourceUrl: string | null;
  provider: Provider;
  status: PaperStatus;
  statusDetail: string;
  updatedAt: string;
  equationCount: number;
  chartCount: number;
  warnings: string[];
  /** Short library badge such as "Sample". */
  badge: string | null;
  /** Tooltip for the status pill. Longer than statusDetail. */
  statusHelp: string | null;
}

export interface SummaryCard {
  id: "problem" | "method" | "result";
  title: string;
  body: string;
  evidenceIds: string[];
}

export interface WalkthroughBlock {
  id: string;
  heading: string;
  sectionLabel: string;
  page: number | null;
  explanation: string;
  whyItMatters: string;
  deepNotes: string;
  /** Teaching analogy. Never presented as a claim from the paper. */
  analogy: string | null;
  evidenceIds: string[];
  /** Equation-table filter prefix when this section is open, e.g. "3.2". */
  equationPrefix?: string | null;
}

export interface EquationRow {
  id: string;
  number: number;
  latex: string;
  name: string;
  section: string;
  page: number | null;
  note: GroundedNote;
  /** Parser warning for this row, when extraction was partial. */
  warning: string | null;
}

export type ChartKind =
  | "workflow"
  | "architecture"
  | "training"
  | "evaluation";

export interface ChartSpec {
  id: string;
  title: string;
  caption: string;
  kind: ChartKind;
  mermaid: string;
  note: GroundedNote;
}

export interface PaperRecord {
  summary: PaperSummary;
  abstract: string | null;
  abstractEvidenceIds: string[];
  /** Shown when the workspace is a sample stand-in for an unparsed file. */
  demoNote: string | null;
  pageNote: string | null;
  cards: SummaryCard[];
  mainChartId: string | null;
  walkthrough: WalkthroughBlock[];
  equations: EquationRow[];
  equationWarnings: string[];
  charts: ChartSpec[];
  chartError: string | null;
  chunks: EvidenceChunk[];
  ask: GroundedNote;
}

export type AskScope =
  | { kind: "paper" }
  | { kind: "equation"; equationId: string }
  | { kind: "chart"; chartId: string };

export interface AskMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  evidenceIds: string[];
  streaming: boolean;
  stopped: boolean;
}

export interface IngestItemInput {
  kind: "pdf" | "url";
  name: string;
  url?: string;
  provider: Provider;
}

export interface IngestJob {
  id: string;
  input: IngestItemInput;
  stage: IngestStage | "failed";
  stageIndex: number;
  error: string | null;
  warnings: string[];
  paperId: string | null;
  done: boolean;
}

export interface AskArgs {
  paperId: string;
  scope: AskScope;
  question: string;
  signal?: AbortSignal;
  onMeta?: (meta: { evidenceIds: string[] }) => void;
  onToken?: (token: string) => void;
}

export interface AskResult {
  content: string;
  evidenceIds: string[];
  stopped: boolean;
}

export interface PaperLensClient {
  listPapers(): PaperSummary[];
  getPaper(id: string): PaperRecord | null;
  getWalkthrough(id: string): WalkthroughBlock[];
  getEquations(id: string): { equations: EquationRow[]; warnings: string[] };
  getCharts(id: string): { charts: ChartSpec[]; error: string | null };
  ingest(items: IngestItemInput[]): IngestJob[];
  getJob(id: string): IngestJob | null;
  reprocess(paperId: string): IngestJob | null;
  ask(args: AskArgs): Promise<AskResult>;
}
