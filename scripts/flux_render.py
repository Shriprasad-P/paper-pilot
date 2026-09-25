#!/usr/bin/env python3
"""Render one FLUX image from a dense prompt, then exit so the weights unload.

Does not load a vision model. If mflux is missing, exit without writing an image.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

MODEL_MAP = {
    "flux.1-schnell": {"name": "schnell", "steps": 4, "quantize": 4},
    "flux.2-klein": {"name": "flux2-klein", "steps": 4, "quantize": 8},
}


def fail(message: str, code: str) -> None:
    json.dump({"ok": False, "error": message, "code": code}, sys.stdout)
    sys.stdout.write("\n")
    raise SystemExit(2)


def generate(model_id: str, prompt: str, output: Path) -> None:
    spec = MODEL_MAP[model_id]
    output.parent.mkdir(parents=True, exist_ok=True)
    try:
        from mflux.flux.flux import Flux1
        from mflux.models.common.config import ModelConfig
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(f"mflux is not available ({exc})") from exc

    configs = {
        "schnell": "flux1_schnell",
        "flux2-klein": "flux2_klein",
    }
    config_name = configs.get(spec["name"], "flux1_schnell")
    config_fn = getattr(ModelConfig, config_name, None)
    if config_fn is None:
        raise RuntimeError(f"This mflux build has no {config_name} config.")
    model = Flux1(model_config=config_fn(), quantize=spec["quantize"])
    try:
        image = model.generate_image(
            seed=7,
            prompt=prompt,
            num_inference_steps=spec["steps"],
            width=768,
            height=1024,
        )
        image.image.save(output)
    finally:
        del model


def main() -> None:
    request = json.load(sys.stdin)
    model_id = request.get("model") or "flux.1-schnell"
    prompt = (request.get("prompt") or "").strip()
    output = request.get("output") or ""
    if model_id not in MODEL_MAP:
        fail("That FLUX id is not on the allow-list.", "bad_model")
    if not prompt or not output:
        fail("FLUX needs a prompt and an output path.", "bad_request")
    path = Path(output)
    if "generated" not in path.parts:
        fail("Refusing to write an image outside the generated charts folder.", "bad_path")
    try:
        generate(model_id, prompt, path)
    except Exception as exc:  # noqa: BLE001 — missing mflux or OOM must fall back to Mermaid
        fail(f"FLUX did not render. {exc}", "flux_unavailable")
    json.dump({"ok": True, "model": model_id, "path": str(path)}, sys.stdout)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
