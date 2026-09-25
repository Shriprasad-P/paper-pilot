"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STORAGE_KEY = "paper-lens-settings";

type Settings = {
  mode: "local" | "cloud";
  chatModel: string;
  visionModel: string;
  embeddingModel: string;
  endpoint: string;
};

const DEFAULTS: Settings = {
  mode: "local",
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
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<Settings> & { apiKey?: string };
        setSettings({ ...DEFAULTS, ...parsed, mode: parsed.mode === "cloud" ? "cloud" : "local" });
        setApiKey(parsed.apiKey ?? "");
      } catch {
        setSettings(DEFAULTS);
      }
    }
    setReady(true);
  }, []);

    return (
    <div className="mx-auto max-w-2xl px-4 py-10 md:px-6">
      <p className="text-xs font-medium tracking-wide text-primary uppercase">Settings</p>
      <h1 className="mt-1 font-serif text-4xl">Models</h1>
      <p className="mt-4 rounded-lg border border-amber-950 bg-amber-950 px-4 py-3 text-sm leading-6 font-medium text-amber-50">
        Mock mode is on. Models are not called. Answers come from the stored demo index.
      </p>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        The ids below are what a later worker should call. They are not connected. Endpoint and API key stay off until that wiring exists.
      </p>

      <div className="mt-6 flex items-center gap-3">
        <span className="text-sm font-medium">Mock mode</span>
        <button
          type="button"
          disabled
          aria-pressed="true"
          className="h-10 cursor-not-allowed rounded-full bg-foreground px-4 text-sm text-background"
        >
          On
        </button>
      </div>

      <fieldset className="mt-6 space-y-4" disabled={!ready}>
        <Field
          label="Chat model"
          hint="Planned id only. The brief’s “Qwen3.6b” maps to Qwen3-0.6B. Not called in mock mode."
          value={settings.chatModel}
          disabled
          onChange={(chatModel) => setSettings((current) => ({ ...current, chatModel }))}
        />
        <Field
          label="Vision model"
          hint="Planned id for figures and PDF pages. Not called."
          value={settings.visionModel}
          disabled
          onChange={(visionModel) => setSettings((current) => ({ ...current, visionModel }))}
        />
        <Field
          label="Embedding model"
          hint="Planned id for chunk retrieval. Not called."
          value={settings.embeddingModel}
          disabled
          onChange={(embeddingModel) => setSettings((current) => ({ ...current, embeddingModel }))}
        />
        <Field
          label="Local endpoint"
          hint="Disabled until a model server is wired."
          value={settings.endpoint}
          disabled
          onChange={(endpoint) => setSettings((current) => ({ ...current, endpoint }))}
        />
        <label className="block text-sm">
          <span className="font-medium">API key</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Disabled. Nothing is sent, and saving a key would not connect a model.
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
