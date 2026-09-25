#!/usr/bin/env python3
"""Render one FLUX image from a dense prompt, then exit so the weights unload.

Does not load a vision model. If mflux is missing, exit without writing an image.
"""

from __future__ import annotations

import json
import shutil
import subprocess
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


def mflux_bin() -> str | None:
    found = shutil.which("mflux-generate")
    if found:
        return found
    local = Path.home() / ".local" / "bin" / "mflux-generate"
    if local.exists():
        return str(local)
    return None


def generate_python(model_id: str, prompt: str, output: Path) -> None:
    spec = MODEL_MAP[model_id]
    from mflux.flux.flux import Flux1
    from mflux.models.common.config import ModelConfig

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


def generate_cli(model_id: str, prompt: str, output: Path) -> None:
    spec = MODEL_MAP[model_id]
    binary = mflux_bin()
    if not binary:
        raise RuntimeError("mflux-generate is not on PATH and ~/.local/bin/mflux-generate is missing.")
    help_run = subprocess.run([binary, "--help"], capture_output=True, text=True, check=False)
    help_text = f"{help_run.stdout}\n{help_run.stderr}"
    quant_flag = "--quantize" if "--quantize" in help_text else "-q"
    cmd = [
        binary,
        "--model",
        spec["name"],
        "--prompt",
        prompt,
        "--steps",
        str(spec["steps"]),
        "--seed",
        "7",
        "--width",
        "768",
        "--height",
        "1024",
        quant_flag,
        str(spec["quantize"]),
        "--output",
        str(output),
    ]
    if "--low-ram" in help_text:
        cmd.insert(1, "--low-ram")
    completed = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if completed.returncode != 0 or not output.exists():
        detail = (completed.stderr or completed.stdout or "mflux-generate failed").strip()
        raise RuntimeError(detail[-800:])


def generate(model_id: str, prompt: str, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    try:
        generate_python(model_id, prompt, output)
        return
    except Exception as python_exc:  # noqa: BLE001 — uv-tool CLI is the install on this Mac
        if output.exists():
            return
        try:
            generate_cli(model_id, prompt, output)
        except Exception as cli_exc:  # noqa: BLE001
            raise RuntimeError(f"python mflux: {python_exc}; cli: {cli_exc}") from cli_exc


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
