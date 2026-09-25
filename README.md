# Paper Lens

A reading desk for research papers. Upload a PDF or paste an arXiv, IEEE, or Springer link, then read a plain-language walkthrough, reconstructed charts, and an equation table. Ask Chart answers from retrieved excerpts of that paper only.

This repository is the interface and a mock retrieval index. It does not download or run model weights.

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

## Models to wire later

The settings screen records these ids. Nothing in the UI calls them yet.

| Role | Model id |
| --- | --- |
| Chat | `Qwen/Qwen3-0.6B` |
| Vision (figures and PDF pages) | `Qwen/Qwen3-VL-8B-Instruct` |
| Embeddings | `Qwen/Qwen3-Embedding-0.6B` |

The product note “Qwen3.6b” is mapped to the published **Qwen3-0.6B** chat checkpoint (0.6 billion parameters). There is no separate `Qwen3.6b` id in the public Qwen3 lineup. Figure reading should use **Qwen3-VL-8B-Instruct** when that path is connected.

Keys typed in Settings stay in `localStorage` under `paper-lens-settings`. They are not sent anywhere.

## API surface

UI code talks to `PaperLensClient` in `src/lib/api/client.ts`:

- `listPapers`
- `getPaper` / `getWalkthrough` / `getEquations` / `getCharts`
- `ingest`
- `reprocess`
- `ask` (scoped to the whole paper, one equation, or one chart; streams tokens)

The mock lives in `src/lib/paper-store.ts` and `src/lib/mock/`. Explanations are written against excerpt ids. If an answer has no excerpt, the client refuses instead of filling the gap.

Replace `createPaperLensClient` with a network implementation when the RAG worker exists. Keep the same types in `src/lib/api/types.ts`.

## Layout

See `DESIGN.md`. No wireframe was attached, so the layout follows the brief: library, ingest, paper workspace (overview, walkthrough, charts, equations, sources, ask drawer), and settings.
