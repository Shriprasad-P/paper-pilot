#!/bin/bash
# Run this on the Apple Silicon Mac, from the repo root.
# It does not load the vision model and FLUX at the same time.
set -euo pipefail
cd "$(dirname "$0")/.."

python3 -m venv .venv
.venv/bin/pip install -U pip mlx mlx-vlm huggingface_hub pillow
.venv/bin/python -c "import mlx, mlx_vlm; print('mlx-vlm OK')"

if [[ ! -x "$HOME/.local/bin/mflux-generate" ]] && ! command -v mflux-generate >/dev/null; then
  echo "mflux-generate is missing. Install with: uv tool install mflux"
  exit 1
fi

echo "Downloading Qwen3-VL-8B 4-bit (skipped automatically if the cache is complete)..."
.venv/bin/huggingface-cli download mlx-community/Qwen3-VL-8B-Instruct-4bit

echo "Downloading FLUX.1 schnell with one small mflux run, then deleting the probe image..."
PROBE="$(mktemp -d)/paper-lens-flux-probe.png"
mflux-generate --model schnell --prompt "A single labeled box" --steps 2 --width 256 --height 256 --low-ram --output "$PROBE" \
  || mflux-generate --model schnell --prompt "A single labeled box" --steps 2 --width 256 --height 256 --output "$PROBE"
rm -f "$PROBE"
echo "FLUX probe finished. Weights should now be under ~/.cache/huggingface/hub/"

ollama pull nomic-embed-text
ollama pull qwen3:4b

if [[ ! -f .env.local ]]; then
  cp .env.example .env.local
fi

echo "Setup done. Start the desk with: npm install && npx next dev --turbopack -H 0.0.0.0 -p 43123"
