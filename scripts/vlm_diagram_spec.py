#!/usr/bin/env python3
"""Qwen3-VL → diagram JSON only. This process exits when it finishes so the weights unload.

Default model: mlx-community/Qwen3-VL-8B-Instruct-4bit
If that load runs out of memory, retry lmstudio-community/Qwen3-VL-4B-Instruct-MLX-4bit.
Does not load FLUX.
"""

from __future__ import annotations

import json
import platform
import sys
import time

from diagram_ground import ground

DEFAULT_MODEL = "mlx-community/Qwen3-VL-8B-Instruct-4bit"
FALLBACK_MODEL = "lmstudio-community/Qwen3-VL-4B-Instruct-MLX-4bit"
ALLOWED = {DEFAULT_MODEL, FALLBACK_MODEL}

SYSTEM = """You are a research-diagram compiler. Given paper excerpts (and optional figure images), output only JSON. Use paper terminology. No decorative icons, no marketing language. If methodology is unclear, fewer nodes and a warning. Do not name a module the excerpts do not support.

Return {"charts":[ ... ]} with 1 to 3 charts. Each chart:
{"kind":"methodology_workflow","title":"","caption":"","extracted_text_nodes":[],"visual_style":"High-fidelity vector diagram, clean technical schematic, corporate isometric blueprint","dense_flux_prompt":"","nodes":[{"id":"","label":"","role":"input|process|model|output|loss|other","evidence_ids":[]}],"edges":[{"from":"","to":"","label":null}],"evidence_ids":[],"warnings":[],"mermaid":"flowchart TB"}

kind is methodology_workflow, model_architecture, training_or_inference_loop, or data_pipeline. Include a kind only when the excerpts support it.
At most 12 nodes. Labels are 2 to 5 words copied from the excerpts. Every evidence id must be one of the excerpt ids.
extracted_text_nodes must equal the node labels.
dense_flux_prompt is one dense sentence for a technical schematic. Every label appears inside double quotes, for example the text "Encoder stack" clearly printed on the left module. No labels that are not nodes.
Prefer boxes, arrows, and swimlanes. Not decorative art.
If a figure image is attached, use it only to recover boxes the text also supports. Still emit JSON, not a pixel description."""


def fail(message: str, model: str | None = None, code: str = "vlm_failed") -> None:
    json.dump({"ok": False, "error": message, "code": code, "model": model}, sys.stdout)
    sys.stdout.write("\n")
    raise SystemExit(2)


def user_prompt(excerpts: list[dict], image_count: int) -> str:
    blocks = []
    for excerpt in excerpts:
        page = excerpt.get("page")
        where = f" ({excerpt.get('section', '')}, p. {page})" if page else f" ({excerpt.get('section', '')})"
        blocks.append(f"[{excerpt['id']}]{where}\n{excerpt.get('text', '')}")
    extra = (
        f"\nAttached figure images: {image_count}. Use them only to name boxes the excerpts already support.\n"
        if image_count
        else ""
    )
    return "Compile methodology diagrams from these excerpts. Output JSON only.\n" + extra + "\n\n".join(blocks)


def parse_model_json(text: str) -> dict:
    import re

    fenced = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.S)
    payload = fenced.group(1) if fenced else text
    start = payload.find("{")
    end = payload.rfind("}")
    if start < 0 or end < start:
        raise ValueError("Model did not return JSON.")
    return json.loads(payload[start : end + 1])


def release_mlx() -> None:
    try:
        import gc

        import mlx.core as mx

        gc.collect()
        mx.clear_cache()
    except Exception:
        return


def mlx_generate(model_id: str, prompt: str, images: list[str]) -> str:
    from mlx_vlm import generate, load
    from mlx_vlm.prompt_utils import apply_chat_template
    from mlx_vlm.utils import load_config

    model, processor = load(model_id)
    try:
        config = load_config(model_id)
        formatted = apply_chat_template(processor, config, prompt, num_images=len(images))
        kwargs = {"max_tokens": 1600, "temperature": 0.1, "verbose": False}
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
    finally:
        del model
        del processor
        release_mlx()


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


def main() -> None:
    request = json.load(sys.stdin)
    excerpts = request.get("excerpts") or []
    if not excerpts:
        fail("No method excerpts were provided.", code="no_excerpts")
    primary = request.get("model") or DEFAULT_MODEL
    fallback = request.get("fallback") or FALLBACK_MODEL
    if primary not in ALLOWED:
        fail("That vision model id is not on the local chart allow-list.", model=primary, code="bad_model")
    if fallback not in ALLOWED:
        fallback = FALLBACK_MODEL
    images = [item for item in request.get("images") or [] if isinstance(item, str)]
    prompt = SYSTEM + "\n\n" + user_prompt(excerpts, len(images))
    if platform.system() != "Darwin":
        fail(
            "Couldn't build charts from the method section. MLX runs on macOS Apple Silicon only.",
            model=primary,
            code="runtime_unavailable",
        )
    started = time.perf_counter()
    errors: list[str] = []
    text = ""
    used = primary
    order = [primary] if primary == fallback else [primary, fallback]
    for model_id in order:
        try:
            text = mlx_generate(model_id, prompt, images)
            used = model_id
            break
        except Exception as exc:  # noqa: BLE001 — OOM and missing weights must try the 4B fallback
            errors.append(f"{model_id}: {exc}")
            release_mlx()
            text = ""
    if not text:
        fail(
            "Couldn't build charts from the method section. " + " ".join(errors),
            model=primary,
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
    json.dump(
        {
            "ok": True,
            "model": used,
            "elapsed_ms": int((time.perf_counter() - started) * 1000),
            "charts": charts,
        },
        sys.stdout,
    )
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
