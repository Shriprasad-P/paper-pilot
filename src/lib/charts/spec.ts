import type {
  ChartKind,
  ChartSpec,
  DiagramEdge,
  DiagramNode,
  DiagramNodeRole,
  EvidenceChunk,
  GroundedNote,
} from "@/lib/api/types";

const KINDS = new Set<ChartKind>([
  "methodology_workflow",
  "model_architecture",
  "training_or_inference_loop",
  "data_pipeline",
]);

const ROLES = new Set<DiagramNodeRole>([
  "input",
  "process",
  "model",
  "output",
  "loss",
  "other",
]);

export const DEFAULT_VISUAL_STYLE =
  "High-fidelity vector diagram, clean technical schematic, corporate isometric blueprint";

const METHOD_SECTION =
  /model|architect|encoder|decoder|attention|embed|position|train|optim|regular|feed-forward|method|figure/i;

export function methodExcerpts(chunks: EvidenceChunk[], options?: { strict?: boolean }) {
  const picked = chunks.filter((chunk) => METHOD_SECTION.test(chunk.text));
  const source = picked.length > 0 ? picked : options?.strict ? [] : chunks;
  const rows = source.slice(0, 16);
  return rows.map((chunk) => ({
    id: chunk.id,
    section: chunk.section,
    page: chunk.page,
    text: chunk.text,
  }));
}

function safeId(id: string): string {
  const cleaned = id.replace(/[^A-Za-z0-9_]/g, "");
  if (/^[A-Za-z]/.test(cleaned)) return cleaned;
  return `n${cleaned || "node"}`;
}

function quote(label: string): string {
  return label.replace(/"/g, "'").replace(/[<>]/g, "").trim();
}

export function mermaidFromDiagram(spec: {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}): string {
  const lines = ["flowchart TB"];
  for (const node of spec.nodes) {
    lines.push(`  ${safeId(node.id)}["${quote(node.label)}"]`);
  }
  for (const edge of spec.edges) {
    const from = safeId(edge.from);
    const to = safeId(edge.to);
    if (edge.label && edge.label.trim()) {
      lines.push(`  ${from} -->|${quote(edge.label)}| ${to}`);
    } else {
      lines.push(`  ${from} --> ${to}`);
    }
  }
  lines.push("  classDef input fill:#f4f0e6,stroke:#1b4f5c,color:#1c1915");
  lines.push("  classDef process fill:#e6f1f3,stroke:#1b4f5c,color:#1c1915");
  lines.push("  classDef model fill:#d5e8ec,stroke:#1b4f5c,color:#1c1915");
  lines.push("  classDef output fill:#f7f4ee,stroke:#1b4f5c,color:#1c1915");
  lines.push("  classDef loss fill:#f3e6e0,stroke:#1b4f5c,color:#1c1915");
  lines.push("  classDef other fill:#f7f4ee,stroke:#1b4f5c,color:#1c1915");
  for (const node of spec.nodes) {
    lines.push(`  class ${safeId(node.id)} ${node.role}`);
  }
  return lines.join("\n");
}

export function denseFluxPrompt(title: string, nodes: DiagramNode[]): string {
  const places = nodes.map((node, index) => {
    const place = index === 0 ? "top" : index === nodes.length - 1 ? "bottom" : "middle";
    return `the text "${node.label}" clearly printed on the ${place} module`;
  });
  return [
    `A clean, high-resolution technical diagram of ${title}.`,
    DEFAULT_VISUAL_STYLE + ".",
    "Boxes and arrows, crisp typography, no decorative art, no extra words.",
    `Layout from top to bottom: ${places.join("; ")}.`,
    ...nodes.map((node) => `The text "${node.label}" must be written in crisp, clean typography.`),
  ].join(" ");
}

function promptQuotesLabels(prompt: string, labels: string[]): boolean {
  return labels.every((label) => prompt.includes(`"${label}"`));
}

function words(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2);
}

function labelInText(label: string, text: string): boolean {
  const haystack = text.toLowerCase();
  const tokens = words(label);
  if (tokens.length === 0) return haystack.includes(label.toLowerCase());
  return tokens.some((token) => haystack.includes(token));
}

export type RawDiagram = {
  kind?: string;
  title?: string;
  caption?: string;
  mermaid?: string;
  nodes?: Array<{
    id?: string;
    label?: string;
    role?: string;
    evidence_ids?: string[];
  }>;
  edges?: Array<{ from?: string; to?: string; label?: string | null }>;
  evidence_ids?: string[];
  warnings?: string[];
  extracted_text_nodes?: string[];
  visual_style?: string;
  dense_flux_prompt?: string;
  image_url?: string | null;
  render?: string;
};

/**
 * Keep a diagram only where node labels sit in the cited excerpts.
 * Drops unsupported nodes instead of keeping a guessed module name.
 */
