"use client";

import { useEffect, useMemo, useState } from "react";
import type { EquationRow } from "@/lib/api/types";
import { AskChartButton } from "@/components/ask-chart-button";
import { MathBlock, MathText } from "@/components/math-text";
import { cn } from "@/lib/utils";

type SortKey = "number" | "name" | "section";

export function EquationTable({
  equations,
  warnings,
  onAsk,
  activeEquationId,
  onRetry,
  initialSection = "all",
  showCoach = false,
  onDismissCoach,
}: {
  equations: EquationRow[];
  warnings: string[];
  onAsk: (equation: EquationRow) => void;
  activeEquationId?: string | null;
  onRetry?: () => void;
  initialSection?: string;
  showCoach?: boolean;
  onDismissCoach?: () => void;
}) {
  const [section, setSection] = useState(initialSection);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("number");
  const [ascending, setAscending] = useState(true);

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  const sections = useMemo(() => {
    const exact = Array.from(new Set(equations.map((row) => row.section)));
    if (initialSection !== "all" && !exact.includes(initialSection)) {
      return [initialSection, ...exact];
    }
    return exact;
  }, [equations, initialSection]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = equations.filter((row) => {
      if (section !== "all" && row.section !== section && !row.section.startsWith(`${section}.`) && !row.section.startsWith(section)) {
        return false;
      }
      if (!needle) return true;
      return (
        row.name.toLowerCase().includes(needle) ||
        row.note.what.toLowerCase().includes(needle) ||
        row.latex.toLowerCase().includes(needle)
      );
    });
    const sorted = [...filtered].sort((a, b) => {
      const dir = ascending ? 1 : -1;
      if (sortKey === "number") return (a.number - b.number) * dir;
      if (sortKey === "name") return a.name.localeCompare(b.name) * dir;
      return a.section.localeCompare(b.section, undefined, { numeric: true }) * dir;
    });
    return sorted;
  }, [ascending, equations, query, section, sortKey]);

  function toggleSort(next: SortKey) {
    if (sortKey === next) setAscending((value) => !value);
    else {
      setSortKey(next);
      setAscending(true);
    }
  }

  if (equations.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card px-6 py-12 text-center">
        <p className="font-serif text-xl">No equations detected</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          No equations detected — run extract again or mark pages manually.
        </p>
        {warnings.length > 0 ? (
          <ul className="mt-4 space-y-1 text-sm text-amber-950">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-5 inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm text-primary-foreground"
          >
            Run extract again
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {warnings.map((warning) => (
        <p
          key={warning}
          className="rounded-lg border border-amber-700/20 bg-amber-700/10 px-3 py-2 text-sm text-amber-950"
        >
          {warning}
        </p>
      ))}
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="flex-1 text-sm">
          <span className="sr-only">Filter equations</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by name or description"
            className="h-10 w-full rounded-lg border bg-card px-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>
        <label className="text-sm">
          <span className="sr-only">Section</span>
          <select
            value={section}
            onChange={(event) => setSection(event.target.value)}
            className="h-10 rounded-lg border bg-card px-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="all">All sections</option>
            {sections.map((item) => (
              <option key={item} value={item}>
                Section {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="hidden overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 md:block">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-muted text-left text-xs tracking-wide text-muted-foreground uppercase">
            <tr>
              <SortHeader label="#" active={sortKey === "number"} ascending={ascending} onClick={() => toggleSort("number")} />
              <th className="px-3 py-3 font-medium">Equation</th>
              <SortHeader label="Name / symbol" active={sortKey === "name"} ascending={ascending} onClick={() => toggleSort("name")} />
              <th className="px-3 py-3 font-medium">Plain description</th>
              <SortHeader label="Location" active={sortKey === "section"} ascending={ascending} onClick={() => toggleSort("section")} />
              <th className="px-3 py-3 font-medium">Ask</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t align-top">
                <td className="px-3 py-4 font-mono text-xs">{row.number}</td>
                <td className="max-w-sm px-3 py-3">
                  <MathBlock latex={row.latex} />
                </td>
                <td className="px-3 py-4 font-medium">{row.name}</td>
                <td className="max-w-sm px-3 py-4 text-muted-foreground">
                  <Description
                    id={row.id}
                    text={row.note.what}
                    expanded={Boolean(expanded[row.id])}
                    onToggle={() =>
                      setExpanded((current) => ({ ...current, [row.id]: !current[row.id] }))
                    }
                  />
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-muted-foreground">
                  §{row.section}
                  {row.page != null ? ` · p. ${row.page}` : ""}
                </td>
                <td className="px-3 py-3">
                  <AskWithCoach
                    show={showCoach && row.number === 1}
                    onDismiss={onDismissCoach}
                  >
                    <AskChartButton
                      onClick={() => onAsk(row)}
                      pressed={activeEquationId === row.id}
                      label={`Ask about equation ${row.number}`}
                      className={showCoach && row.number === 1 ? "animate-pulse ring-4 ring-amber-600 ring-offset-2" : undefined}
                    />
                  </AskWithCoach>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No equations match that filter.
          </p>
        ) : null}
      </div>

      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <article key={row.id} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                #{row.number} · §{row.section}
                {row.page != null ? ` · p. ${row.page}` : ""}
              </p>
              <AskWithCoach show={showCoach && row.number === 1} onDismiss={onDismissCoach}>
                <AskChartButton
                  onClick={() => onAsk(row)}
                  pressed={activeEquationId === row.id}
                  label={`Ask about equation ${row.number}`}
                  className={showCoach && row.number === 1 ? "animate-pulse ring-4 ring-amber-600 ring-offset-2" : undefined}
                />
              </AskWithCoach>
            </div>
            <h3 className="mt-1 font-medium">{row.name}</h3>
            <div className="mt-2 overflow-x-auto rounded-lg bg-muted/40 px-2 py-1">
              <MathBlock latex={row.latex} />
            </div>
            <Description
              id={row.id}
              text={row.note.what}
              expanded={Boolean(expanded[row.id])}
              onToggle={() =>
                setExpanded((current) => ({ ...current, [row.id]: !current[row.id] }))
              }
            />
          </article>
        ))}
        {rows.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">No equations match that filter.</p>
        ) : null}
      </div>
    </div>
  );
}

function Description({
  text,
  expanded,
  onToggle,
}: {
  id: string;
  text: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const long = text.length > 180;
  return (
    <div>
      <div className={expanded || !long ? undefined : "line-clamp-3"}>
        <MathText text={text} className="text-sm leading-6" />
      </div>
      {long ? (
        <button type="button" className="mt-1 text-xs text-primary underline-offset-2 hover:underline" onClick={onToggle}>
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}
    </div>
  );
}

function AskWithCoach({
  show,
  onDismiss,
  children,
}: {
  show: boolean;
  onDismiss?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      {children}
      {show ? (
        <div className="absolute top-12 right-0 z-20 w-52 rounded-lg bg-foreground px-3 py-2 text-left text-xs leading-5 text-background shadow-lg">
          <p>Click Ask Chart on any equation.</p>
          <button type="button" className="mt-1 underline" onClick={onDismiss}>
            Dismiss
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SortHeader({
  label,
  active,
  ascending,
  onClick,
}: {
  label: string;
  active: boolean;
  ascending: boolean;
  onClick: () => void;
}) {
  return (
    <th className="px-3 py-3 font-medium" aria-sort={active ? (ascending ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={onClick}
        className={cn("inline-flex items-center gap-1 uppercase", active && "text-foreground")}
      >
        {label}
        <span aria-hidden>{active ? (ascending ? "↑" : "↓") : ""}</span>
      </button>
    </th>
  );
}
