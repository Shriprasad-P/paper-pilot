# Paper Lens design notes

No wireframe, Figma file, or `design*` asset was in the workspace. This layout follows the information architecture in the product brief.

## Tone

Light mode first. The canvas is warm paper (`oklch` hue ~85), type is Inter, and paper titles use Source Serif 4. One accent: a deep teal used for the primary button, the Ask Chart mark, and the active section. Status never depends on color alone — each pill has an icon and a word (Indexing, Ready, Partial, Failed, Paywalled).

Dark mode is optional from Settings. It does not change layout.

## Screens

### Library (`/`)

A short desk introduction, search, and a list of papers. Each row shows title (serif), authors, year, venue, source, equation count, chart count, and a status pill. The IEEE example is a paywalled row with no invented abstract.

### Ingest (`/ingest`)

- Large PDF dropzone, multi-file, non-PDFs rejected with a plain error.
- URL field with provider chips: arXiv, IEEE, Springer, Other. The chip follows the URL until the reader picks one.
- Sample links fill the field. They do not auto-submit.
- Each job shows Fetching → Parsing → Embedding → Extracting equations → Building charts → Ready. PDFs label the first step “Reading file”.
- IEEE and Springer stop on Fetching with “Paywalled — upload PDF instead” and a Retry action.
- BERT (`1810.04805`) finishes Partial, with “Couldn't parse equations on page 4” and a chart failure.
- Unknown hosts fail with “Couldn’t retrieve full text from this host. Upload the PDF instead.”
- A PDF upload reaches Ready and opens a workspace that **says the file was not parsed** and shows the bundled Vaswani et al. excerpts. It does not pretend the upload was read.

### Paper workspace (`/papers/[id]`)

Desktop: sticky paper header, left section nav, reading canvas, right Ask drawer (closed until Ask Chart or `/`).

Tablet and phone: section nav becomes a horizontal tab row. Ask becomes a bottom sheet with a dimmed backdrop. Esc closes it. `/` focuses Ask when the user is not already typing.

Header actions: Reprocess (returns the pill to Indexing, then restores the previous terminal status), Export (Markdown of the grounded notes), Share (disabled; “Sharing is not available yet”).

Views:

1. **Overview** — abstract in serif, Problem / Method / Result cards marked “AI-generated explanation”, thumbnail of the main workflow chart, and an Ask paper field.
2. **Walkthrough** — stepped sections. Order inside a section: plain explanation, then an analogy only if one exists (labeled as not a claim from the paper), then “Why this matters”, then “See in paper”. Simple / Standard / Deep hides the later layers. Math is KaTeX.
3. **Charts** — skeleton, then cards. Each card has the Ask Chart control at the top right. A note states the diagrams are AI reconstructions, not publisher figures. Regenerate replays the skeleton. Clicking a chart opens a lightbox and the drawer, prefilled with “Explain this chart in the context of the paper.”
4. **Equations** — sortable, filterable table. Columns: #, equation, name, plain description, location, Ask. Empty state: “No equations detected — run extract again or mark pages manually.”
5. **Sources** — excerpts collapsed by default. “See in paper” opens the matching excerpt.

Paywalled and failed papers do not render walkthrough text. The screen repeats the human error and links back to upload.

## Ask Chart

The mark is a speech bubble with three bars. The same `AskChartButton` is used on equation rows, chart cards, and the floating button. It is a 44px circle, keyboard focusable, with `aria-label="Ask about this"` (or a more specific label).

The drawer header shows a scope chip: `Equation (3)`, `Chart: Training loop`, or `Whole paper`. Threads are kept per scope for the browser session. Switching equations shows that equation’s thread, not the previous one.

Suggested prompts: What is this? · Why is it used here? · How does it connect to the method? · Explain like I’m new to this field. Chart scope leads with “Explain this chart in the context of the paper.”

Answers stream from the mock client, can be stopped, and attach an Evidence disclosure. If no excerpt is available, the reply says so and does not invent a passage.

## What the mock will not do

- It will not answer from outside the stored excerpts. Unrecognized questions fall back to the note already written for that scope, still with the same evidence ids.
- It will not fill in a paywalled paper.
- Uploaded PDFs are not parsed. The banner says which public paper the sample reading actually is.
