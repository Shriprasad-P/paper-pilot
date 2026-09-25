"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
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

  function save() {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...settings, apiKey }),
    );
    toast.success("Saved in this browser. Nothing was sent to a model.");
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 md:px-6">
      <p className="text-xs font-medium tracking-wide text-primary uppercase">Settings</p>
      <h1 className="mt-1 font-serif text-4xl">Models</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        This build reads a stored demo index. The fields below are the model ids a later worker should call. Keys stay in local storage and are not transmitted.
      </p>

      <fieldset className="mt-8 space-y-3" disabled={!ready}>
        <legend className="text-sm font-medium">Where answers run</legend>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSettings((current) => ({ ...current, mode: "local" }))}
            className={`h-10 rounded-full px-4 text-sm ${settings.mode === "local" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
            aria-pressed={settings.mode === "local"}
          >
            Local
          </button>
          <button
            type="button"
            onClick={() => setSettings((current) => ({ ...current, mode: "cloud" }))}
            className={`h-10 rounded-full px-4 text-sm ${settings.mode === "cloud" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
            aria-pressed={settings.mode === "cloud"}
          >
            Cloud
          </button>
        </div>
        {settings.mode === "cloud" ? (
          <p className="text-sm text-amber-950">
            Cloud calls are not connected. Answers still come from the demo index on this machine.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Local mode expects a Qwen3 server at the endpoint below. Until that process is running, the UI keeps using mock retrieval.
          </p>
        )}
      </fieldset>

      <div className="mt-6 space-y-4">
        <Field
          label="Chat model"
          hint="The brief’s “Qwen3.6b” maps to the published Qwen3-0.6B checkpoint."
          value={settings.chatModel}
          onChange={(chatModel) => setSettings((current) => ({ ...current, chatModel }))}
        />
        <Field
          label="Vision model"
          hint="Used later to read figures and PDF pages."
          value={settings.visionModel}
          onChange={(visionModel) => setSettings((current) => ({ ...current, visionModel }))}
        />
        <Field
          label="Embedding model"
          hint="Chunk retrieval for the RAG index."
          value={settings.embeddingModel}
          onChange={(embeddingModel) => setSettings((current) => ({ ...current, embeddingModel }))}
        />
        <Field
          label="Local endpoint"
          value={settings.endpoint}
          onChange={(endpoint) => setSettings((current) => ({ ...current, endpoint }))}
        />
        <label className="block text-sm">
          <span className="font-medium">API key</span>
          <Input
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="Optional, stored only in this browser"
            className="mt-1 h-11"
          />
        </label>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Button className="h-11" onClick={save}>
          Save settings
        </Button>
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
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      {hint ? <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span> : null}
      <Input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-11 font-mono text-xs" />
    </label>
  );
}
