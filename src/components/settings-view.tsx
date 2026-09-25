"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CHART_MODEL_OPTIONS,
  DEFAULT_CHART_SETTINGS,
  SETTINGS_KEY,
  isChartModelId,
  type ChartModelId,
} from "@/lib/charts/models";

type Settings = {
  mode: "local" | "cloud";
  mockMode: boolean;
  chartModel: ChartModelId;
  chatModel: string;
  visionModel: string;
  embeddingModel: string;
  endpoint: string;
};

const DEFAULTS: Settings = {
  mode: "local",
  mockMode: DEFAULT_CHART_SETTINGS.mockMode,
  chartModel: DEFAULT_CHART_SETTINGS.chartModel,
  chatModel: "Qwen/Qwen3-0.6B",
  visionModel: "Qwen/Qwen3-VL-8B-Instruct",
  embeddingModel: "Qwen/Qwen3-Embedding-0.6B",
  endpoint: "http://127.0.0.1:8000",
};

export function SettingsView() {
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [apiKey, setApiKey] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<Settings> & { apiKey?: string };
        setSettings({
          ...DEFAULTS,
          ...parsed,
          mode: parsed.mode === "cloud" ? "cloud" : "local",
          mockMode: parsed.mockMode !== false,
          chartModel:
            typeof parsed.chartModel === "string" && isChartModelId(parsed.chartModel)
              ? parsed.chartModel
              : DEFAULTS.chartModel,
        });
        setApiKey(parsed.apiKey ?? "");
      } catch {
        setSettings(DEFAULTS);
      }
    }
    setReady(true);
  }, []);

  function persist(next: Settings) {
    setSettings(next);
    const previous = window.localStorage.getItem(SETTINGS_KEY);
    let apiKeyStored = "";
    if (previous) {
      try {
        apiKeyStored = (JSON.parse(previous) as { apiKey?: string }).apiKey ?? "";
      } catch {
        apiKeyStored = "";
      }
    }
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...next, apiKey: apiKeyStored }));
  }

    return (
    <div className="mx-auto max-w-2xl px-4 py-10 md:px-6">
      <p className="text-xs font-medium tracking-wide text-primary uppercase">Settings</p>
      <h1 className="mt-1 font-serif text-4xl">Models</h1>
      <p className="mt-4 rounded-lg border border-amber-950 bg-amber-950 px-4 py-3 text-sm leading-6 font-medium text-amber-50">
        {settings.mockMode
          ? "Mock mode is on. Models are not called. Charts stay the bundled reconstruction, and Ask uses the stored index."
          : "Mock mode is off for charts. Regenerate on a Ready paper runs the selected local MLX model. Ask still uses the stored index."}
      </p>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Chart generation is a local MLX compiler: excerpts in, a diagram spec out, Mermaid on the Charts tab. Cloud endpoint and API key stay off. Chat and embeddings are not wired.
      </p>

      <div className="mt-6 flex items-center gap-3">
        <span className="text-sm font-medium">Mock mode</span>
        <button
          type="button"
          aria-pressed={settings.mockMode}
          disabled={!ready}
          onClick={() => persist({ ...settings, mockMode: !settings.mockMode })}
          className="h-10 rounded-full bg-foreground px-4 text-sm text-background"
        >
          {settings.mockMode ? "On" : "Off"}
        </button>
      </div>

      <label className="mt-6 block text-sm">
        <span className="font-medium">Chart model</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          Used only when mock mode is off. Default is the 4B vision model. The 27B option needs about 15 GB; on a 24 GB M4 Pro, unload other models first. If MLX fails to load, the compiler tries Ollama <span className="font-mono">qwen2.5vl:7b</span>.
        </span>
        <select
          value={settings.chartModel}
          disabled={!ready || settings.mockMode}
          onChange={(event) => {
            const chartModel = event.target.value;
            if (isChartModelId(chartModel)) persist({ ...settings, chartModel });
          }}
          className="mt-1 h-11 w-full rounded-lg border bg-card px-3 font-mono text-xs disabled:opacity-60"
        >
          {CHART_MODEL_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="mt-1 block font-mono text-[11px] leading-5 text-muted-foreground">
          {settings.chartModel}
        </span>
        <span className="mt-1 block text-xs text-muted-foreground">
          {CHART_MODEL_OPTIONS.find((option) => option.id === settings.chartModel)?.note}
        </span>
      </label>

      <fieldset className="mt-6 space-y-4" disabled={!ready}>
        <Field
          label="Chat model"
          hint="Not called. Ask still uses the stored index."
          value={settings.chatModel}
          disabled
          onChange={(chatModel) => setSettings((current) => ({ ...current, chatModel }))}
        />
        <Field
          label="Vision model"
          hint="Not the chart compiler. Charts use the MLX id above."
          value={settings.visionModel}
          disabled
          onChange={(visionModel) => setSettings((current) => ({ ...current, visionModel }))}
        />
        <Field
          label="Embedding model"
          hint="Not called. Retrieval stays on the stored excerpts."
          value={settings.embeddingModel}
          disabled
          onChange={(embeddingModel) => setSettings((current) => ({ ...current, embeddingModel }))}
        />
        <Field
          label="Local endpoint"
          hint="Disabled. Chart generation does not use this endpoint."
          value={settings.endpoint}
          disabled
          onChange={(endpoint) => setSettings((current) => ({ ...current, endpoint }))}
        />
        <label className="block text-sm">
          <span className="font-medium">API key</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Disabled. Chart generation does not send a cloud key.
          </span>
          <Input
            type="password"
            autoComplete="off"
            value={apiKey}
            disabled
            placeholder="Not used in mock mode"
            className="mt-1 h-11"
          />
        </label>
      </fieldset>

      <div className="mt-8">
        <Button
          variant="outline"
          className="h-11"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? "Use light mode" : "Use dark mode"}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      {hint ? <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span> : null}
      <Input
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-11 font-mono text-xs"
      />
    </label>
  );
}
