# Paper Lens UX review

Audit only. No product UI was changed. Preview: http://127.0.0.1:43123 (desktop 1440×900 and phone 390×844). Screenshots are in `artifacts/screenshots/`.

Walked: library, ingest (PDF + IEEE + Springer), Transformer overview / walkthrough / charts / equations / Ask Chart, `/` and Esc, BERT partial states, IEEE paywall workspace, Settings model stubs, and a PDF upload through to its banner.

## What works

- The desk reads as one product. Warm paper background, serif titles, teal accent, and status pills that use an icon plus a word (Ready, Partial, Paywalled).
- Library rows carry title, authors, year, venue, source, equation count, and chart count. The IEEE row has no invented abstract.
- Ingest rejects the idea of a paywalled full text in plain language: “Paywalled — upload PDF instead,” with Retry. IEEE and Springer both hit that sentence. A PDF named `sample-note.pdf` reaches Ready and the workspace says the file was not parsed and that the reading is Vaswani et al. 2017.
- Transformer overview shows the abstract, Problem / Method / Result, and a workflow thumbnail. Walkthrough math is KaTeX (no raw `\frac` in the reading view). Simple / Standard / Deep changes how much of a section is shown. “See in paper” jumps to Sources and opens the matching excerpt.
- Equations table has number, rendered formula, name, description, location, and a 44×44 Ask control per row. Ask Chart opens with the chip `Equation (1)`. “What is this?” streams an answer and an open Evidence block with the section and page.
- `/` focuses `#ask-input` and sets the chip to `Whole paper`. Esc closes the drawer first.
- BERT shows a partial banner, “No equations detected — run extract again…”, “Couldn't parse equations on page 4,” and “No charts yet” with the chart error. It does not draw a fake diagram.
- The IEEE workspace repeats the paywall and “No walkthrough, equations, or charts are shown, because no text was retrieved.”
- Settings shows Local mode and the stub ids `Qwen/Qwen3-0.6B`, `Qwen/Qwen3-VL-8B-Instruct`, and `Qwen/Qwen3-Embedding-0.6B`, and says nothing is sent.
- Muted 12px and 14px text measured about 7.9:1 against the page background. Ask buttons meet the 44px target.

## P0

None. Nothing crashed, and every route in the walk returned a readable screen.

## P1

### 1. The overview ask field collapses on a phone

Observation: at 390px the “Ask about this paper” input measured 19px tall (top 257, bottom 276). The “Ask paper” button under it is a normal 44px. The field uses `h-11` and `flex-1` inside a column, so the basis of 0 shrinks the control.

Impact: the main ask action on the overview is a thin line. It looks broken and is hard to tap even though a floating Ask button exists.

Fix: drop `flex-1` on that input, or set `flex-none` and keep `h-11`. Check the row layout at `sm` still aligns with the button.

### 2. An unrelated question still looks like an answer

Observation: “Who won the world cup?” on Whole paper streamed “That wording is not a separate excerpt…” and immediately opened Evidence with five Transformer passages, including the abstract.

Impact: the refusal is easy to miss under the label “AI-generated explanation,” and the open quotes look like support. That fights the rule that the product must not invent or imply facts.

Fix: if the question is not one of the prepared intents, show a short refusal and leave Evidence collapsed, or label it “Nearest stored excerpt, not an answer to that question.” Do not use the same header as a real explanation.

### 3. Generated charts are hard to read

Observation: after the charts tab settled, the workflow SVG was 464×66. The encoder-layer SVG was 168×570 inside a 464px-wide card. Nodes are legible only as a thin strip or a narrow column. Captions are clearer than the drawings.

Impact: the Charts gallery and the overview thumbnail do not carry the architecture. Readers will trust the caption and skip the figure.

Fix: give each diagram a minimum height (around 220px) and let the SVG scale to the card width. Prefer a left-to-right workflow that stays wide enough to read the node labels.

### 4. Lightbox and Ask Chart open on top of each other

Observation: clicking the workflow chart opened the dialog and the drawer together. The drawer is 400px on the right; the dialog is centered on the viewport. The prefilled sentence is there, and so is the chart, but they cover one another. Esc closes the drawer and leaves the dialog.

Impact: the two actions specified in DESIGN.md fight. A reader cannot look at the chart and the question at the same time.

Fix: keep the prefilled draft, but either inset the dialog to the left of the drawer or open Ask only from the dialog’s “Ask about this chart” button. One surface should stay fully visible.

### 5. An uploaded PDF borrows the Transformer title, then vanishes on reload

Observation: after `sample-note.pdf` finished, the header was still “Attention Is All You Need,” with `sample-note.pdf` in the subtitle. The amber banner is accurate. A full reload of that URL then said “That paper isn’t in the library.”

Impact: the banner is doing all the honesty work. The title and a later library row still look like the file was the Transformer paper. Refresh makes a successful ingest look like a bug.

Fix: title the library card and header with the filename until a parser exists, and keep the Transformer name inside the banner. Persist session papers, or say on the job row that the upload lasts until reload.

