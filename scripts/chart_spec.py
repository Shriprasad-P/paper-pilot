#!/usr/bin/env python3
"""Compile methodology excerpts into a diagram spec.

The UI renders Mermaid from this JSON. The model is not asked to paint a raster.

Preferred model (Apple Silicon, mlx-vlm):
  lmstudio-community/Qwen3-VL-4B-Instruct-MLX-4bit
Optional larger model:
  mlx-community/Qwen3.5-27B-4bit
If MLX cannot load, try Ollama qwen2.5vl:7b.
This process loads one model, then exits so the weights are released.
"""

from __future__ import annotations

import json
import platform
import re
import sys
import time
import urllib.error
import urllib.request

DEFAULT_MODEL = "lmstudio-community/Qwen3-VL-4B-Instruct-MLX-4bit"
LARGE_MODEL = "mlx-community/Qwen3.5-27B-4bit"
OLLAMA_MODEL = "qwen2.5vl:7b"
ALLOWED_MODELS = {DEFAULT_MODEL, LARGE_MODEL}

KINDS = {
    "methodology_workflow",
    "model_architecture",
    "training_or_inference_loop",
    "data_pipeline",
}
ROLES = {"input", "process", "model", "output", "loss", "other"}

SYSTEM = """You are a research-diagram compiler. Given paper excerpts (and optional figure images), output only JSON. Use paper terminology. No decorative icons, no marketing language. If methodology is unclear, fewer nodes and a warning. Do not name a module that the excerpts do not support.

Return one JSON object with a charts array. Each chart must match:
{"kind":"methodology_workflow","title":"","caption":"","mermaid":"","nodes":[{"id":"","label":"","role":"input|process|model|output|loss|other","evidence_ids":[]}],"edges":[{"from":"","to":"","label":null}],"evidence_ids":[],"warnings":[]}

kind is one of methodology_workflow, model_architecture, training_or_inference_loop, data_pipeline.
Include a kind only when the excerpts support it. methodology_workflow is the default when the method has steps.
mermaid is a flowchart TB (or LR) with those node ids. At most 12 nodes. Labels are 2 to 5 words.
Every node evidence_ids entry must be an excerpt id from the input. The caption names the method in plain language.
If a figure image is attached, use it only to recover roles of boxes and arrows that the text also supports. Still emit JSON, not a description of pixels."""


def words(value: str) -> list[str]:
    return [part for part in re.split(r"[^a-z0-9]+", value.lower().replace("_", " ").replace("-", " ")) if len(part) > 2]


def safe_id(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_]", "", value)
    if re.match(r"^[A-Za-z]", cleaned):
        return cleaned
    return f"n{cleaned or 'node'}"


def quote(label: str) -> str:
    return label.replace('"', "'").replace("<", "").replace(">", "").strip()


def mermaid_from(nodes: list[dict], edges: list[dict]) -> str:
    lines = ["flowchart TB"]
    for node in nodes:
        lines.append(f'  {safe_id(node["id"])}["{quote(node["label"])}"]')
    for edge in edges:
        src = safe_id(edge["from"])
        dst = safe_id(edge["to"])
        label = edge.get("label")
        if isinstance(label, str) and label.strip():
            lines.append(f"  {src} -->|{quote(label)}| {dst}")
        else:
            lines.append(f"  {src} --> {dst}")
    lines.extend(
        [
            "  classDef input fill:#f4f0e6,stroke:#1b4f5c,color:#1c1915",
            "  classDef process fill:#e6f1f3,stroke:#1b4f5c,color:#1c1915",
            "  classDef model fill:#d5e8ec,stroke:#1b4f5c,color:#1c1915",
            "  classDef output fill:#f7f4ee,stroke:#1b4f5c,color:#1c1915",
            "  classDef loss fill:#f3e6e0,stroke:#1b4f5c,color:#1c1915",
            "  classDef other fill:#f7f4ee,stroke:#1b4f5c,color:#1c1915",
        ]
    )
    for node in nodes:
        lines.append(f'  class {safe_id(node["id"])} {node["role"]}')
    return "\n".join(lines)


def label_in_text(label: str, text: str) -> bool:
    tokens = words(label)
    haystack = text.lower()
    if not tokens:
        return label.lower() in haystack
    return any(token in haystack for token in tokens)


