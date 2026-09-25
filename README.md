# Paper Lens

A reading desk for research papers. Upload a PDF or paste an arXiv, IEEE, or Springer link, then read a plain-language walkthrough, reconstructed charts, and an equation table. Ask Chart answers from retrieved excerpts of that paper only.

This repository is the reading desk plus a local chart compiler. Ask, walkthroughs, and the sample library still use the stored excerpts. Methodology charts can be rebuilt on a Mac with MLX. Nothing here downloads weights for you, and chat embeddings are not called.

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

## Methodology charts (local MLX)

Ready papers show Mermaid reconstructions. The Transformer sample ships with a bundled spec grounded in its stored excerpts, labeled as a bundled reconstruction, not a live model call. **Regenerate** on a Ready paper calls `scripts/chart_spec.py` when mock mode is off. The script asks the model for JSON (nodes, edges, evidence ids), drops any label that is not in the cited excerpt, and the page draws Mermaid. It does not display a model-painted raster.

Partial, paywalled, failed, and Not parsed papers do not gain charts from this path.

### Pick 4B or 27B

Settings → Chart model, after turning **Mock mode** off:

| Choice | Id | Memory |
| --- | --- | --- |
| Default | `lmstudio-community/Qwen3-VL-4B-Instruct-MLX-4bit` | About 3 GB. Use this on a 24 GB M4 Pro. |
| Larger | `mlx-community/Qwen3.5-27B-4bit` | About 15 GB. Quit other large models first. A “Qwen 3.6” recollection maps to this Qwen3.5 family. |

Environment overrides, if you launch the dev server yourself:

```bash
PAPER_LENS_VLM_MODEL=lmstudio-community/Qwen3-VL-4B-Instruct-MLX-4bit
PAPER_LENS_VLM_MODEL_LARGE=mlx-community/Qwen3.5-27B-4bit
```

The picker is the id that Regenerate sends. The env vars document the same defaults; the route allow-lists only those two MLX ids.

On Apple Silicon, with the weights already in the Hugging Face cache:

```bash
pip install mlx-vlm
```

The sidecar loads one model per run and exits, and it asks Ollama to unload resident models first. If MLX fails (wrong OS, missing `mlx-vlm`, or the weights will not load), it tries Ollama `qwen2.5vl:7b`. If that also fails, the Charts tab keeps the last good diagram and toasts “Couldn't build charts…”. Do not point this at the incomplete `mlx-community/Qwen3-4B-4bit` snapshot or a tokenizer-only folder.

Chat (`Qwen/Qwen3-0.6B`), embeddings, the local endpoint, and the API key stay disabled in Settings. Ask still answers from the stored index.

Keys already in `localStorage` under `paper-lens-settings` are not sent.

## API surface

UI code talks to `PaperLensClient` in `src/lib/api/client.ts`:

- `listPapers`
- `getPaper` / `getWalkthrough` / `getEquations` / `getCharts`
- `ingest`
- `reprocess`
- `ask` (scoped to the whole paper, one equation, or one chart; streams tokens)
- `POST /api/charts` — Ready papers only; runs the chart sidecar

The mock lives in `src/lib/paper-store.ts` and `src/lib/mock/`. Explanations are written against excerpt ids. If an answer has no excerpt, the client refuses instead of filling the gap.

Replace `createPaperLensClient` with a network implementation when the RAG worker exists. Keep the same types in `src/lib/api/types.ts`.

## Layout

See `DESIGN.md`. No wireframe was attached, so the layout follows the brief: library, ingest, paper workspace (overview, walkthrough, charts, equations, sources, ask drawer), and settings.