export function groundDiagram(
  raw: RawDiagram,
  excerpts: { id: string; text: string }[],
): {
  diagram: Omit<ChartSpec, "id" | "note" | "modelId" | "vlModelId" | "fluxModelId" | "backend" | "elapsedMs" | "imageUrl" | "render">;
} | { error: string } {
  if (!raw.kind || !KINDS.has(raw.kind as ChartKind)) {
    return { error: "Diagram kind is missing or not supported." };
  }
  const byId = new Map(excerpts.map((excerpt) => [excerpt.id, excerpt.text]));
  const warnings = Array.isArray(raw.warnings)
    ? raw.warnings.filter((item): item is string => typeof item === "string").slice(0, 6)
    : [];

  const nodes: DiagramNode[] = [];
  for (const node of raw.nodes ?? []) {
    if (nodes.length >= 12) {
      warnings.push("Stopped at 12 nodes.");
      break;
    }
    const id = typeof node.id === "string" ? safeId(node.id) : "";
    const label = typeof node.label === "string" ? node.label.trim() : "";
    const role = ROLES.has(node.role as DiagramNodeRole) ? (node.role as DiagramNodeRole) : "other";
    const evidence = (node.evidence_ids ?? []).filter((item) => byId.has(item));
    if (!id || !label || evidence.length === 0) {
      warnings.push("Dropped a node with no retrieved excerpt.");
      continue;
    }
    const cited = evidence.map((item) => byId.get(item) ?? "").join("\n");
    if (!labelInText(label, cited)) {
      warnings.push(`Dropped “${label}” because that wording is not in the cited excerpt.`);
      continue;
    }
    nodes.push({ id, label: label.slice(0, 80), role, evidence_ids: evidence });
  }

  if (nodes.length < 2) {
    return { error: "Couldn't build charts from the method section. Too little of the diagram was grounded." };
  }

  const ids = new Set(nodes.map((node) => node.id));
  const edges: DiagramEdge[] = [];
  for (const edge of raw.edges ?? []) {
    const from = typeof edge.from === "string" ? safeId(edge.from) : "";
    const to = typeof edge.to === "string" ? safeId(edge.to) : "";
    if (!ids.has(from) || !ids.has(to) || from === to) continue;
    const label = typeof edge.label === "string" && edge.label.trim() ? edge.label.trim().slice(0, 40) : null;
    edges.push({ from, to, label });
  }

  const evidence_ids = [...new Set(nodes.flatMap((node) => node.evidence_ids))];
  const nodeWords = new Set(nodes.flatMap((node) => words(node.label)));
  let caption = typeof raw.caption === "string" ? raw.caption.trim() : "";
  const captionHits = words(caption).filter((word) => word.length > 3 && nodeWords.has(word));
  if (!caption || captionHits.length === 0) {
    caption = nodes.map((node) => node.label).join(" → ");
    warnings.push("Caption fell back to the grounded node labels.");
  }
  const title = typeof raw.title === "string" && raw.title.trim()
    ? raw.title.trim().slice(0, 80)
    : "Methodology";

  const mermaidOk =
    typeof raw.mermaid === "string" &&
    /^(flowchart|graph)\s+(TB|TD|LR|RL|BT)\b/.test(raw.mermaid.trim()) &&
    !/javascript:|click\s/i.test(raw.mermaid);

  const diagramNodes = nodes;
  const mermaid = mermaidOk
    ? raw.mermaid!.trim()
    : mermaidFromDiagram({ nodes: diagramNodes, edges });
  if (!mermaidOk) warnings.push("Rebuilt the diagram from grounded nodes.");

  const labels = diagramNodes.map((node) => node.label);
  let fluxPrompt = typeof raw.dense_flux_prompt === "string" ? raw.dense_flux_prompt.trim() : "";
  if (!fluxPrompt || !promptQuotesLabels(fluxPrompt, labels)) {
    fluxPrompt = denseFluxPrompt(title, diagramNodes);
    warnings.push("Rebuilt the FLUX prompt so every label is quoted.");
  }

  return {
    diagram: {
      kind: raw.kind as ChartKind,
      title,
      caption: caption.slice(0, 400),
      mermaid,
      nodes: diagramNodes,
      edges,
      evidence_ids,
      warnings: [...new Set(warnings)].slice(0, 8),
      extractedTextNodes: labels,
      visualStyle: typeof raw.visual_style === "string" && raw.visual_style.trim()
        ? raw.visual_style.trim().slice(0, 180)
        : DEFAULT_VISUAL_STYLE,
      denseFluxPrompt: fluxPrompt,
    },
  };
}

export function noteForDiagram(
  diagram: { caption: string; nodes: DiagramNode[]; evidence_ids: string[] },
): GroundedNote {
  const labels = diagram.nodes.map((node) => node.label).join(", ");
  return {
    what: diagram.caption,
    why: diagram.caption,
    connect: `The nodes on this reconstruction are: ${labels}.`,
    newcomer: diagram.caption,
    evidenceIds: diagram.evidence_ids,
  };
}

export function bundledChart(
  spec: Omit<
    ChartSpec,
    | "mermaid"
    | "modelId"
    | "backend"
    | "elapsedMs"
    | "warnings"
    | "extractedTextNodes"
    | "visualStyle"
    | "denseFluxPrompt"
    | "imageUrl"
    | "render"
    | "vlModelId"
    | "fluxModelId"
  > & {
    warnings?: string[];
    mermaid?: string;
  },
): ChartSpec {
  return {
    ...spec,
    warnings: spec.warnings ?? [],
    mermaid: spec.mermaid ?? mermaidFromDiagram(spec),
    extractedTextNodes: spec.nodes.map((node) => node.label),
    visualStyle: DEFAULT_VISUAL_STYLE,
    denseFluxPrompt: null,
    imageUrl: null,
    render: "bundled",
    vlModelId: null,
    fluxModelId: null,
    modelId: null,
    backend: "bundled",
    elapsedMs: null,
  };
}
