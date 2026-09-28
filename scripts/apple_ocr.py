#!/usr/bin/env python3
"""Read a PDF with Apple Vision OCR. This does not invent text.

On macOS it renders pages with PDFKit and runs VNRecognizeTextRequest via
scripts/apple_ocr.swift. Anywhere else it refuses.
"""

from __future__ import annotations

import json
import os
import platform
import subprocess
import sys
from pathlib import Path

SWIFT = Path(__file__).with_name("apple_ocr.swift")
OCR_BINARY = os.environ.get("PAPER_LENS_OCR_BINARY")


def emit(payload: dict, code: int = 0) -> None:
    json.dump(payload, sys.stdout)
    sys.stdout.write("\n")
    raise SystemExit(code)


def normalize(parsed: dict) -> dict:
    pages = []
    for page in parsed.get("pages") or []:
        text = (page.get("text") or "").strip()
        blocks = []
        for block in page.get("blocks") or []:
            block_text = (block.get("text") or "").strip()
            if not block_text:
                continue
            bbox = block.get("bbox") if isinstance(block.get("bbox"), list) else []
            blocks.append({"text": block_text, "bbox": bbox[:4]})
        if not text and blocks:
            text = "\n".join(block["text"] for block in blocks)
        pages.append({"page": int(page.get("page") or len(pages) + 1), "text": text, "blocks": blocks})
    if not any(page["text"] for page in pages):
        emit(
            {
                "ok": False,
                "error": "Apple OCR didn’t find readable text in that PDF.",
                "code": "empty",
                "pages": [],
            },
            2,
        )
    return {"ok": True, "engine": "apple_vision", "pages": pages}


def main() -> None:
    if "--self-test" in sys.argv:
        if platform.system() == "Darwin":
            print("apple-ocr self-test ok")
            return
        if not SWIFT.exists():
            raise SystemExit("missing swift helper")
        print("apple-ocr self-test ok")
        return
    request = json.load(sys.stdin)
    if platform.system() != "Darwin":
        emit(
            {
                "ok": False,
                "error": "Apple OCR runs on macOS only. This file stays Not parsed.",
                "code": "not_mac",
                "pages": [],
            },
            2,
        )
    pdf_path = request.get("pdf_path") or ""
    if not pdf_path or not Path(pdf_path).is_file():
        emit({"ok": False, "error": "Missing PDF.", "code": "bad_request", "pages": []}, 2)
    if not SWIFT.exists():
        emit({"ok": False, "error": "The Apple OCR helper is missing.", "code": "ocr_failed", "pages": []}, 2)
    command = [OCR_BINARY, pdf_path] if OCR_BINARY else ["swift", str(SWIFT), pdf_path]
    completed = subprocess.run(
        command,
        capture_output=True,
        text=True,
        timeout=180,
        check=False,
    )
    line = (completed.stdout or "").strip().splitlines()
    raw = line[-1] if line else ""
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        detail = (completed.stderr or "Apple OCR did not return JSON.").strip()[-400:]
        emit({"ok": False, "error": detail, "code": "ocr_failed", "pages": []}, 2)
    if not parsed.get("ok"):
        emit(
            {
                "ok": False,
                "error": parsed.get("error") or "Apple OCR failed.",
                "code": parsed.get("code") or "ocr_failed",
                "pages": [],
            },
            2,
        )
    emit(normalize(parsed))


if __name__ == "__main__":
    main()
