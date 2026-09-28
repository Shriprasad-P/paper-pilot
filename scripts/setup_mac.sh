#!/bin/bash
# Run this on the Apple Silicon Mac, from the repo root.
# One heavy model at a time. Peak target is under 18 GB on a 24 GB M4 Pro.
# Charts do not load a vision-language model. Ask loads only after FLUX has exited.
set -euo pipefail
cd "$(dirname "$0")/.."

python3 -m venv .venv
.venv/bin/pip install -U pip huggingface_hub pillow

if [[ ! -x "$HOME/.local/bin/mflux-generate" ]] && ! command -v mflux-generate >/dev/null; then
  echo "mflux-generate is missing. Install with: uv tool install mflux"
  exit 1
fi

echo "Checking the Hugging Face cache for FLUX.1 schnell (this script does not download weights)..."
if find "$HOME/.cache/huggingface/hub" -maxdepth 2 -type d \( -iname '*FLUX.1-schnell*' -o -iname '*flux.1-schnell*' -o -iname '*flux*schnell*' \) 2>/dev/null | grep -q .; then
  echo "FLUX.1 schnell is already in ~/.cache/huggingface/hub. Skipping any download."
else
  echo "FLUX.1 schnell was not found under ~/.cache/huggingface/hub."
  echo "Weights are expected to be cached already. This script will not download them."
  exit 1
fi

if ! command -v ollama >/dev/null; then
  echo "Ollama is missing. Install it, then rerun so nomic-embed-text and llama3.2:3b can be pulled."
  exit 1
fi

ollama pull nomic-embed-text
ollama pull llama3.2:3b

if [[ ! -f .env.local ]]; then
  cp .env.example .env.local
fi

echo "Setup done. Live stack: Apple OCR + nomic-embed-text + llama3.2:3b + mflux FLUX, one heavy model at a time."
echo "Start the desk with: npm install && npx next dev -H 127.0.0.1 -p 43123"
