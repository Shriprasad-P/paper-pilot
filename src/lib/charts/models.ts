export const FLUX_SCHNELL = "flux.1-schnell";

export const FLUX_KLEIN = "flux.2-klein";

export const EMBED_MODEL = "nomic-embed-text";

export const ASK_MODEL = "llama3.2:3b";

export const GEMMA_ASK_MODEL = "gemma2:2b";

export const RAM_BUDGET_GB = 18;

export const ASK_MODEL_OPTIONS = [
  {
    id: ASK_MODEL,
    label: "llama3.2:3b",
    note: "Default Ask model. Ollama. Loaded only after FLUX has exited. Answers only from retrieved excerpts.",
  },
  {
    id: GEMMA_ASK_MODEL,
    label: "gemma2:2b (optional)",
    note: "Alternate Ask model. Not pulled by setup. Use it only when that Ollama tag is already installed.",
  },
] as const;

export const FLUX_MODEL_OPTIONS = [
  {
    id: FLUX_SCHNELL,
    label: "FLUX.1 schnell",
    note: "Default renderer. mflux, 4-bit, few steps. Loaded only after Ollama chat is unloaded.",
  },
  {
    id: FLUX_KLEIN,
    label: "FLUX.2 klein",
    note: "Use when that checkpoint is already installed. Same rule: never resident with the Ask model.",
  },
] as const;

export type AskModelId = (typeof ASK_MODEL_OPTIONS)[number]["id"];
export type FluxModelId = (typeof FLUX_MODEL_OPTIONS)[number]["id"];

const ASK_ALLOWED = new Set<string>(ASK_MODEL_OPTIONS.map((option) => option.id));
const FLUX_ALLOWED = new Set<string>(FLUX_MODEL_OPTIONS.map((option) => option.id));

export function isAskModelId(value: string): value is AskModelId {
  return ASK_ALLOWED.has(value);
}

export function isFluxModelId(value: string): value is FluxModelId {
  return FLUX_ALLOWED.has(value);
}

export const SETTINGS_KEY = "paper-lens-settings";

export type ChartSettings = {
  mockMode: boolean;
  askModel: AskModelId;
  fluxModel: FluxModelId;
  appleOcr: boolean;
};

export const DEFAULT_CHART_SETTINGS: ChartSettings = {
  mockMode: true,
  askModel: ASK_MODEL,
  fluxModel: FLUX_SCHNELL,
  appleOcr: true,
};

export function readChartSettings(): ChartSettings {
  if (typeof window === "undefined") return DEFAULT_CHART_SETTINGS;
  const raw = window.localStorage.getItem(SETTINGS_KEY);
  if (!raw) return DEFAULT_CHART_SETTINGS;
  try {
    const parsed = JSON.parse(raw) as {
      mockMode?: boolean;
      askModel?: string;
      fluxModel?: string;
      appleOcr?: boolean;
    };
    return {
      mockMode: parsed.mockMode !== false,
      askModel: parsed.askModel && isAskModelId(parsed.askModel)
        ? parsed.askModel
        : DEFAULT_CHART_SETTINGS.askModel,
      fluxModel: parsed.fluxModel && isFluxModelId(parsed.fluxModel)
        ? parsed.fluxModel
        : DEFAULT_CHART_SETTINGS.fluxModel,
      appleOcr: parsed.appleOcr !== false,
    };
  } catch {
    return DEFAULT_CHART_SETTINGS;
  }
}
