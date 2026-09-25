#!/usr/bin/env python3
"""Run vision JSON, then FLUX, as separate processes so only one heavy model is resident.

Peak target is under PAPER_LENS_RAM_BUDGET_GB (default 18) on a 24 GB M4 Pro.
If FLUX cannot render, the chart keeps Mermaid from the same grounded nodes.
This script never invents a diagram when the vision model returns nothing.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
VLM = ROOT / "vlm_diagram_spec.py"
FLUX = ROOT / "flux_render.py"
PUBLIC = ROOT.parent / "public" / "generated"


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


def main() -> None:
    request = json.load(sys.stdin)
    if request.get("status") != "ready":
        json.dump(
            {
                "ok": False,
                "code": "not_ready",
                "error": "Charts are only built for a Ready paper.",
            },
            sys.stdout,
        )
        return
    excerpts = request.get("excerpts") or []
    paper_id = safe_paper_id(str(request.get("paper_id") or "paper"))
    vl_model = request.get("model") or os.environ.get("PAPER_LENS_VLM_MODEL") or "mlx-community/Qwen3-VL-8B-Instruct-4bit"
    fallback = request.get("fallback") or os.environ.get("PAPER_LENS_VLM_FALLBACK") or "lmstudio-community/Qwen3-VL-4B-Instruct-MLX-4bit"
    flux_model = request.get("flux_model") or os.environ.get("PAPER_LENS_FLUX_MODEL") or "flux.1-schnell"
    started = time.perf_counter()
    vlm = run_json(
        VLM,
        {"model": vl_model, "fallback": fallback, "excerpts": excerpts, "images": request.get("images") or []},
        timeout=300,
    )
    if not vlm.get("ok"):
        json.dump(
            {
                "ok": False,
                "error": vlm.get("error") or "Couldn't build charts from the method section.",
                "code": vlm.get("code") or "vlm_failed",
                "model": vlm.get("model") or vl_model,
            },
            sys.stdout,
        )
        sys.stdout.write("\n")
        raise SystemExit(2)
    charts = []
    out_dir = PUBLIC / paper_id
    for index, chart in enumerate(vlm.get("charts") or []):
        image_url = None
        flux_id = None
        filename = f"{chart['kind']}-{index}.webp"
        target = out_dir / filename
        rendered = run_json(
            FLUX,
            {"model": flux_model, "prompt": chart.get("dense_flux_prompt") or "", "output": str(target)},
            timeout=300,
        )
        if rendered.get("ok") and target.exists():
            image_url = f"/generated/{paper_id}/{filename}"
            flux_id = rendered.get("model") or flux_model
            chart["render"] = "flux"
        else:
            chart["render"] = "mermaid"
            chart.setdefault("warnings", []).append(
                "FLUX did not render. Showing the Mermaid diagram from the same nodes."
            )
        chart["image_url"] = image_url
        chart["vl_model"] = vlm.get("model")
        chart["flux_model"] = flux_id
        charts.append(chart)
    json.dump(
        {
            "ok": True,
            "model": vlm.get("model"),
            "flux_model": flux_model,
            "elapsed_ms": int((time.perf_counter() - started) * 1000),
            "charts": charts,
        },
        sys.stdout,
    )
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
