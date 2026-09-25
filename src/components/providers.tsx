"use client";

import { useEffect } from "react";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { SETTINGS_KEY } from "@/lib/charts/models";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    let parsed: { mockMode?: boolean; chartModel?: string; fluxModel?: string } = {};
    if (raw) {
      try {
        parsed = JSON.parse(raw) as typeof parsed;
      } catch {
        parsed = {};
      }
    }
    if (typeof parsed.mockMode === "boolean") return;
    void fetch("/api/config")
      .then((response) => response.json())
      .then((config: { mockMode?: boolean; chartModel?: string; fluxModel?: string }) => {
        window.localStorage.setItem(
          SETTINGS_KEY,
          JSON.stringify({
            ...parsed,
            mockMode: config.mockMode !== false,
            chartModel: parsed.chartModel ?? config.chartModel,
            fluxModel: parsed.fluxModel ?? config.fluxModel,
          }),
        );
      })
      .catch(() => undefined);
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <TooltipProvider delay={250}>
        {children}
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}
