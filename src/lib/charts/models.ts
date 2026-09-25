export const VLM_8B_MODEL = "mlx-community/Qwen3-VL-8B-Instruct-4bit";

export const VLM_4B_MODEL = "lmstudio-community/Qwen3-VL-4B-Instruct-MLX-4bit";

export const FLUX_SCHNELL = "flux.1-schnell";

export const FLUX_KLEIN = "flux.2-klein";

export const EMBED_MODEL = "nomic-embed-text";

export const ASK_MODEL = "qwen3:4b";

export const RAM_BUDGET_GB = 18;

export const CHART_MODEL_OPTIONS = [
  {
    id: VLM_8B_MODEL,
    label: "Qwen3-VL-8B MLX 4-bit",
    note: "Default when memory allows. Loaded alone, then exited before FLUX. About 6 GB.",
  },
  {
    id: VLM_4B_MODEL,
    label: "Qwen3-VL-4B MLX 4-bit (low memory)",
    note: "Also the automatic fallback if 8B runs out of memory. About 3 GB.",
  },
] as const;

export const FLUX_MODEL_OPTIONS = [
  {
    id: FLUX_SCHNELL,
    label: "FLUX.1 schnell",
    note: "Default renderer. 4-bit, few steps, loaded only after the vision sidecar exits.",
  },
  {
    id: FLUX_KLEIN,
    label: "FLUX.2 klein",
    note: "Use when that checkpoint is installed. Same rule: never resident with the vision model.",
  },
] as const;

export type ChartModelId = (typeof CHART_MODEL_OPTIONS)[number]["id"];
export type FluxModelId = (typeof FLUX_MODEL_OPTIONS)[number]["id"];

const ALLOWED = new Set<string>(CHART_MODEL_OPTIONS.map((option) => option.id));
const FLUX_ALLOWED = new Set<string>(FLUX_MODEL_OPTIONS.map((option) => option.id));

export function isChartModelId(value: string): value is ChartModelId {
  return ALLOWED.has(value);
}

export function isFluxModelId(value: string): value is FluxModelId {
  return FLUX_ALLOWED.has(value);
}

export const SETTINGS_KEY = "paper-lens-settings";

export type ChartSettings = {
  mockMode: boolean;
  chartModel: ChartModelId;
  fluxModel: FluxModelId;
  appleOcr: boolean;
};

export const DEFAULT_CHART_SETTINGS: ChartSettings = {
  mockMode: true,
  chartModel: VLM_8B_MODEL,
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
      chartModel?: string;
      fluxModel?: string;
      appleOcr?: boolean;
    };
    return {
      mockMode: parsed.mockMode !== false,
      chartModel: parsed.chartModel && isChartModelId(parsed.chartModel)
        ? parsed.chartModel
        : DEFAULT_CHART_SETTINGS.chartModel,
      fluxModel: parsed.fluxModel && isFluxModelId(parsed.fluxModel)
        ? parsed.fluxModel
        : DEFAULT_CHART_SETTINGS.fluxModel,
      appleOcr: parsed.appleOcr !== false,
    };
  } catch {
    return DEFAULT_CHART_SETTINGS;
  }
}
