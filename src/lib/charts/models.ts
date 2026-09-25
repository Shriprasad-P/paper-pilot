export const DEFAULT_VLM_MODEL =
  "lmstudio-community/Qwen3-VL-4B-Instruct-MLX-4bit";

export const LARGE_VLM_MODEL = "mlx-community/Qwen3.5-27B-4bit";

export const OLLAMA_FALLBACK_MODEL = "qwen2.5vl:7b";

export const CHART_MODEL_OPTIONS = [
  {
    id: DEFAULT_VLM_MODEL,
    label: "Qwen3-VL-4B MLX 4-bit",
    note: "Default. About 3 GB in the Hugging Face cache. Prefer this on a 24 GB Mac.",
  },
  {
    id: LARGE_VLM_MODEL,
    label: "Qwen3.5-27B MLX 4-bit",
    note: "About 15 GB. On a 24 GB M4 Pro, quit other large models first. A “Qwen 3.6” recollection maps to this Qwen3.5 family.",
  },
] as const;

export type ChartModelId = (typeof CHART_MODEL_OPTIONS)[number]["id"];

const ALLOWED = new Set<string>(CHART_MODEL_OPTIONS.map((option) => option.id));

export function isChartModelId(value: string): value is ChartModelId {
  return ALLOWED.has(value);
}

export const SETTINGS_KEY = "paper-lens-settings";

export type ChartSettings = {
  mockMode: boolean;
  chartModel: ChartModelId;
};

export const DEFAULT_CHART_SETTINGS: ChartSettings = {
  mockMode: true,
  chartModel: DEFAULT_VLM_MODEL,
};

export function readChartSettings(): ChartSettings {
  if (typeof window === "undefined") return DEFAULT_CHART_SETTINGS;
  const raw = window.localStorage.getItem(SETTINGS_KEY);
  if (!raw) return DEFAULT_CHART_SETTINGS;
  try {
    const parsed = JSON.parse(raw) as { mockMode?: boolean; chartModel?: string };
    return {
      mockMode: parsed.mockMode !== false,
      chartModel: parsed.chartModel && isChartModelId(parsed.chartModel)
        ? parsed.chartModel
        : DEFAULT_VLM_MODEL,
    };
  } catch {
    return DEFAULT_CHART_SETTINGS;
  }
}
