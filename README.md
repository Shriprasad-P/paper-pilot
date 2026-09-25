# Paper Lens

A reading desk for research papers. Upload a PDF or paste an arXiv, IEEE, or Springer link, then read a plain-language walkthrough, reconstructed charts, and an equation table. Ask Chart answers from retrieved excerpts of that paper only.

This repository is a local reading desk for Apple Silicon. Mock mode uses stored excerpts and bundled diagrams. With mock mode off, a Mac runs Qwen3-VL, then FLUX, then a small local Ask model. Nothing here calls a cloud model.

## Run locally

```bash
npm install
npm run dev
```

The dev server in this environment is started on port **43123**. Locally, `npm run dev` uses Next.js’s default port unless you pass one:

```bash
npx next dev --turbopack -H 0.0.0.0 -p 43123
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123).

## What you can click through

The library starts with three items:

| Paper | What the demo does |
| --- | --- |
| Attention Is All You Need (`arXiv:1706.03762`) | Full walkthrough, seven equations, three Mermaid charts, Ask Chart |
| BERT (`arXiv:1810.04805`) | Walkthrough only. Equation parse and charts fail on purpose |
| Example IEEE link | Paywall. No abstract or explanation is invented |

On **Add paper**, try:

- `https://arxiv.org/abs/1706.03762`
- `https://arxiv.org/abs/1810.04805`
- any `ieeexplore.ieee.org` or Springer URL (paywall message)
- a PDF (processing finishes as Not parsed: the library and workspace say the file was not read and show the bundled Transformer sample)

`/` focuses Ask. Esc closes the drawer.

## Charts and Ask on a 24 GB M4 Pro

Mock mode on (the default) does not call a model. The Transformer charts are the bundled Mermaid reconstruction. Ask uses the stored notes.

Mock mode off, on Apple Silicon:

1. `scripts/vlm_diagram_spec.py` loads only Qwen3-VL, writes JSON, and exits.
2. Nodes whose labels are not in the cited excerpt are dropped. The FLUX prompt is rebuilt so every remaining label is inside double quotes.
3. `scripts/flux_render.py` loads only FLUX, writes a WebP under `public/generated/`, and exits.
4. If FLUX is missing or runs out of memory, the card shows Mermaid from that same JSON and says so.
5. If the vision model is missing, Regenerate keeps the last chart and toasts. It does not invent a diagram.
6. Ask indexes chunks with `nomic-embed-text`, then answers with `qwen3:4b` (already on this Mac) from the retrieved excerpts. Empty retrieval is a refusal. `qwen2.5:1.5b` still works if you set `PAPER_LENS_ASK_MODEL` to that id.

Peak target is under 18 GB so macOS keeps headroom on a 24 GB machine. The 8B vision model and FLUX are never loaded together. If 8B runs out of memory, the vision sidecar retries the 4B model and the footer records which one ran.

| Role | Id | Notes |
| --- | --- | --- |
| Vision, default | `mlx-community/Qwen3-VL-8B-Instruct-4bit` | About 6 GB. Settings can switch this. |
| Vision, low memory | `lmstudio-community/Qwen3-VL-4B-Instruct-MLX-4bit` | About 3 GB. Also the automatic fallback. |
| Render, default | `flux.1-schnell` | mflux name `schnell`, 4-bit, 4 steps. |
| Render, optional | `flux.2-klein` | Used only when that mflux config is installed. |
| Embeddings | `nomic-embed-text` | Ollama. After the chart sidecars exit. |
| Ask | `qwen3:4b` | Ollama. Already cached on the Mac this desk was aimed at. Answers only from retrieved chunks. |

```bash
pip install mlx-vlm mflux
ollama pull nomic-embed-text
ollama pull qwen3:4b
```

Download the MLX and FLUX weights into the Hugging Face cache before Regenerate. This repo does not download them.

```bash
PAPER_LENS_VLM_MODEL=mlx-community/Qwen3-VL-8B-Instruct-4bit
PAPER_LENS_VLM_FALLBACK=lmstudio-community/Qwen3-VL-4B-Instruct-MLX-4bit
PAPER_LENS_FLUX_MODEL=flux.1-schnell
PAPER_LENS_EMBED_MODEL=nomic-embed-text
PAPER_LENS_ASK_MODEL=qwen3:4b
PAPER_LENS_RAM_BUDGET_GB=18
```

Set `PAPER_LENS_FLUX_MODEL=flux.2-klein` when that checkpoint is installed. Partial, paywalled, failed, and Not parsed papers never start this pipeline.

On the Mac, from the repo root:

```bash
cp .env.example .env.local
bash scripts/setup_mac.sh
npm install
npx next dev --turbopack -H 0.0.0.0 -p 43123
```

`scripts/setup_mac.sh` creates `.venv`, installs `mlx-vlm`, downloads `mlx-community/Qwen3-VL-8B-Instruct-4bit`, runs one small `mflux-generate` so FLUX.1 schnell weights land in `~/.cache/huggingface/hub/`, and pulls `nomic-embed-text` plus `qwen3:4b`. The 4B vision model is the fallback and should already be in that cache. Next spawns `.venv/bin/python` when that file exists, or `PAPER_LENS_PYTHON` if you set it. `PAPER_LENS_MOCK=0` turns mock mode off on the first visit, before a choice is saved in the browser.

## Apple OCR

PDF text on a Mac does not go through Qwen-VL. With mock mode off and **Apple OCR for PDFs** on, a dropped PDF is rendered and read by Apple Vision (`scripts/apple_ocr.swift`, called from `scripts/apple_ocr.py`). Sources are labeled “Text from Apple OCR.” The paper stays Partial: equations are not recovered, and charts stay empty unless that text names a method, in which case Regenerate still does vision JSON then FLUX. There is no cloud OCR.

Mock mode on does not call OCR. A paywalled link with no PDF still has no invented abstract. On Linux or any non-Mac host, OCR refuses and the upload stays Not parsed, showing the bundled sample instead of made-up text.

The endpoint and API key in Settings stay disabled. Keys already in `localStorage` under `paper-lens-settings` are not sent.

## API surface

UI code talks to `PaperLensClient` in `src/lib/api/client.ts`:

- `listPapers`
- `getPaper` / `getWalkthrough` / `getEquations` / `getCharts`
- `ingest`
- `reprocess`
- `ask` (scoped to the whole paper, one equation, or one chart; streams tokens)
- `POST /api/charts` — Ready papers only; vision JSON, then FLUX, as separate processes
- `POST /api/index` — embed chunks for one paper
- `POST /api/ask` — answer from retrieved chunks, or refuse

The mock lives in `src/lib/paper-store.ts` and `src/lib/mock/`. Explanations are written against excerpt ids. If an answer has no excerpt, the client refuses instead of filling the gap.

Replace `createPaperLensClient` with a network implementation when the RAG worker exists. Keep the same types in `src/lib/api/types.ts`.

## Layout

See `DESIGN.md`. No wireframe was attached, so the layout follows the brief: library, ingest, paper workspace (overview, walkthrough, charts, equations, sources, ask drawer), and settings.
