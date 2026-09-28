#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-run}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_PROCESS="PaperLens"
APP_EXECUTABLE="PaperLensApp"
APP_BUNDLE="$ROOT_DIR/dist/Paper Lens.app"
APP_BIN="$APP_BUNDLE/Contents/MacOS/$APP_EXECUTABLE"
mkdir -p "$ROOT_DIR/dist"
pkill -x "$APP_PROCESS" >/dev/null 2>&1 || true

cd "$ROOT_DIR"
swift build --package-path macos/PaperLensApp
npm run build
python3 scripts/package_macos.py

case "$MODE" in
  run)
    /usr/bin/open -n "$APP_BUNDLE"
    ;;
  package)
    echo "Created $APP_BUNDLE"
    ;;
  --debug|debug)
    lldb -- "$APP_BIN"
    ;;
  --logs|logs)
    /usr/bin/open -n "$APP_BUNDLE"
    /usr/bin/log stream --info --style compact --predicate 'process == "PaperLensApp"'
    ;;
  --telemetry|telemetry)
    /usr/bin/open -n "$APP_BUNDLE"
    /usr/bin/log stream --info --style compact --predicate 'subsystem == "com.paperpilot.paperlens"'
    ;;
  --verify|verify)
    /usr/bin/open -n "$APP_BUNDLE"
    for _ in {1..20}; do
      if pgrep -x "$APP_PROCESS" >/dev/null; then exit 0; fi
      sleep 0.5
    done
    echo "Paper Lens did not start." >&2
    exit 1
    ;;
  *)
    echo "usage: $0 [run|package|--debug|--logs|--telemetry|--verify]" >&2
    exit 2
    ;;
esac
