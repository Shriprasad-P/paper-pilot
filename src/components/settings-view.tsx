"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ASK_MODEL_OPTIONS,
  DEFAULT_CHART_SETTINGS,
  EMBED_MODEL,
  FLUX_MODEL_OPTIONS,
  SETTINGS_KEY,
  isAskModelId,
  isFluxModelId,
  type AskModelId,
  type FluxModelId,
} from "@/lib/charts/models";

type Settings = {
  mode: "local" | "cloud";
  mockMode: boolean;
  appleOcr: boolean;
  askModel: AskModelId;
  fluxModel: FluxModelId;
  chatModel: string;
  visionModel: string;
  embeddingModel: string;
  endpoint: string;
};

const DEFAULTS: Settings = {
  mode: "local",
  mockMode: DEFAULT_CHART_SETTINGS.mockMode,
  appleOcr: DEFAULT_CHART_SETTINGS.appleOcr,
  askModel: DEFAULT_CHART_SETTINGS.askModel,
  fluxModel: DEFAULT_CHART_SETTINGS.fluxModel,
  chatModel: "llama3.2:3b",
  visionModel: "Not used",
  embeddingModel: EMBED_MODEL,
  endpoint: "http://127.0.0.1:11434",
};

export function SettingsView() {
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [apiKey, setApiKey] = useState("");
  const [ready, setReady] = useState(false);
  const [ocrOnThisMachine, setOcrOnThisMachine] = useState<boolean | null>(null);

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
          askModel:
            typeof parsed.askModel === "string" && isAskModelId(parsed.askModel)
              ? parsed.askModel
              : DEFAULTS.askModel,
          fluxModel:
            typeof parsed.fluxModel === "string" && isFluxModelId(parsed.fluxModel)
              ? parsed.fluxModel
              : DEFAULTS.fluxModel,
          appleOcr: parsed.appleOcr !== false,
        });
        setApiKey(parsed.apiKey ?? "");
      } catch {
        setSettings(DEFAULTS);
      }
    }
    setReady(true);
    void fetch("/api/config")
      .then((response) => response.json())
      .then((config: { appleOcrAvailable?: boolean }) => {
        setOcrOnThisMachine(config.appleOcrAvailable === true);
      })
      .catch(() => setOcrOnThisMachine(false));
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
          ? "Mock mode is on. Models are not called. Charts stay the bundled reconstruction, and Ask uses the stored notes."
          : "Mock mode is off. Regenerate builds a chart prompt from method text, unloads Ollama, then runs FLUX. Ask retrieves excerpts with nomic-embed-text and answers with the local model selected below."}
      </p>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        One heavy model at a time. Budget is under 18 GB on a 24 GB Mac. Chat is unloaded before FLUX, and FLUX exits before Ask. If FLUX cannot render, the card shows Mermaid from the same method labels. Cloud endpoint and API key stay off.
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

      <div className="mt-4 flex items-center gap-3">
        <span className="text-sm font-medium">Apple OCR for PDFs</span>
        <button
          type="button"
          aria-pressed={settings.appleOcr}
          disabled={!ready || settings.mockMode}
          onClick={() => persist({ ...settings, appleOcr: !settings.appleOcr })}
          className="h-10 rounded-full bg-foreground px-4 text-sm text-background disabled:opacity-60"
        >
          {settings.appleOcr ? "On" : "Off"}
        </button>
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        {ocrOnThisMachine
          ? "With mock mode off, a dropped PDF is read with Apple Vision. Sources are labeled “Text from Apple OCR.”"
          : "This machine is not a Mac, so OCR is skipped and the file stays Not parsed."}{" "}
        Page text is not read by a vision-language model.
      </p>

      <label className="mt-6 block text-sm">
        <span className="font-medium">Ask model</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          Used only when mock mode is off, after FLUX has exited. llama3.2:3b is the default. Gemma is optional and is not required.
        </span>
        <select
          value={settings.askModel}
          disabled={!ready || settings.mockMode}
          onChange={(event) => {
            const askModel = event.target.value;
            if (isAskModelId(askModel)) persist({ ...settings, askModel });
          }}
          className="mt-1 h-11 w-full rounded-lg border bg-card px-3 font-mono text-xs disabled:opacity-60"
        >
          {ASK_MODEL_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="mt-1 block font-mono text-[11px] leading-5 text-muted-foreground">
          {settings.askModel}
        </span>
        <span className="mt-1 block text-xs text-muted-foreground">
          {ASK_MODEL_OPTIONS.find((option) => option.id === settings.askModel)?.note}
        </span>
      </label>

      <label className="mt-6 block text-sm">
        <span className="font-medium">FLUX model</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          Renders the diagram after Ollama is unloaded. Schnell is the default. Klein is used only when that checkpoint is already installed.
        </span>
        <select
          value={settings.fluxModel}
          disabled={!ready || settings.mockMode}
          onChange={(event) => {
            const fluxModel = event.target.value;
            if (isFluxModelId(fluxModel)) persist({ ...settings, fluxModel });
          }}
          className="mt-1 h-11 w-full rounded-lg border bg-card px-3 font-mono text-xs disabled:opacity-60"
        >
          {FLUX_MODEL_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-muted-foreground">
          {FLUX_MODEL_OPTIONS.find((option) => option.id === settings.fluxModel)?.note} Retrieval uses{" "}
          <span className="font-mono">{EMBED_MODEL}</span> and answers use{" "}
          <span className="font-mono">{settings.askModel}</span> after FLUX exits.
        </span>
      </label>

      <fieldset className="mt-6 space-y-4" disabled={!ready}>
        <Field
          label="Chat model"
          hint="Not sent. Ask uses the Ollama id selected above when mock mode is off."
          value={settings.chatModel}
          disabled
          onChange={(chatModel) => setSettings((current) => ({ ...current, chatModel }))}
        />
        <Field
          label="Vision model"
          hint="Not called. Charts are a FLUX image from method text, or Mermaid if FLUX cannot render."
          value={settings.visionModel}
          disabled
          onChange={(visionModel) => setSettings((current) => ({ ...current, visionModel }))}
        />
        <Field
          label="Embedding model"
          hint="Not this id. Retrieval uses nomic-embed-text when mock mode is off."
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
      <p className="mt-6 text-xs text-muted-foreground">Built with Llama.</p>
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