## P2

### 6. A failed fetch still looks like a pipeline that finished

Observation: the IEEE job shows Paywalled, the sentence “Paywalled — upload PDF instead,” and Retry. The same row still prints Parsing, Embedding, Extracting equations, Building charts, and Ready, and it still offers Open paper. Springer matches. The PDF job’s stages are the same visual language, so failure and success are easy to mix up.

Impact: “Ready” on a paywalled row implies the paper was indexed.

Fix: stop the tracker on the failed stage. Hide later stages. If Open paper stays, name it “Open the paywall note.”

### 7. The charts skeleton is not on the path readers use

Observation: `09_charts_skeleton.png` and `10_charts.png` are the same frame. The skeleton runs for about 700ms after the paper route loads, while the reader is still on Overview. Opening Charts later shows diagrams immediately. Regenerate is the only obvious replay.

Impact: DESIGN.md’s “loading skeleton while generating” is not what the Charts tab does.

Fix: show the skeleton when Charts is opened the first time and whenever Regenerate is pressed. Keep the note that the drawings are reconstructions.

### 8. Empty-state copy promises a control that is not there

Observation: BERT’s equation empty state says “run extract again or mark pages manually.” “Run extract again” starts reprocess. Nothing marks a page.

Impact: the second instruction is a dead end.

Fix: remove “mark pages manually” until that control exists, or add a page field that stores a note without pretending an equation was parsed.

### 9. Phone chrome is tight, and the close control is ambiguous

Observation: at 390px, “Add paper” in the top bar measured 68×52 and sits on two lines, while Library and Settings stay 32px tall. The ask sheet itself is usable (about 658px tall, full width). Its dimmed backdrop is a button named “Close ask panel,” the same name as the X, and the backdrop’s box is the full viewport.

Impact: the header looks unfinished. Screen-reader users get two identical close buttons, one of which is the page.

Fix: shorten the nav to icons or a menu under 400px. Name the backdrop “Dismiss ask” and leave “Close ask panel” on the X only.

## Ask Chart

- The mark is consistent: equation rows, chart cards, and the floating button. Hit target is 44×44. Names are specific (`Ask about equation 1`, `Ask about Translation workflow`, `Ask about this paper`).
- Scope chips match the brief: `Equation (1)`, `Chart: Translation workflow`, `Whole paper`. Switching with `/` showed a new Whole paper thread, not the equation thread.
- Suggested prompts match DESIGN.md, including the chart sentence. They sit in a horizontal scroller, so “Explain like I’m new to this field.” is partly off-screen until you scroll.
- A matched question showed the explanation, then Evidence with quotes and “3.2.1 Scaled Dot-Product Attention · p. 4”. Evidence is expanded by default, which is good for the matched case and too strong for the unmatched case in P1.2.
- Streaming is visible (“writing”). Stop is in the composer while a reply is in flight. Enter sends. The mobile sheet stacks the composer under the thread; the hint “Enter sends · Shift+Enter newline · Esc closes” competes with the Send button for width.

## Accessibility

- Status does not rely on color alone.
- `/` and Esc behave as specified when focus is not already in a field.
- Ask controls are keyboard-focusable buttons with accessible names.
- Measured text contrast for muted labels and the serif title clears WCAG AA on the page background.
- Gaps: Simple / Standard / Deep are `role="radio"` inside a fieldset, not a radiogroup, so arrow-key radio behavior is missing. The ask backdrop and the X share one name. Share is disabled with the reason only in a tooltip. The collapsed 19px ask field fails a practical target size even though the floating button does not.

## Gaps versus DESIGN.md

| DESIGN.md | What the walk showed |
| --- | --- |
| Charts skeleton while generating | Skeleton is tied to route load, not to opening Charts. Regenerate is the real loading state. |
| Click chart → lightbox and prefilled Ask | Both open. They overlap. |
| “Mark pages manually” | Copy only. |
| PDF upload does not pretend to parse | Banner is right. The title is still the Transformer paper. |
| Paywall stops at fetch and does not invent the article | Met. The stage list still shows later steps and Ready. |
| Threads per scope, `/`, Esc | Met in this session. |
| Share disabled | Met. |
| Dark mode optional | Present in Settings. Not exercised in this pass. |
| 44px Ask target, evidence on answers | Met for the matched equation question. |

## Polish sprint

1. Fix the overview ask field so it stays 44px tall on a phone.
2. Make unmatched Ask replies a refusal, with Evidence collapsed and labeled as the nearest excerpt.
3. Give chart SVGs a readable minimum height and use the full card width.
4. Stop laying the lightbox and the drawer on the same pixels.
5. Name uploads by filename, and either persist them or warn that reload clears them.
6. End a failed ingest on the failed stage; do not show Ready or a normal Open paper action.
7. Show the chart skeleton on first open and on Regenerate.
8. Tighten the phone header, give the backdrop its own name, and delete or build “mark pages manually.”
