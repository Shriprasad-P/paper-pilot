# Paper Lens design notes

No wireframe, Figma file, or `design*` asset was in the workspace. This layout follows the information architecture in the product brief.

## Tone

Light mode first. The canvas is warm paper (`oklch` hue ~85), type is Inter, and paper titles use Source Serif 4. One accent: a deep teal used for the primary button, the Ask Chart mark, and the active section. Status never depends on color alone — each pill has an icon and a word (Indexing, Ready, Partial, Failed, Paywalled).

Dark mode is optional from Settings. It does not change layout.

## Screens

### Library (`/`)

A short desk introduction, search, and a list of papers. Each row shows title (serif), authors, year, venue, source, equation count, chart count, and a status pill. The IEEE example is a paywalled row with no invented abstract.

Partial rows keep the Partial pill and add a secondary line that matches the workspace: “Text ready · equations failed · charts failed.” The pill tooltip says which surfaces work.

Uploaded PDFs use the status **Not parsed** (never Ready). The row title is the filename. The secondary line names the bundled sample (Attention Is All You Need, Vaswani et al., 2017) and says the file was not read.

### Ingest (`/ingest`)

- Large PDF dropzone, multi-file, non-PDFs rejected with a plain error.
- URL field with provider chips: arXiv, IEEE, Springer, Other. The chip follows the URL until the reader picks one.
- Sample links fill the field. They do not auto-submit.
- Each job shows Fetching → Parsing → Embedding → Extracting equations → Building charts → Ready. PDFs label the first step “Reading file”.
- IEEE and Springer stop on Fetching with “Paywalled — upload PDF instead” and a Retry action.
- BERT (`1810.04805`) finishes Partial, with “Couldn't parse equations on page 4” and a chart failure.
- Unknown hosts fail with “Couldn’t retrieve full text from this host. Upload the PDF instead.”
- A PDF upload finishes in the **Not parsed** state. The job pill uses that same status. The workspace shows the bundled Vaswani et al. excerpts and says so. It does not pretend the file was read.

### Paper workspace (`/papers/[id]`)

Desktop: sticky paper header, left section nav, reading canvas, right Ask drawer (closed until Ask Chart or `/`).

Tablet and phone: section nav becomes a horizontal tab row. Ask becomes a bottom sheet with a dimmed backdrop. Esc closes it. `/` focuses Ask when the user is not already typing.

Header actions: Reprocess (returns the pill to Indexing, then restores the previous terminal status), Export (Markdown of the grounded notes), Copy local link (copies this paper’s URL and toasts success). There is no disabled Share control.

Not parsed workspaces show a sticky, high-contrast banner on Overview, Walkthrough, and Equations: the reading is the bundled sample, Attention Is All You Need (Vaswani et al., 2017), not the uploaded file. Ask stays available so the demo path still works. Every answer in that workspace is prefixed with “Answering from sample paper Attention Is All You Need, not your upload.”

Views:

1. **Overview** — abstract in serif, Problem / Method / Result cards marked “AI-generated explanation”, thumbnail of the main workflow chart, and an Ask paper field.
2. **Walkthrough** — stepped sections. Order inside a section: plain explanation, then an analogy only if one exists (labeled as not a claim from the paper), then “Why this matters”, then “See in paper”. Simple / Standard / Deep hides the later layers. Math is KaTeX.
3. **Charts** — skeleton, then one column of Mermaid cards (top-down, teal nodes, short labels). Every card says “AI reconstruction from the paper — not a publisher figure.” The footer names the source: the bundled sample, or the local MLX (or Ollama fallback) model id and elapsed time. Ask Chart stays at the top right. Regenerate calls the local compiler when mock mode is off and the paper is Ready; otherwise it toasts and keeps the current charts. A failed compile keeps the last good chart, or the empty “Couldn't build charts…” state when there was none. Partial, paywalled, and Not parsed papers do not gain invented charts. Clicking a chart opens a lightbox only. Ask Chart in the lightbox chrome closes the lightbox and opens the drawer, prefilled with “Explain this chart in the context of the paper.” Esc closes the lightbox first, then the drawer.
4. **Equations** — sortable, filterable table with a sticky header. Columns: #, equation, name, plain description (truncated, with Show more), location, Ask. Ask Chart stays in the row, not in a menu. Opening Equations from a walkthrough section filters to that section’s prefix; opening it from anywhere else starts at All. Empty state: “No equations detected — run extract again or mark pages manually.”
5. **Sources** — excerpts collapsed by default. “See in paper” and “Show in Sources” on an evidence quote open the matching excerpt. A missing id toasts and does not invent text.

Paywalled and failed papers do not render walkthrough text. The screen repeats “Paywalled — upload PDF instead” when that is the error, and includes a PDF dropzone on the paper itself (“Replace this link with a PDF.”). The file is still not parsed.

On the first visit to a full Ready paper, a one-line coach says “Click Ask Chart on any equation.” The first equation’s Ask Chart control pulses. Dismiss writes `paper-lens-ask-coach-dismissed` and the coach does not return. It is not a modal.

## Ask Chart

The mark is a speech bubble with three bars. The same `AskChartButton` is used on equation rows, chart cards, and the floating button. It is a 44px circle, keyboard focusable, with `aria-label="Ask about this"` (or a more specific label).

The drawer header shows a scope chip: `Equation (3)`, `Chart: Training loop`, or `Whole paper`. Threads are kept per scope for the browser session. Switching equations shows that equation’s thread, not the previous one.

Suggested prompts: What is this? · Why is it used here? · How does it connect to the method? · Explain like I’m new to this field. Chart scope leads with “Explain this chart in the context of the paper.”

Answers stream from the mock client, can be stopped, and attach an Evidence disclosure. “Show in Sources” jumps to that excerpt. If no excerpt is available, the reply says so and does not invent a passage.

Settings shows a Mock mode banner. Mock mode on means models are not called; Ready-paper charts stay the bundled reconstruction. Turning mock mode off enables the chart-model picker (`Qwen3-VL-4B` MLX by default, or `Qwen3.5-27B` MLX). Chat, embeddings, the endpoint, and the API key stay disabled. A saved model id does not mean a cloud model is connected.

## What the mock will not do

- It will not answer from outside the stored excerpts. Unrecognized questions fall back to the note already written for that scope, still with the same evidence ids.
- It will not fill in a paywalled paper.
- Uploaded PDFs are not parsed. Status, library line, sticky banners, and Ask prefixes all use **Not parsed** and name the bundled sample.
- Charts are diagram specs rendered as Mermaid, not rasters. Node labels have to sit in a retrieved excerpt. The compiler does not invent a module the excerpts do not name.
