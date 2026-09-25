#!/usr/bin/env python3
"""Index paper chunks with a local embedding model and answer from the top excerpts.

Embeddings and the small instruct model are separate from the chart sidecars.
Run this after FLUX has exited. If retrieval is empty, the script refuses.
"""

from __future__ import annotations

import hashlib
import json
import math
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STORE = ROOT / ".data" / "rag"
EMBED_MODEL = os.environ.get("PAPER_LENS_EMBED_MODEL", "nomic-embed-text")
ASK_MODEL = os.environ.get("PAPER_LENS_ASK_MODEL", "qwen2.5:1.5b")


def post_json(url: str, payload: dict, timeout: int = 120) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return json.loads(res.read().decode())


def embed_one(model: str, text: str) -> list[float]:
    try:
        payload = post_json("http://127.0.0.1:11434/api/embed", {"model": model, "input": text})
        vectors = payload.get("embeddings") or []
        if vectors and isinstance(vectors[0], list):
            return vectors[0]
    except (OSError, urllib.error.URLError, json.JSONDecodeError, TimeoutError, KeyError):
        pass
    payload = post_json("http://127.0.0.1:11434/api/embeddings", {"model": model, "prompt": text})
    vector = payload.get("embedding")
    if not isinstance(vector, list):
        raise RuntimeError("The embedding model did not return a vector.")
    return vector


def cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def digest(chunks: list[dict]) -> str:
    raw = json.dumps([{k: c.get(k) for k in ("id", "text")} for c in chunks], sort_keys=True)
    return hashlib.sha256(raw.encode()).hexdigest()


def index_chunks(paper_id: str, chunks: list[dict], model: str) -> dict:
    STORE.mkdir(parents=True, exist_ok=True)
    path = STORE / f"{paper_id}.json"
    signature = digest(chunks)
    if path.exists():
        existing = json.loads(path.read_text())
        if existing.get("signature") == signature and existing.get("model") == model:
            return {"ok": True, "cached": True, "count": len(existing.get("chunks") or [])}
    rows = []
    for chunk in chunks:
        text = (chunk.get("text") or "").strip()
        if not text or not chunk.get("id"):
            continue
        vector = embed_one(model, f"{chunk.get('section') or ''}\n{text}")
        rows.append(
            {
                "id": chunk["id"],
                "section": chunk.get("section") or "",
                "page": chunk.get("page"),
                "text": text[:2000],
                "vector": vector,
            }
        )
    if not rows:
        return {"ok": False, "error": "No excerpts to index.", "code": "empty"}
    path.write_text(json.dumps({"signature": signature, "model": model, "chunks": rows}))
    return {"ok": True, "cached": False, "count": len(rows)}


def retrieve(paper_id: str, question: str, model: str, chart: dict | None, top_k: int) -> list[dict]:
    path = STORE / f"{paper_id}.json"
    if not path.exists():
        return []
    stored = json.loads(path.read_text())
    rows = stored.get("chunks") or []
    if not rows:
        return []
    query = question
    if chart:
        labels = ", ".join(chart.get("extracted_text_nodes") or [])
        query = f"{question}\nChart: {chart.get('caption') or ''}\nNodes: {labels}"
    vector = embed_one(model, query)
    ranked = sorted(rows, key=lambda row: cosine(vector, row.get("vector") or []), reverse=True)
    chosen = []
    preferred = set((chart or {}).get("evidence_ids") or [])
    for row in ranked:
        if preferred and row["id"] in preferred:
            chosen.append(row)
    for row in ranked:
        if len(chosen) >= top_k:
            break
        if any(item["id"] == row["id"] for item in chosen):
            continue
        chosen.append(row)
    return chosen[:top_k]


def generate(model: str, question: str, rows: list[dict], chart: dict | None) -> dict:
    blocks = [f"[{row['id']}] {row.get('section') or ''}\n{row['text']}" for row in rows]
    chart_note = ""
    if chart:
        chart_note = (
            f"\nThe question is about a reconstruction titled {chart.get('title') or 'chart'}. "
            f"Caption: {chart.get('caption') or ''}. "
            f"Node labels: {', '.join(chart.get('extracted_text_nodes') or [])}.\n"
        )
    system = (
        "Answer only from the excerpts. If they do not contain the answer, say you do not have a retrieved excerpt for that. "
        "Do not add modules, numbers, or figure claims that are not in the excerpts. "
        'Return JSON: {"answer":"...","evidence_ids":["id"]} using only the excerpt ids shown.'
    )
    user = chart_note + "\n\n".join(blocks) + f"\n\nQuestion: {question}"
    payload = post_json(
        "http://127.0.0.1:11434/api/chat",
        {
            "model": model,
            "stream": False,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "format": "json",
            "options": {"temperature": 0.1},
        },
    )
    content = payload.get("message", {}).get("content") or ""
    start = content.find("{")
    end = content.rfind("}")
    parsed = json.loads(content[start : end + 1]) if start >= 0 else {"answer": content, "evidence_ids": []}
    allowed = {row["id"] for row in rows}
    evidence = [item for item in parsed.get("evidence_ids") or [] if item in allowed]
    if not evidence:
        evidence = [row["id"] for row in rows[:2]]
    answer = (parsed.get("answer") or "").strip()
    if not answer:
        raise RuntimeError("The answer model returned an empty reply.")
    return {"answer": answer, "evidence_ids": evidence}


def safe_id(value: str) -> str:
    cleaned = "".join(ch for ch in value if ch.isalnum() or ch in "._-")
    return cleaned[:80]


def main() -> None:
    request = json.load(sys.stdin)
    op = request.get("op")
    paper_id = safe_id(str(request.get("paper_id") or ""))
    embed_model = request.get("embed_model") or EMBED_MODEL
    ask_model = request.get("ask_model") or ASK_MODEL
    if not paper_id:
        json.dump({"ok": False, "error": "Missing paper id.", "code": "bad_request"}, sys.stdout)
        raise SystemExit(2)
    try:
        if op == "index":
            result = index_chunks(paper_id, request.get("chunks") or [], embed_model)
        elif op == "ask":
            question = (request.get("question") or "").strip()
            if not question:
                result = {"ok": False, "error": "Missing question.", "code": "bad_request"}
            else:
                rows = retrieve(paper_id, question, embed_model, request.get("chart"), int(request.get("top_k") or 4))
                if not rows:
                    result = {
                        "ok": False,
                        "error": "No retrieved excerpt for that question. Nothing was invented.",
                        "code": "empty_retrieval",
                    }
                else:
                    answered = generate(ask_model, question, rows, request.get("chart"))
                    result = {
                        "ok": True,
                        "content": answered["answer"],
                        "evidence_ids": answered["evidence_ids"],
                        "model": ask_model,
                        "embed_model": embed_model,
                    }
        else:
            result = {"ok": False, "error": "Unknown operation.", "code": "bad_request"}
    except Exception as exc:  # noqa: BLE001 — local model absence must be an honest refusal
        result = {
            "ok": False,
            "error": f"The local model did not answer. {exc}",
            "code": "model_unavailable",
        }
    json.dump(result, sys.stdout)
    sys.stdout.write("\n")
    if not result.get("ok"):
        raise SystemExit(2)


if __name__ == "__main__":
    main()
