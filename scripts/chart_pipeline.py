#!/usr/bin/env python3
"""Build one methodology chart from method excerpts, then render it with FLUX.

No vision-language model is loaded. Ollama chat is asked to unload before mflux
starts. FLUX runs in its own process and exits before this script returns, so Ask
can load afterward. Peak target is under PAPER_LENS_RAM_BUDGET_GB (default 18).

If the excerpts do not name a method, nothing is drawn. If FLUX cannot render,
the same grounded nodes come back as Mermaid.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from diagram_ground import ground

ROOT = Path(__file__).resolve().parent
FLUX = ROOT / "flux_render.py"
PUBLIC = ROOT.parent / "public" / "generated"

METHOD = re.compile(
    r"model|architect|encoder|decoder|attention|embed|position|train|optim|regular|feed-forward|method|figure",
    re.I,
)

# Longer phrases first so "encoder stack" wins over "encoder".
PHRASES = (
    ("multi-head attention", "model"),
    ("scaled dot-product", "model"),
    ("positional encodings", "input"),
    ("positional encoding", "input"),
    ("feed-forward", "model"),
    ("encoder stack", "model"),
    ("decoder stack", "model"),
    ("input embeddings", "input"),
    ("output embeddings", "output"),
    ("self-attention", "model"),
    ("layer norm", "process"),
    ("encoder", "model"),
    ("decoder", "model"),
    ("attention", "model"),
    ("embeddings", "input"),
    ("embedding", "input"),
    ("softmax", "process"),
    ("adam", "process"),
)

# ponytail: comma lists and Title Case runs only. A parser belongs here when a method is one long sentence with neither.
_STOP = {
    "the", "and", "for", "with", "that", "this", "from", "were", "was", "are",
    "which", "used", "using", "other", "like", "such", "taken", "into", "over",
    "between", "during", "after", "before", "their", "these", "those", "than", "of",
}


def unload_ollama() -> None:
    """Drop resident Ollama models before FLUX. Missing Ollama is fine."""
    try:
        with urllib.request.urlopen("http://127.0.0.1:11434/api/ps", timeout=0.4) as res:
            payload = json.loads(res.read().decode())
    except (OSError, urllib.error.URLError, json.JSONDecodeError, TimeoutError):
        return
    for item in payload.get("models") or []:
        name = item.get("name") or item.get("model")
        if not name:
            continue
        body = json.dumps({"model": name, "keep_alive": 0, "prompt": ""}).encode()
        req = urllib.request.Request(
            "http://127.0.0.1:11434/api/generate",
            data=body,
            headers={"Content-Type": "application/json"},
        )
        try:
            urllib.request.urlopen(req, timeout=3).read()
        except (OSError, urllib.error.URLError, TimeoutError):
            continue


def run_json(script: Path, payload: dict, timeout: int) -> dict:
    completed = subprocess.run(
        [sys.executable, str(script)],
        input=json.dumps(payload),
        text=True,
        capture_output=True,
        timeout=timeout,
        cwd=str(ROOT),
        check=False,
    )
    text = completed.stdout.strip() or "{}"
    try:
        parsed = json.loads(text.splitlines()[-1])
    except json.JSONDecodeError:
        parsed = {
            "ok": False,
            "error": completed.stderr.strip() or "Sidecar did not return JSON.",
            "code": "bad_json",
        }
    parsed["_code"] = completed.returncode
    return parsed


def safe_paper_id(value: str) -> str:
    cleaned = "".join(ch for ch in value if ch.isalnum() or ch in "._-")
    return cleaned[:80] or "paper"


def build_raw(excerpts: list[dict]) -> dict | None:
    method_rows = [item for item in excerpts if METHOD.search(item.get("text") or "")]
    if len(method_rows) < 1:
        return None
    nodes = []
    seen: set[str] = set()
    for row in method_rows:
        text = row.get("text") or ""
        row_id = row.get("id")
        if not row_id:
            continue
        taken: list[tuple[int, int]] = []
        for needle, role in PHRASES:
            if len(nodes) >= 6:
                break
            match = re.search(rf"(?<![A-Za-z0-9]){re.escape(needle)}(?![A-Za-z0-9])", text, re.I)
            if not match:
                continue
            if any(match.start() < end and match.end() > start for start, end in taken):
                continue
            label = text[match.start() : match.end()].strip()
            taken.append((match.start(), match.end()))
            key = label.lower()
            if not label or key in seen:
                continue
            seen.add(key)
            nodes.append(
                {
                    "id": f"n{len(nodes) + 1}",
                    "label": label,
                    "role": role,
                    "evidence_ids": [row_id],
                }
            )
        if len(nodes) >= 6:
            break
    if len(nodes) < 2:
        nodes = _phrases_from_text(method_rows, nodes)
    if len(nodes) < 2:
        return None
    edges = [
        {"from": nodes[index]["id"], "to": nodes[index + 1]["id"], "label": None}
        for index in range(len(nodes) - 1)
    ]
    training = all(node["role"] in {"process", "loss"} for node in nodes)
    return {
        "kind": "training_or_inference_loop" if training else "methodology_workflow",
        "title": "Method",
        "caption": "",
        "nodes": nodes,
        "edges": edges,
        "warnings": [],
    }


def _clip_phrase(piece: str) -> str | None:
    words = re.findall(r"[A-Za-z][A-Za-z0-9-]*", piece)
    cut: list[str] = []
    for word in words:
        if word.lower() in _STOP:
            break
        cut.append(word)
        if len(cut) == 4:
            break
    words = cut
    if not words or all(word.lower() in _STOP for word in words):
        return None
    label = " ".join(words)
    return label if len(label) >= 3 else None


def _add_node(nodes: list[dict], seen: set[str], label: str, row_id: str) -> None:
    if len(nodes) >= 6:
        return
    key = label.lower()
    if key in seen:
        return
    seen.add(key)
    nodes.append(
        {
            "id": f"n{len(nodes) + 1}",
            "label": label,
            "role": "other",
            "evidence_ids": [row_id],
        }
    )


def _phrases_from_text(rows: list[dict], nodes: list[dict]) -> list[dict]:
    seen = {node["label"].lower() for node in nodes}
    for row in rows:
        text = row.get("text") or ""
        row_id = row.get("id")
        if not row_id:
            continue
        found: list[str] = []
        for match in re.finditer(r"(?:like|including|such as)\s+([^.]{0,180})", text, re.I):
            for piece in re.split(r",|\band\b", match.group(1)):
                label = _clip_phrase(piece)
                if label:
                    found.append(label)
        if len(nodes) + len(found) < 2:
            for match in re.finditer(r"\b(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b", text):
                found.append(match.group(0))
        for label in found:
            clipped = _clip_phrase(label)
            if clipped and clipped.lower() in text.lower():
                _add_node(nodes, seen, clipped, row_id)
            if len(nodes) >= 6:
                return nodes
    return nodes


def emit(payload: dict, code: int = 0) -> None:
    json.dump(payload, sys.stdout)
    sys.stdout.write("\n")
    raise SystemExit(code)


def main() -> None:
    request = json.load(sys.stdin)
    if request.get("status") != "ready":
        emit(
            {
                "ok": False,
                "code": "not_ready",
                "error": "Charts are only built for a Ready paper.",
            },
            2,
        )
    excerpts = request.get("excerpts") or []
    paper_id = safe_paper_id(str(request.get("paper_id") or "paper"))
    flux_model = request.get("flux_model") or os.environ.get("PAPER_LENS_FLUX_MODEL") or "flux.1-schnell"
    started = time.perf_counter()
    raw = build_raw(excerpts)
    grounded = ground(raw, excerpts) if raw else None
    if not grounded:
        emit(
            {
                "ok": False,
                "code": "thin_text",
                "error": "The method text is too thin for a chart. Nothing was invented.",
            },
            2,
        )
    unload_ollama()
    out_dir = PUBLIC / paper_id
    filename = f"{grounded['kind']}-0.png"
    target = out_dir / filename
    rendered = run_json(
        FLUX,
        {"model": flux_model, "prompt": grounded.get("dense_flux_prompt") or "", "output": str(target)},
        timeout=300,
    )
    image_url = None
    flux_id = None
    if rendered.get("ok") and target.exists():
        image_url = f"/generated/{paper_id}/{filename}"
        flux_id = rendered.get("model") or flux_model
        grounded["render"] = "flux"
    else:
        grounded["render"] = "mermaid"
        grounded.setdefault("warnings", []).append(
            "FLUX unavailable. Showing the Mermaid diagram from the same method text."
        )
    grounded["image_url"] = image_url
    grounded["vl_model"] = None
    grounded["flux_model"] = flux_id
    emit(
        {
            "ok": True,
            "model": flux_id or flux_model,
            "flux_model": flux_id,
            "render": grounded["render"],
            "elapsed_ms": int((time.perf_counter() - started) * 1000),
            "charts": [grounded],
        }
    )


def self_test() -> None:
    excerpts = [
        {"id": "c-enc", "text": "The encoder is composed of a stack of identical layers."},
        {"id": "c-pos", "text": "We add positional encodings to the input embeddings."},
        {"id": "c-noise", "text": "Page header. Volume 30. NIPS 2017."},
    ]
    raw = build_raw(excerpts)
    assert raw is not None
    grounded = ground(raw, excerpts)
    assert grounded is not None
    labels = [node["label"].lower() for node in grounded["nodes"]]
    assert "encoder" in labels
    assert any("positional" in label for label in labels)
    assert len(grounded["nodes"]) >= 2
    thin = build_raw([{"id": "c-noise", "text": "Page header. Volume 30. NIPS 2017."}])
    assert thin is None
    geo_text = (
        "Materials and methods. Regression used explanatory variables like "
        "aerosol index, NO2, mean patch size, patch density."
    )
    geo = build_raw([{"id": "m1", "text": geo_text}])
    assert geo is not None and len(geo["nodes"]) >= 2
    assert all(node["label"].lower() in geo_text.lower() for node in geo["nodes"])
    print("chart-pipeline text ok")


if __name__ == "__main__":
    if "--self-test" in sys.argv:
        self_test()
    else:
        main()