def ground(raw: dict, excerpts: list[dict]) -> dict | None:
    kind = raw.get("kind")
    if kind not in KINDS:
        return None
    by_id = {item["id"]: item.get("text", "") for item in excerpts if item.get("id")}
    warnings = [item for item in raw.get("warnings") or [] if isinstance(item, str)][:6]
    nodes = []
    for node in raw.get("nodes") or []:
        if len(nodes) >= 12:
            warnings.append("Stopped at 12 nodes.")
            break
        node_id = safe_id(node.get("id") or "")
        label = (node.get("label") or "").strip()
        role = node.get("role") if node.get("role") in ROLES else "other"
        evidence = [item for item in node.get("evidence_ids") or [] if item in by_id]
        if not node_id or not label or not evidence:
            warnings.append("Dropped a node with no retrieved excerpt.")
            continue
        cited = "\n".join(by_id[item] for item in evidence)
        if not label_in_text(label, cited):
            warnings.append(f"Dropped “{label}” because that wording is not in the cited excerpt.")
            continue
        nodes.append(
            {
                "id": node_id,
                "label": label[:80],
                "role": role,
                "evidence_ids": evidence,
            }
        )
    if len(nodes) < 2:
        return None
    ids = {node["id"] for node in nodes}
    edges = []
    for edge in raw.get("edges") or []:
        src = safe_id(edge.get("from") or "")
        dst = safe_id(edge.get("to") or "")
        if src not in ids or dst not in ids or src == dst:
            continue
        label = edge.get("label")
        edges.append(
            {
                "from": src,
                "to": dst,
                "label": label.strip()[:40] if isinstance(label, str) and label.strip() else None,
            }
        )
    node_words = {word for node in nodes for word in words(node["label"])}
    caption = (raw.get("caption") or "").strip()
    hits = [word for word in words(caption) if len(word) > 3 and word in node_words]
    if not caption or not hits:
        caption = " → ".join(node["label"] for node in nodes)
        warnings.append("Caption fell back to the grounded node labels.")
    title = (raw.get("title") or "").strip()[:80] or "Methodology"
    mermaid = (raw.get("mermaid") or "").strip()
    mermaid_ok = bool(re.match(r"^(flowchart|graph)\s+(TB|TD|LR|RL|BT)\b", mermaid)) and not re.search(
        r"javascript:|click\s", mermaid, re.I
    )
    if not mermaid_ok:
        mermaid = mermaid_from(nodes, edges)
        warnings.append("Rebuilt the diagram from grounded nodes.")
    evidence_ids = []
    for node in nodes:
        for item in node["evidence_ids"]:
            if item not in evidence_ids:
                evidence_ids.append(item)
    return {
        "kind": kind,
        "title": title,
        "caption": caption[:400],
        "mermaid": mermaid,
        "nodes": nodes,
        "edges": edges,
        "evidence_ids": evidence_ids,
        "warnings": list(dict.fromkeys(warnings))[:6],
    }


def parse_model_json(text: str) -> dict:
    fenced = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.S)
    payload = fenced.group(1) if fenced else text
    start = payload.find("{")
    end = payload.rfind("}")
    if start < 0 or end < start:
        raise ValueError("Model did not return JSON.")
    return json.loads(payload[start : end + 1])


def unload_ollama() -> None:
    """Ask Ollama to drop resident models so this process is the only heavy load."""
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


def mlx_generate(model_id: str, prompt: str, images: list[str]) -> str:
    from mlx_vlm import generate, load
    from mlx_vlm.prompt_utils import apply_chat_template
    from mlx_vlm.utils import load_config

    unload_ollama()
    model, processor = load(model_id)
    config = load_config(model_id)
    formatted = apply_chat_template(processor, config, prompt, num_images=len(images))
    kwargs = {"max_tokens": 1400, "temperature": 0.1, "verbose": False}
    if images:
        result = generate(model, processor, formatted, image=images, **kwargs)
    else:
        try:
            result = generate(model, processor, formatted, **kwargs)
        except TypeError:
            result = generate(model, processor, formatted, image=[], **kwargs)
    if isinstance(result, tuple):
        return str(result[0])
    text = getattr(result, "text", None)
    return text if isinstance(text, str) else str(result)


def ollama_generate(prompt: str, images: list[str]) -> str:
    message: dict = {"role": "user", "content": prompt}
    if images:
        message["images"] = images
    body = json.dumps(
        {
            "model": OLLAMA_MODEL,
            "stream": False,
            "messages": [
                {"role": "system", "content": SYSTEM},
                message,
            ],
            "options": {"temperature": 0.1},
        }
    ).encode()
    req = urllib.request.Request(
        "http://127.0.0.1:11434/api/chat",
        data=body,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=180) as res:
        payload = json.loads(res.read().decode())
    return payload.get("message", {}).get("content") or ""


