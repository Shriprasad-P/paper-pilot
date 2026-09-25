"use client";

import { useEffect, useId, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function MermaidFigure({
  source,
  className,
}: {
  source: string;
  className?: string;
}) {
  const reactId = useId().replace(/:/g, "");
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSvg(null);
    setError(null);
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          fontFamily: "Inter, ui-sans-serif, sans-serif",
          themeVariables: {
            background: "transparent",
            primaryColor: "#e6f1f3",
            primaryTextColor: "#1c1915",
            primaryBorderColor: "#1b4f5c",
            lineColor: "#1b4f5c",
            secondaryColor: "#f4f0e6",
            tertiaryColor: "#f7f4ee",
            fontSize: "14px",
          },
        });
        const { svg: markup } = await mermaid.render(`pl-${reactId}`, source);
        if (!cancelled) setSvg(markup);
      } catch {
        if (!cancelled) setError("Couldn’t draw this diagram.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reactId, source]);

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }
  if (!svg) {
    return <Skeleton className={className ?? "h-48 w-full"} />;
  }
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
