"use client";

import katex from "katex";
import { cn } from "@/lib/utils";

const TOKEN = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g;

function render(tex: string, display: boolean) {
  return katex.renderToString(tex, {
    displayMode: display,
    throwOnError: false,
    strict: "ignore",
    trust: false,
  });
}

export function MathText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className={cn("space-y-3", className)}>
      {blocks.map((block, blockIndex) => (
        <p key={blockIndex} className="whitespace-pre-wrap">
          {block.split(TOKEN).map((part, index) => {
            if (!part) return null;
            if (part.startsWith("$$") && part.endsWith("$$")) {
              return (
                <span
                  key={index}
                  className="my-2 block overflow-x-auto"
                  dangerouslySetInnerHTML={{
                    __html: render(part.slice(2, -2).trim(), true),
                  }}
                />
              );
            }
            if (part.startsWith("$") && part.endsWith("$")) {
              return (
                <span
                  key={index}
                  dangerouslySetInnerHTML={{
                    __html: render(part.slice(1, -1).trim(), false),
                  }}
                />
              );
            }
            return <span key={index}>{part}</span>;
          })}
        </p>
      ))}
    </div>
  );
}

export function MathBlock({ latex, className }: { latex: string; className?: string }) {
  return (
    <div
      className={cn("overflow-x-auto", className)}
      dangerouslySetInnerHTML={{ __html: render(latex, true) }}
    />
  );
}