def user_prompt(excerpts: list[dict], image_count: int) -> str:
    blocks = []
    for excerpt in excerpts:
        page = excerpt.get("page")
        where = f" ({excerpt.get('section', '')}, p. {page})" if page else f" ({excerpt.get('section', '')})"
        blocks.append(f"[{excerpt['id']}]{where}\n{excerpt.get('text', '')}")
    extra = f"\nAttached figure images: {image_count}. Use them only to name boxes the excerpts already support.\n" if image_count else ""
    return (
        "Compile methodology diagrams from these excerpts. Output JSON only.\n"
        + extra
        + "\n\n".join(blocks)
    )


def charts_from_text(text: str, excerpts: list[dict]) -> list[dict]:
    parsed = parse_model_json(text)
    raw_charts = parsed.get("charts") if isinstance(parsed.get("charts"), list) else [parsed]
    grounded = []
    seen = set()
    for raw in raw_charts:
        if not isinstance(raw, dict):
            continue
        diagram = ground(raw, excerpts)
        if not diagram or diagram["kind"] in seen:
            continue
        seen.add(diagram["kind"])
        grounded.append(diagram)
        if len(grounded) >= 3:
            break
    return grounded


def fail(message: str, model: str | None = None, code: str = "chart_failed") -> None:
    json.dump({"ok": False, "error": message, "code": code, "model": model}, sys.stdout)
    sys.stdout.write("\n")
    raise SystemExit(2)


def self_test() -> None:
    excerpts = [
        {
            "id": "c-enc",
            "text": "The encoder is composed of a stack of N = 6 identical layers. Each layer has a multi-head self-attention mechanism.",
        },
        {
            "id": "c-pos",
            "text": "We add positional encodings to the input embeddings at the bottoms of the encoder and decoder stacks.",
        },
    ]
    good = ground(
        {
            "kind": "methodology_workflow",
            "title": "Transformer method",
            "caption": "The encoder stack reads embeddings plus positional encodings.",
            "mermaid": "not valid",
            "nodes": [
                {"id": "emb", "label": "Input embeddings", "role": "input", "evidence_ids": ["c-pos"]},
                {"id": "enc", "label": "Encoder stack", "role": "model", "evidence_ids": ["c-enc"]},
            ],
            "edges": [{"from": "emb", "to": "enc", "label": None}],
            "warnings": [],
        },
        excerpts,
    )
    assert good is not None
    assert good["mermaid"].startswith("flowchart TB")
    assert "Encoder stack" in good["mermaid"]
    invented = ground(
        {
            "kind": "model_architecture",
            "title": "No",
            "caption": "A mixture-of-experts router.",
            "nodes": [
                {"id": "a", "label": "Expert router", "role": "model", "evidence_ids": ["c-enc"]},
                {"id": "b", "label": "Gating network", "role": "process", "evidence_ids": ["missing"]},
            ],
            "edges": [],
        },
        excerpts,
    )
    assert invented is None
    print("self-test ok")


def main() -> None:
    if "--self-test" in sys.argv:
        self_test()
        return
    request = json.load(sys.stdin)
    excerpts = request.get("excerpts") or []
    if len(excerpts) < 1:
        fail("No method excerpts were provided.", code="no_excerpts")
    model = request.get("model") or DEFAULT_MODEL
    if model not in ALLOWED_MODELS:
        fail("That model id is not one of the local MLX chart models.", model=model, code="bad_model")
    images = [item for item in request.get("images") or [] if isinstance(item, str)]
    prompt = SYSTEM + "\n\n" + user_prompt(excerpts, len(images))
    started = time.perf_counter()
    backend = "mlx"
    used = model
    errors: list[str] = []
    text = ""
    try:
        if platform.system() != "Darwin":
            raise RuntimeError("MLX runs on macOS Apple Silicon only.")
        text = mlx_generate(model, prompt, images)
    except Exception as exc:  # noqa: BLE001 — load failures must fall through to Ollama
        errors.append(f"MLX: {exc}")
        try:
            unload_ollama()
            text = ollama_generate(prompt, images)
            backend = "ollama"
            used = OLLAMA_MODEL
        except Exception as ollama_exc:  # noqa: BLE001
            errors.append(f"Ollama: {ollama_exc}")
            fail(
                "Couldn't build charts from the method section. "
                + " ".join(errors),
                model=model,
                code="runtime_unavailable",
            )
    try:
        charts = charts_from_text(text, excerpts)
    except (ValueError, json.JSONDecodeError) as exc:
        fail(f"Couldn't build charts from the method section. The model did not return a diagram. {exc}", model=used)
    if not charts:
        fail(
            "Couldn't build charts from the method section. The diagram was not grounded in the excerpts.",
            model=used,
            code="ungrounded",
        )
    elapsed_ms = int((time.perf_counter() - started) * 1000)
    json.dump(
        {
            "ok": True,
            "model": used,
            "backend": backend,
            "elapsed_ms": elapsed_ms,
            "charts": charts,
        },
        sys.stdout,
    )
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
